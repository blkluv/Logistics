import React, { useState, useRef, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '../styles/Map.css';

const MapComponent = ({
  locations = [],
  routes = [],
  vehicles = [],
  onLocationSelect,
  onMapClick,
  center = { longitude: 77.1025, latitude: 28.7041 }, // New Delhi
  zoom = 11,
  height = "600px",
  onRouteSelect,
  optimizationId,
  isLoadingRoutes = false,
  incidentLocation = null,
}) => {
  const mapRef = useRef();
  
  // Handle both array [lat, lng] and object { longitude, latitude } formats
  const getCenterCoords = () => {
    if (Array.isArray(center)) {
      return { longitude: center[1], latitude: center[0] };
    }
    return { longitude: center.longitude || 77.1025, latitude: center.latitude || 28.7041 };
  };
  
  const centerCoords = getCenterCoords();
  
  const [viewState, setViewState] = useState({
    longitude: centerCoords.longitude,
    latitude: centerCoords.latitude,
    zoom: zoom || 11
  });

  const routeColors = [
    '#FF5733', '#33FF57', '#3357FF', '#F033FF', '#FF33A8',
    '#33FFF6', '#FFB533', '#BD33FF', '#FF3333', '#33FF33'
  ];

  // State for selected route
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [visibleRoutes, setVisibleRoutes] = useState(new Set(routes.map((_, index) => index)));

  // Get vehicle by ID
  const getVehicleById = (vehicleId) => {
    return vehicles.find(v => v._id === vehicleId) || { name: 'Unknown Vehicle' };
  };

  // Handle map click for adding locations
  const handleMapClick = useCallback((event) => {
    if (onMapClick && event.lngLat) {
      const { lng, lat } = event.lngLat;
      onMapClick({
        longitude: lng,
        latitude: lat,
        lngLat: { lng, lat }
      });
    }
  }, [onMapClick]);

  // Handle route click
  const handleRouteClick = (route, routeIndex) => {
    setSelectedRoute(selectedRoute === routeIndex ? null : routeIndex);
    if (onRouteSelect) {
      onRouteSelect(route, routeIndex);
    }
  };

  // Handle route visibility toggle
  const toggleRouteVisibility = (routeIndex) => {
    const newVisibleRoutes = new Set(visibleRoutes);
    if (newVisibleRoutes.has(routeIndex)) {
      newVisibleRoutes.delete(routeIndex);
    } else {
      newVisibleRoutes.add(routeIndex);
    }
    setVisibleRoutes(newVisibleRoutes);
  };

  // Toggle all routes visibility
  const toggleAllRoutesVisibility = () => {
    if (visibleRoutes.size === routes.length) {
      setVisibleRoutes(new Set());
    } else {
      setVisibleRoutes(new Set(routes.map((_, index) => index)));
    }
  };

  // Convert route to GeoJSON LineString coordinates
  const getRouteGeoJSON = (route, routeIndex) => {
    if (!route.stops || route.stops.length === 0) return null;

    let coordinates = [];

    // Priority 1: Check if route has embedded geometry from backend
    if (route.geometry && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0) {
      coordinates = route.geometry.coordinates;
    }
    // Fallback: Use straight lines between stops with validation
    else {
      for (const stop of route.stops) {
        const location = locations.find(loc => {
          // Handle both string and object IDs
          const stopId = typeof stop.locationId === 'object' ? stop.locationId.toString() : stop.locationId;
          const locId = typeof loc._id === 'object' ? loc._id.toString() : loc._id;
          return stopId === locId;
        });

        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
          coordinates.push([location.longitude, location.latitude]); // GeoJSON uses [lng, lat]
        }
      }
    }

    if (coordinates.length < 2) return null;

    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates
      },
      properties: {
        routeIndex,
        color: routeColors[routeIndex % routeColors.length]
      }
    };
  };

  // Check if route has real road network data
  const hasRealRoadData = (routeIndex) => {
    const route = routes[routeIndex];
    // Check if route has embedded geometry from backend
    return route?.geometry?.coordinates && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 0;
  };

  return (
    <div className="map-wrapper" style={{ height, minHeight: '600px', position: 'relative', width: '100%' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
        mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
        onClick={handleMapClick}
        interactiveLayerIds={routes.map((_, idx) => `route-layer-${idx}`)}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />

        {/* Render route lines */}
        {routes.map((route, routeIndex) => {
          if (!visibleRoutes.has(routeIndex)) return null;

          const geoJSON = getRouteGeoJSON(route, routeIndex);
          if (!geoJSON) return null;

          const color = routeColors[routeIndex % routeColors.length];
          const isSelected = selectedRoute === routeIndex;

          return (
            <Source
              key={`route-source-${routeIndex}`}
              id={`route-${routeIndex}`}
              type="geojson"
              data={geoJSON}
            >
              <Layer
                id={`route-layer-${routeIndex}`}
                type="line"
                paint={{
                  'line-color': isSelected ? '#FFD700' : color,
                  'line-width': isSelected ? 10 : hasRealRoadData(routeIndex) ? 5 : 4,
                  'line-opacity': isSelected ? 1 : hasRealRoadData(routeIndex) ? 0.95 : 0.8,
                  'line-dasharray': hasRealRoadData(routeIndex) ? [1, 0] : [2, 2]
                }}
                layout={{
                  'line-join': 'round',
                  'line-cap': 'round'
                }}
              />
            </Source>
          );
        })}

        {/* Render location markers */}
        {locations.map((location) => (
          <Marker
            key={location._id}
            longitude={location.longitude}
            latitude={location.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onLocationSelect && onLocationSelect(location);
            }}
          >
            <div
              style={{
                width: location.isDepot ? '48px' : '40px',
                height: location.isDepot ? '48px' : '40px',
                background: location.isDepot 
                  ? 'linear-gradient(135deg, #FF6B47, #FF5733)'
                  : 'linear-gradient(135deg, #4A6FFF, #3357FF)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: location.isDepot ? '24px' : '20px',
                fontWeight: 'bold',
                border: '3px solid white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title={location.name}
            >
              {location.isDepot ? '🏭' : '📍'}
            </div>
          </Marker>
        ))}

        {/* Render route stop markers */}
        {routes.map((route, routeIndex) => {
          if (!visibleRoutes.has(routeIndex)) return null;

          return route.stops?.map((stop, stopIndex) => {
            const location = locations.find(loc => {
              const stopId = typeof stop.locationId === 'object' ? stop.locationId.toString() : stop.locationId;
              const locId = typeof loc._id === 'object' ? loc._id.toString() : loc._id;
              return stopId === locId;
            });
            if (!location) return null;

            // Use stop.order for display (1, 2, 3...) instead of stopIndex
            const displayOrder = typeof stop.order === 'number' ? stop.order + 1 : stopIndex + 1;

            return (
              <Marker
                key={`stop-${routeIndex}-${stopIndex}`}
                longitude={location.longitude}
                latitude={location.latitude}
                anchor="bottom"
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'linear-gradient(135deg, #374151, #111827)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                  title={`Stop ${displayOrder}: ${location.name}`}
                >
                  {displayOrder}
                </div>
              </Marker>
            );
          });
        })}

        {/* Render incident marker if active */}
        {incidentLocation && incidentLocation.latitude && incidentLocation.longitude && (
          <Marker
            longitude={incidentLocation.longitude}
            latitude={incidentLocation.latitude}
            anchor="bottom"
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
                border: '4px solid white',
                boxShadow: '0 4px 16px rgba(220, 38, 38, 0.6)',
                animation: 'pulse 2s infinite',
                cursor: 'pointer',
              }}
              title="Traffic Blockage - Incident Location"
            >
              ⚠️
            </div>
          </Marker>
        )}
      </Map>

      {/* Custom Mapbox Attribution */}
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          right: '0',
          background: 'rgba(255, 255, 255, 0.8)',
          padding: '2px 8px',
          fontSize: '10px',
          color: '#333',
          zIndex: 1000,
          borderTopLeftRadius: '4px'
        }}
      >
        © <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener noreferrer" style={{ color: '#333', textDecoration: 'none' }}>Mapbox</a>
      </div>

      {/* Route Summary Overlay */}
      {routes && routes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            maxWidth: '280px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h4 style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>
              Route Summary
            </h4>
            <button
              onClick={toggleAllRoutesVisibility}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {visibleRoutes.size === routes.length ? 'Hide All' : 'Show All'}
            </button>
          </div>
          <div style={{ maxHeight: '250px', overflow: 'auto' }}>
            {routes.map((route, index) => {
              const vehicle = getVehicleById(route.vehicle);
              const color = routeColors[index % routeColors.length];
              const isVisible = visibleRoutes.has(index);

              return (
                <div key={`route-summary-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    padding: '6px',
                    borderRadius: '4px',
                    background: isVisible ? '#f9fafb' : '#f3f4f6',
                    opacity: isVisible ? 1 : 0.6,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleRouteClick(route, index)}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleRouteVisibility(index)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '14px',
                      height: '14px',
                      margin: '0',
                      flexShrink: 0
                    }}
                  />
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      background: color,
                      flexShrink: 0
                    }}
                  />
                  <div style={{ fontSize: '12px', flex: 1 }}>
                    <div style={{ fontWeight: '500' }}>{vehicle.name}</div>
                    <div style={{ color: '#6b7280' }}>
                      {route.stops?.length || 0} stops • {Number(route.distance || 0).toFixed(1)} km
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {isLoadingRoutes && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: '#fef3c7',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#92400e',
              textAlign: 'center'
            }}>
              🔄 Calculating real routes...
            </div>
          )}
        </div>
      )}

      {/* Route Details Panel */}
      {selectedRoute !== null && routes[selectedRoute] && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            maxWidth: '300px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: routeColors[selectedRoute % routeColors.length],
                marginRight: '8px'
              }}
            />
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
              Route {selectedRoute + 1} Details
            </h4>
          </div>

          <div style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Vehicle:</strong> {getVehicleById(routes[selectedRoute].vehicle).name}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Distance:</strong> {Number(routes[selectedRoute].distance || 0).toFixed(2)} km
              {routes[selectedRoute].usingRealRoadData && ' (real road)'}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Duration:</strong> {(() => {
                const duration = routes[selectedRoute].duration;
                
                if (!duration) return 'N/A';
                
                const totalMinutes = Math.round(duration);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                
                if (hours > 0) {
                  return `${hours} hr ${minutes} min`;
                }
                return `${minutes} min`;
              })()}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Stops:</strong> {routes[selectedRoute].stops?.length || 0}
            </div>
            <div>
              <strong>Capacity Used:</strong> {routes[selectedRoute].totalCapacity || 0}
            </div>
          </div>

          <button
            onClick={() => setSelectedRoute(null)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Location Summary */}
      {locations && locations.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            maxWidth: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1000
          }}
        >
          <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
            📍 Locations ({locations.length})
          </h4>
          <div style={{ fontSize: '14px', color: '#4b5563' }}>
            <div style={{ marginBottom: '4px' }}>
              🏭 {locations.filter(loc => loc.isDepot).length} depots
            </div>
            <div>
              📦 {locations.filter(loc => !loc.isDepot).length} delivery stops
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
