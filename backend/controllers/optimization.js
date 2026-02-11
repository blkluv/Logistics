const Optimization = require('../models/Optimization');
const Vehicle = require('../models/Vehicle');
const Location = require('../models/Location');
const fetch = require('node-fetch'); // Make sure to: npm install node-fetch
const { predictBestDepartureTime, analyzeIncidentImpact } = require('../services/trafficAI');

// Global constants
const SPEED_KMH = 60; // Fallback speed
const ROAD_FACTOR = 1.4; // Fallback road factor
const SERVICE_TIME_MINUTES = 15; // Service time per stop (loading/unloading)

// Fetch real road distance and duration matrix from Mapbox
async function getRoadMatrix(locations) {
  try {
    const token = process.env.MAPBOX_TOKEN;
    if (!token) {
      console.warn('Mapbox token not found, using fallback calculation');
      return null;
    }

    // Build coordinates string for Mapbox Matrix API
    const coordinates = locations
      .map(loc => `${loc.longitude},${loc.latitude}`)
      .join(';');

    // Use Mapbox Matrix API for distance/duration matrix
    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/${coordinates}?` +
      `sources=${locations.map((_, i) => i).join(';')}&` +
      `destinations=${locations.map((_, i) => i).join(';')}&` +
      `annotations=distance,duration&` +
      `access_token=${token}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Mapbox API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.distances || !data.durations) {
      console.warn('Invalid Mapbox response');
      return null;
    }

    // Convert to km and minutes
    const distanceMatrix = data.distances.map(row => 
      row.map(dist => dist / 1000) // meters to km
    );
    const durationMatrix = data.durations.map(row => 
      row.map(dur => dur / 60) // seconds to minutes
    );

    return { distanceMatrix, durationMatrix, success: true };

  } catch (error) {
    console.error('Error fetching road matrix:', error.message);
    return null;
  }
}

// Fetch route geometry from Mapbox Directions API with optional incident exclusion
async function getRouteGeometry(stops, incidentLocation = null) {
  try {
    const token = process.env.MAPBOX_TOKEN;
    if (!token || stops.length < 2) {
      return null;
    }

    // Build coordinates string for Mapbox Directions API
    const coordinates = stops
      .map(stop => `${stop.longitude},${stop.latitude}`)
      .join(';');

    let url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
      `geometries=geojson&overview=full`;
    
    // If incident location exists, use exclude parameter to avoid that point
    if (incidentLocation && incidentLocation.latitude && incidentLocation.longitude) {
      const excludePoint = `point(${incidentLocation.longitude} ${incidentLocation.latitude})`;
      url += `&exclude=${encodeURIComponent(excludePoint)}`;
    }
    
    url += `&access_token=${token}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Mapbox Directions API error: ${response.status}`, errorText);
      
      // Fallback: If exclude fails, try without it
      if (incidentLocation) {
        const fallbackUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?` +
          `geometries=geojson&overview=full&access_token=${token}`;
        
        const fallbackResponse = await fetch(fallbackUrl);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.routes && fallbackData.routes.length > 0) {
            return fallbackData.routes[0].geometry.coordinates;
          }
        }
      }
      
      return null;
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates; // Array of [lng, lat]
    }

    return null;
  } catch (error) {
    console.error('Error fetching route geometry:', error.message);
    return null;
  }
}

// Fallback: Calculate distance matrix using Haversine
function calculateFallbackMatrix(locations) {
  const n = locations.length;
  const distanceMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
  const durationMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distanceMatrix[i][j] = 0;
        durationMatrix[i][j] = 0;
      } else {
        const straightDist = calculateDistance(
          locations[i].latitude, locations[i].longitude,
          locations[j].latitude, locations[j].longitude
        );
        const roadDist = straightDist * ROAD_FACTOR;
        distanceMatrix[i][j] = roadDist;
        durationMatrix[i][j] = (roadDist / SPEED_KMH) * 60; // minutes
      }
    }
  }

  return { distanceMatrix, durationMatrix, success: false };
}

// Get all optimizations
exports.getOptimizations = async (req, res) => {
  try {
    const optimizations = await Optimization.find()
      .populate('vehicles')
      .populate('locations')
      .sort({ date: -1 });
    res.json(optimizations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get optimization by ID
exports.getOptimizationById = async (req, res) => {
  try {
    const optimization = await Optimization.findById(req.params.id)
      .populate('vehicles')
      .populate('locations');
    
    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    
    res.json(optimization);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    res.status(500).send('Server error');
  }
};

// Create optimization using Google OR-Tools ONLY
exports.createOptimization = async (req, res) => {
  const { name, vehicleIds, locationIds, incidentType, affectedRouteIndex, departureTime } = req.body;

  try {
    // Validate input data
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ msg: 'Valid optimization name is required' });
    }

    if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return res.status(400).json({ msg: 'At least one vehicle must be selected' });
    }

    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      return res.status(400).json({ msg: 'At least one location must be selected' });
    }

    // Validate dataset size
    if (locationIds.length > 100) {
      return res.status(400).json({ msg: 'Maximum 100 locations allowed' });
    }

    if (vehicleIds.length > 20) {
      return res.status(400).json({ msg: 'Maximum 20 vehicles allowed' });
    }

    // Get vehicles and locations
    const vehicles = await Vehicle.find({ _id: { $in: vehicleIds } });
    const locations = await Location.find({ _id: { $in: locationIds } });

    if (vehicles.length === 0) {
      return res.status(400).json({ msg: 'No valid vehicles found' });
    }

    if (locations.length === 0) {
      return res.status(400).json({ msg: 'No valid locations found' });
    }

    // Find depot
    const depot = locations.find(loc => loc.isDepot);
    if (!depot) {
      return res.status(400).json({ msg: 'At least one location must be marked as a depot' });
    }

    // Handle incident simulation for re-routing
    let trafficMultiplier = 1.0;
    let incidentAnalysis = null;

    if (incidentType && typeof affectedRouteIndex === 'number') {
      // Get AI analysis of incident impact
      incidentAnalysis = await analyzeIncidentImpact(incidentType, affectedRouteIndex, []);
      trafficMultiplier = incidentAnalysis.trafficMultiplier || 1.5;
    }

    // Run Google OR-Tools optimization with traffic multiplier
    const routes = await runORToolsOptimization(vehicles, locations, depot, trafficMultiplier, departureTime || '08:00');

    if (!routes || routes.length === 0) {
      throw new Error('OR-Tools optimization failed to generate routes');
    }

    // Calculate metrics
    let totalDistance = 0;
    let totalDuration = 0;

    routes.forEach(route => {
      totalDistance += route.distance || 0;
      totalDuration += route.duration || 0;
    });

    // Get AI traffic prediction for optimal departure time
    const trafficPrediction = await predictBestDepartureTime(locations, routes, departureTime || '08:00');

    // Create optimization record with AI insights
    const newOptimization = new Optimization({
      name,
      vehicles: vehicleIds,
      locations: locationIds,
      routes,
      totalDistance,
      totalDuration,
      departureTime: departureTime || '08:00',
      aiPrediction: trafficPrediction, // Store AI insights
      incidentAnalysis: incidentAnalysis, // Store incident analysis if present
      algorithmResults: [{
        algorithm: 'Google OR-Tools',
        algorithmKey: 'google-or-tools',
        routes,
        totalDistance,
        totalDuration,
        executionTime: 0
      }],
      selectedAlgorithm: 'google-or-tools'
    });

    const optimization = await newOptimization.save();

    // Populate the response
    const populatedOptimization = await Optimization.findById(optimization._id)
      .populate('vehicles')
      .populate('locations');

    res.json(populatedOptimization);
  } catch (err) {
    console.error('Optimization error:', err.message);
    res.status(500).json({ 
      msg: 'OR-Tools optimization failed', 
      error: err.message 
    });
  }
};

// Delete optimization
exports.deleteOptimization = async (req, res) => {
  try {
    const optimization = await Optimization.findById(req.params.id);
    
    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    
    await Optimization.deleteOne({ _id: req.params.id });
    res.json({ msg: 'Optimization removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    res.status(500).send('Server error');
  }
};

// Google OR-Tools optimization implementation with real road data
async function runORToolsOptimization(vehicles, locations, depot, trafficMultiplier = 1.0, departureTime = '08:00', incidentLocation = null, fixedDelayMinutes = 0) {
  const toId = (objId) => objId.toString();
  const depotId = toId(depot._id);
  const nonDepot = locations.filter((l) => toId(l._id) !== depotId);

  // Fetch real road distance and duration matrices
  const roadData = await getRoadMatrix(locations);
  const { distanceMatrix, durationMatrix } = roadData || calculateFallbackMatrix(locations);

  // Apply traffic multiplier for incident simulation (usually 1.0 when using fixed delay)
  const adjustedDurationMatrix = durationMatrix.map(row => 
    row.map(duration => duration * trafficMultiplier)
  );

  if (trafficMultiplier > 1.0) {
    // Traffic multiplier applied for incident simulation
  }
  
  if (fixedDelayMinutes > 0) {
    // Fixed delay will be added to route
  }

  // Build location index map
  const locationIndexMap = {};
  locations.forEach((loc, idx) => {
    locationIndexMap[toId(loc._id)] = idx;
  });

  const depotIndex = locationIndexMap[depotId];

  // Expand vehicles by count
  const vehicleSlots = [];
  vehicles.forEach((v) => {
    const count = v.count || 1;
    for (let i = 0; i < count; i++) {
      vehicleSlots.push({
        _id: v._id,
        name: v.name,
        capacity: v.capacity || 0,
        used: false,
        currentLoad: 0
      });
    }
  });

  // Simple greedy nearest neighbor algorithm using real road data
  const routes = [];
  const assigned = new Set();

  for (const vs of vehicleSlots) {
    let remaining = vs.capacity;
    const rtStops = [
      {
        locationId: depot._id,
        locationName: depot.name,
        latitude: depot.latitude,
        longitude: depot.longitude,
        demand: depot.demand || 0,
        order: 0,
        cumulativeDistance: 0,
        distanceFromPrev: 0,
        arrivalTime: 0,
        eta: '8:00 AM' // Start time
      },
    ];

    let currentIndex = depotIndex;
    let order = 1;

    while (true) {
      // Find nearest unassigned location within capacity using REAL road distances
      let best = null;
      let bestD = Infinity;
      let bestIndex = -1;
      
      for (const loc of nonDepot) {
        const locId = toId(loc._id);
        if (assigned.has(locId)) continue;
        if ((loc.demand || 0) > remaining) continue;
        
        const locIndex = locationIndexMap[locId];
        const d = distanceMatrix[currentIndex][locIndex]; // Use REAL road distance
        
        if (d < bestD) {
          bestD = d;
          best = loc;
          bestIndex = locIndex;
        }
      }
      
      if (!best) break;

      rtStops.push({
        locationId: best._id,
        locationName: best.name,
        latitude: best.latitude,
        longitude: best.longitude,
        demand: best.demand || 0,
        order: order++,
        cumulativeDistance: 0, // Will be calculated below
        distanceFromPrev: 0, // Will be calculated below
        arrivalTime: null, // Will be calculated below
        eta: null // Will be calculated below
      });
      
      remaining -= best.demand || 0;
      assigned.add(toId(best._id));
      currentIndex = bestIndex;
    }

    // Close route if it has stops
    if (rtStops.length > 1) {
      rtStops.push({
        locationId: depot._id,
        locationName: depot.name,
        latitude: depot.latitude,
        longitude: depot.longitude,
        demand: depot.demand || 0,
        order: order,
        cumulativeDistance: 0, // Will be calculated below
        distanceFromPrev: 0, // Will be calculated below
        arrivalTime: null, // Will be calculated below
        eta: null // Will be calculated below
      });

      // Calculate cumulative distance and arrival times using REAL road data
      let cumulativeDist = 0;
      let cumulativeTime = 0; // in minutes
      
      for (let i = 0; i < rtStops.length; i++) {
        let distanceFromPrev = 0;
        let timeFromPrev = 0;
        
        if (i > 0) {
          const prevId = toId(rtStops[i - 1].locationId);
          const currId = toId(rtStops[i].locationId);
          const prevIndex = locationIndexMap[prevId];
          const currIndex = locationIndexMap[currId];
          
          // Use REAL road distance and duration from matrix
          distanceFromPrev = distanceMatrix[prevIndex][currIndex];
          timeFromPrev = adjustedDurationMatrix[prevIndex][currIndex]; // Use adjusted duration
          
          // Add service time for non-depot stops
          if (i < rtStops.length - 1) { // Not the return to depot
            timeFromPrev += SERVICE_TIME_MINUTES;
          }
          
          cumulativeDist += distanceFromPrev;
          cumulativeTime += timeFromPrev;
        }
        
        rtStops[i].cumulativeDistance = parseFloat(cumulativeDist.toFixed(2));
        rtStops[i].distanceFromPrev = parseFloat(distanceFromPrev.toFixed(2));
        rtStops[i].arrivalTime = Math.round(cumulativeTime);
        
        // Format ETA as time string (using user-selected departure time)
        const [startHour, startMinute] = departureTime.split(':').map(Number);
        const totalMinutesFromStart = Math.round(cumulativeTime);
        const etaMinutes = (startHour * 60 + startMinute + totalMinutesFromStart);
        const etaHour = Math.floor(etaMinutes / 60) % 24;
        const etaMinute = etaMinutes % 60;
        const displayHour = etaHour > 12 ? etaHour - 12 : (etaHour === 0 ? 12 : etaHour);
        const ampm = etaHour >= 12 ? 'PM' : 'AM';
        rtStops[i].eta = `${displayHour}:${etaMinute.toString().padStart(2, '0')} ${ampm}`;
      }

      const totalDist = cumulativeDist;
      let duration = Math.round(cumulativeTime);
      
      // Add fixed delay if incident is active (only to first route)
      if (fixedDelayMinutes > 0 && routes.length === 0) {
        duration += fixedDelayMinutes;
        // Fixed delay added to route duration
      }

      // Fetch route geometry from Mapbox Directions API with incident exclusion
      const geometry = await getRouteGeometry(rtStops, incidentLocation);

      routes.push({
        vehicle: vs._id,
        vehicleName: vs.name,
        stops: rtStops,
        distance: totalDist,
        duration,
        totalCapacity: vs.capacity - remaining,
        geometry: geometry ? {
          type: 'LineString',
          coordinates: geometry
        } : null,
        usingRealRoadData: roadData?.success || false // Flag to indicate data source
      });
    }

    // Stop if all locations assigned
    if (assigned.size === nonDepot.length) break;
  }

  return routes;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
      typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.warn('Invalid coordinates:', { lat1, lon1, lat2, lon2 });
    return 0;
  }

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get routed polyline (placeholder for future OSRM integration)
exports.getRoutedPolyline = async (req, res) => {
  try {
    const { id, routeIndex } = req.params;
    const optimization = await Optimization.findById(id);
    
    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }
    
    const route = optimization.routes[Number(routeIndex)];
    if (!route) {
      return res.status(404).json({ msg: 'Route not found' });
    }

    // Return straight-line route for now
    const coordinates = route.stops.map(stop => [stop.longitude, stop.latitude]);
    
    res.json({
      geometry: {
        type: 'LineString',
        coordinates
      },
      distanceKm: route.distance,
      durationMin: Math.round(route.duration / 60),
      fallback: true
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Reroute optimization with incident simulation
exports.rerouteOptimization = async (req, res) => {
  const { id } = req.params;
  const { incidentType, affectedRouteIndex, incidentLocation } = req.body;

  try {
    // Get existing optimization
    const optimization = await Optimization.findById(id)
      .populate('vehicles')
      .populate('locations');

    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }

    // Use incident location from frontend (exact point on route line)
    let finalIncidentLocation = null;
    
    if (incidentLocation && incidentLocation.latitude && incidentLocation.longitude) {
      // Frontend provided exact location on route
      finalIncidentLocation = {
        latitude: incidentLocation.latitude,
        longitude: incidentLocation.longitude
      };
    } else {
      // Fallback: Calculate midpoint between depot and first stop
      if (optimization.routes && optimization.routes.length > 0) {
        const firstRoute = optimization.routes[0];
        if (firstRoute.stops && firstRoute.stops.length >= 2) {
          const depot = firstRoute.stops[0];
          const firstStop = firstRoute.stops[1];
          
          const midLat = (depot.latitude + firstStop.latitude) / 2;
          const midLng = (depot.longitude + firstStop.longitude) / 2;
          
          finalIncidentLocation = {
            latitude: midLat,
            longitude: midLng
          };
        }
      }
    }

    // Get AI analysis of incident (returns fixed delay in minutes)
    const incidentAnalysis = await analyzeIncidentImpact(
      incidentType,
      affectedRouteIndex || 0,
      optimization.routes
    );

    const fixedDelayMinutes = incidentAnalysis.fixedDelayMinutes || 60;

    // Find depot
    const depot = optimization.locations.find(loc => loc.isDepot);
    if (!depot) {
      return res.status(400).json({ msg: 'Depot not found' });
    }

    // Store original routes for comparison
    const originalRoutes = optimization.routes;
    const originalDuration = optimization.totalDuration;

    // Re-run optimization with fixed delay and incident location
    const newRoutes = await runORToolsOptimization(
      optimization.vehicles,
      optimization.locations,
      depot,
      1.0, // No multiplier - we use fixed delay instead
      optimization.departureTime || '08:00',
      finalIncidentLocation,
      fixedDelayMinutes // Pass fixed delay to add to route
    );

    // Calculate new metrics
    let totalDistance = 0;
    let totalDuration = 0;

    newRoutes.forEach(route => {
      totalDistance += route.distance || 0;
      totalDuration += route.duration || 0;
    });

    // The delay is the fixed delay from AI (not calculated from difference)
    const delayMinutes = fixedDelayMinutes;

    // Check if alternative route was found by comparing geometries
    let noAlternativeRoute = false;
    if (originalRoutes.length > 0 && newRoutes.length > 0) {
      const originalGeometry = JSON.stringify(originalRoutes[0].geometry?.coordinates || []);
      const newGeometry = JSON.stringify(newRoutes[0].geometry?.coordinates || []);
      noAlternativeRoute = originalGeometry === newGeometry;
    }

    // Update optimization
    optimization.routes = newRoutes;
    optimization.totalDistance = totalDistance;
    optimization.totalDuration = totalDuration;
    optimization.isIncidentActive = true;
    optimization.incidentLocation = finalIncidentLocation;
    optimization.originalRoutes = originalRoutes;
    optimization.incidentAnalysis = {
      ...incidentAnalysis,
      delayMinutes,
      reroutedAt: new Date(),
      originalDuration,
      incidentType,
      noAlternativeRoute
    };

    await optimization.save();

    // Populate and return
    const updatedOptimization = await Optimization.findById(id)
      .populate('vehicles')
      .populate('locations');

    res.json(updatedOptimization);
  } catch (err) {
    console.error('Reroute error:', err.message);
    res.status(500).json({ 
      msg: 'Rerouting failed', 
      error: err.message 
    });
  }
};

// Resolve incident and restore original routes
exports.resolveIncident = async (req, res) => {
  const { id } = req.params;

  try {
    // Get existing optimization
    const optimization = await Optimization.findById(id)
      .populate('vehicles')
      .populate('locations');

    if (!optimization) {
      return res.status(404).json({ msg: 'Optimization not found' });
    }

    if (!optimization.isIncidentActive) {
      return res.status(400).json({ msg: 'No active incident to resolve' });
    }

    // Find depot
    const depot = optimization.locations.find(loc => loc.isDepot);
    if (!depot) {
      return res.status(400).json({ msg: 'Depot not found' });
    }

    // Re-run optimization WITHOUT traffic multiplier (normal conditions)
    const normalRoutes = await runORToolsOptimization(
      optimization.vehicles,
      optimization.locations,
      depot,
      1.0, // No multiplier - normal traffic
      optimization.departureTime || '08:00'
    );

    // Calculate metrics
    let totalDistance = 0;
    let totalDuration = 0;

    normalRoutes.forEach(route => {
      totalDistance += route.distance || 0;
      totalDuration += route.duration || 0;
    });

    // Update optimization
    optimization.routes = normalRoutes;
    optimization.totalDistance = totalDistance;
    optimization.totalDuration = totalDuration;
    optimization.isIncidentActive = false;
    optimization.incidentLocation = null;
    optimization.detourLocation = null; // Clear ghost waypoint
    optimization.originalRoutes = undefined;
    optimization.incidentAnalysis = {
      ...optimization.incidentAnalysis,
      resolvedAt: new Date(),
      resolved: true
    };

    await optimization.save();

    // Populate and return
    const updatedOptimization = await Optimization.findById(id)
      .populate('vehicles')
      .populate('locations');

    res.json(updatedOptimization);
  } catch (err) {
    console.error('Resolve incident error:', err.message);
    res.status(500).json({ 
      msg: 'Failed to resolve incident', 
      error: err.message 
    });
  }
};
