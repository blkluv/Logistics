import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import '../styles/OptimizationDetail.css';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { useToast } from '../components/ToastProvider';
const OptimizationDetail = () => {
  const { id } = useParams();
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [resolving, setResolving] = useState(false);
  
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('routes');
  const { notify } = useToast();

  useEffect(() => {
    fetchOptimization();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchOptimization = async () => {
    try {
      setLoading(true);
      const response = await OptimizationService.get(id);
      setOptimization(response);
      setError('');
    } catch (err) {
      setError('Failed to load optimization details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = () => {
    if (!optimization) return;
    
    try {
      // Calculate fresh total duration from current routes (includes incident delays)
      const totalDuration = optimization.routes 
        ? optimization.routes.reduce((sum, route) => sum + (route.duration || 0), 0)
        : 0;

      // Strip geometry from routes to reduce file size
      const cleanedRoutes = optimization.routes 
        ? optimization.routes.map(route => {
            // Create a copy of the route without geometry
            const { geometry, ...routeWithoutGeometry } = route;
            return routeWithoutGeometry;
          })
        : [];

      // Create a clean copy of the optimization data
      const exportData = {
        id: optimization._id,
        name: optimization.name,
        date: optimization.date,
        departureTime: optimization.departureTime,
        totalDistance: optimization.totalDistance,
        totalDuration: totalDuration, // Use calculated duration
        vehicles: optimization.vehicles,
        locations: optimization.locations,
        routes: cleanedRoutes, // Use cleaned routes without geometry
        algorithm: 'Google OR-Tools',
        aiPrediction: optimization.aiPrediction,
        incidentAnalysis: optimization.incidentAnalysis
      };

      // Convert to JSON string with formatting
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create blob
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `route-optimization-${optimization._id}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      notify('Optimization exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      notify('Failed to export optimization', 'error');
    }
  };

  const handleSimulateIncident = async () => {
    if (!optimization || !optimization._id) {
      notify('No optimization loaded', 'error');
      return;
    }
    
    if (optimization.isIncidentActive) {
      notify('An incident is already active. Resolve it first.', 'warning');
      return;
    }
    
    try {
      setRerouting(true);
      notify('⚠️ Simulating traffic incident...', 'info', { autoClose: 2000 });
      
      // Get the first route's geometry to place incident on actual road
      const firstRoute = optimization.routes?.[0];
      let incidentLocation = null;
      
      if (firstRoute && firstRoute.geometry && firstRoute.geometry.coordinates && firstRoute.geometry.coordinates.length > 0) {
        // Pick the exact middle point on the route line
        const geometryCoordinates = firstRoute.geometry.coordinates;
        const midIndex = Math.floor(geometryCoordinates.length / 2);
        const midPoint = geometryCoordinates[midIndex];
        
        // midPoint is [lng, lat] in GeoJSON format
        incidentLocation = {
          longitude: midPoint[0],
          latitude: midPoint[1]
        };
        
      } else {
        // Fallback: Use midpoint between depot and first stop
        if (firstRoute && firstRoute.stops && firstRoute.stops.length >= 2) {
          const depot = firstRoute.stops[0];
          const firstStop = firstRoute.stops[1];
          
          incidentLocation = {
            longitude: (depot.longitude + firstStop.longitude) / 2,
            latitude: (depot.latitude + firstStop.latitude) / 2
          };
          
        }
      }
      
      // Call reroute API with incident location (or without if not available)
      const requestData = {
        incidentType: 'ACCIDENT',
        affectedRouteIndex: 0
      };
      
      if (incidentLocation) {
        requestData.incidentLocation = incidentLocation;
      }
      
      const response = await OptimizationService.reroute(optimization._id, requestData);
      
      // Update optimization with new routes
      setOptimization(response);
      
      // Wait a bit before showing success to avoid overlap
      setTimeout(() => {
        notify('✅ Route recalculated with traffic incident!', 'success', { autoClose: 4000 });
      }, 500);
      
    } catch (error) {
      console.error('Reroute error:', error);
      console.error('Error details:', error.response);
      
      const errorMsg = error.response?.data?.msg 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to recalculate route';
      
      notify(`❌ ${errorMsg}`, 'error', { autoClose: 5000 });
    } finally {
      setRerouting(false);
    }
  };

  const handleResolveIncident = async () => {
    if (!optimization || !optimization._id) {
      notify('No optimization loaded', 'error');
      return;
    }
    
    if (!optimization.isIncidentActive) {
      notify('No active incident to resolve', 'warning');
      return;
    }
    
    try {
      setResolving(true);
      notify('🔄 Resolving incident and restoring normal routes...', 'info', { autoClose: 2000 });
      
      // Call resolve API
      const response = await OptimizationService.resolveIncident(optimization._id);
      
      // Update optimization with restored routes
      setOptimization(response);
      
      // Wait a bit before showing success
      setTimeout(() => {
        notify('✅ Incident resolved! Routes restored to normal.', 'success', { autoClose: 4000 });
      }, 500);
      
    } catch (error) {
      console.error('Resolve error:', error);
      console.error('Error details:', error.response);
      
      const errorMsg = error.response?.data?.msg 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to resolve incident';
      
      notify(`❌ ${errorMsg}`, 'error', { autoClose: 5000 });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="optimization-detail-container">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="optimization-detail-container">
        <div className="alert alert-danger">
          {error || 'Optimization not found'}
        </div>
        <Link to="/optimizations" className="btn btn-primary">
          Back to Optimizations
        </Link>
      </div>
    );
  }


return (
  <div className="optimization-detail-container container mx-auto px-6 py-8">
    <div className="optimization-header">
      <div>
        <h1>{optimization.name}</h1>
        <p className="optimization-date">
          <i className="fas fa-calendar"></i>{' '}
          {new Date(optimization.date).toLocaleDateString()}
        </p>
      </div>
      <div className="optimization-actions">
        <button className="btn btn-secondary rounded-lg px-4 py-2" onClick={handleExportJSON}>
          <i className="fas fa-download"></i> Export JSON
        </button>
        <Link to={`/optimizations/${optimization._id}/print`} className="btn btn-outline rounded-lg px-4 py-2">
          <i className="fas fa-print"></i> Print Route Sheets
        </Link>
        <Link to="/optimizations" className="btn btn-primary rounded-lg px-4 py-2">
          Back to List
        </Link>
      </div>
    </div>

    <div className="optimization-summary">
      <div className="summary-card" data-aos="fade-up">
        <div className="summary-icon">
          <i className="fas fa-route"></i>
        </div>
        <div className="summary-content">
          <h3>Routes</h3>
          <p className="summary-value">{optimization.routes.length}</p>
        </div>
      </div>
      <div className="summary-card" data-aos="fade-up" data-aos-delay="50">
        <div className="summary-icon">
          <i className="fas fa-cogs"></i>
        </div>
        <div className="summary-content">
          <h3>Algorithm</h3>
          <p className="summary-value">Google OR-Tools</p>
          <small className="text-xs text-gray-500">AI-Powered</small>
        </div>
      </div>
      <div className="summary-card" data-aos="fade-up" data-aos-delay="100">
        <div className="summary-icon">
          <i className="fas fa-road"></i>
        </div>
        <div className="summary-content">
          <h3>Total Distance</h3>
          <p className="summary-value">
            {Number(optimization?.totalDistance ?? 0).toFixed(2)} km
          </p>
          {optimization.routes && optimization.routes.some(r => r.usingRealRoadData) && (
            <small className="text-xs text-green-600">Real road data</small>
          )}
        </div>
      </div>
      <div className="summary-card" data-aos="fade-up" data-aos-delay="150">
        <div className="summary-icon">
          <i className="fas fa-truck"></i>
        </div>
        <div className="summary-content">
          <h3>Utilization</h3>
          <p className="summary-value">
            {(() => {
              const vehCount = (optimization.vehicles || []).length || 1;
              const used = new Set((optimization.routes || []).map(r => r.vehicle).filter(Boolean)).size;
              return `${used}/${vehCount} vehicles used`;
            })()}
          </p>
        </div>
      </div>
    </div>

    <div className="analytics-section mt-6 grid md:grid-cols-4 gap-4" data-aos="fade-up">
      {(() => {
        const routes = optimization.routes || [];
        const distances = routes.map(r => Number((r.distance ?? r.totalDistance) ?? 0));
        const totalStops = routes.reduce((s, r) => s + (r.stops?.length || 0), 0);
        const totalDistance = distances.reduce((a, b) => a + b, 0);
        const avgDistance = routes.length ? (totalDistance / routes.length) : 0;

        // Calculate load efficiency
        const totalCapacity = routes.reduce((sum, route) => {
          const vehicle = optimization.vehicles?.find(v => v._id === route.vehicle);
          return sum + (vehicle?.capacity || 0);
        }, 0);
        const totalLoad = routes.reduce((sum, route) => sum + (route.totalCapacity || 0), 0);
        const loadEfficiency = totalCapacity > 0 ? ((totalLoad / totalCapacity) * 100) : 0;

        // Calculate vehicle utilization
        const usedVehicles = new Set(routes.map(r => r.vehicle).filter(Boolean)).size;
        const totalVehicles = optimization.vehicles?.length || 0;
        const vehicleUtilization = totalVehicles > 0 ? ((usedVehicles / totalVehicles) * 100) : 0;

        return (
          <>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Stops</div>
              <div className="text-2xl font-bold">{totalStops}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400">Load Efficiency</div>
              <div className="text-2xl font-bold text-green-600">{loadEfficiency.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">{totalLoad}/{totalCapacity} units</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400">Vehicle Utilization</div>
              <div className="text-2xl font-bold text-blue-600">{vehicleUtilization.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">{usedVehicles}/{totalVehicles} vehicles</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Distance/Route</div>
              <div className="text-2xl font-bold">{avgDistance.toFixed(2)} km</div>
            </div>
          </>
        );
      })()}
    </div>

    {/* AI Traffic Prediction Card */}
    {optimization.aiPrediction && optimization.aiPrediction.success && (
      <div className="mt-6 rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 shadow-sm" data-aos="fade-up">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🤖</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
              AI Traffic Prediction
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Recommended Departure Time</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {optimization.aiPrediction.bestTime}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Traffic: {optimization.aiPrediction.trafficRating} • Confidence: {optimization.aiPrediction.confidence}
                </div>
              </div>
              <div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Estimated Time Savings</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {optimization.aiPrediction.estimatedSavingsMinutes} min
                </div>
                {optimization.aiPrediction.alternativeTime && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Alternative: {optimization.aiPrediction.alternativeTime}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <strong>AI Insight:</strong> {optimization.aiPrediction.reasoning}
              </div>
              {optimization.aiPrediction.avoidTimes && optimization.aiPrediction.avoidTimes.length > 0 && (
                <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-3 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  <span>Avoid: {optimization.aiPrediction.avoidTimes.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Incident Analysis Card */}
    {optimization.incidentAnalysis && optimization.incidentAnalysis.success && (
      <div className={`mt-6 rounded-xl border p-6 shadow-sm ${
        optimization.incidentAnalysis.resolved 
          ? 'border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
          : 'border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20'
      }`} data-aos="fade-up">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{optimization.incidentAnalysis.resolved ? '✅' : '⚠️'}</div>
          <div className="flex-1">
            <h3 className={`text-lg font-bold mb-2 ${
              optimization.incidentAnalysis.resolved 
                ? 'text-green-900 dark:text-green-100'
                : 'text-orange-900 dark:text-orange-100'
            }`}>
              {optimization.incidentAnalysis.resolved ? 'Incident Resolved' : 'Incident Impact Analysis'}
            </h3>
            {!optimization.incidentAnalysis.resolved ? (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Severity</div>
                    <div className="text-xl font-bold text-orange-900 dark:text-orange-100 uppercase">
                      {optimization.incidentAnalysis.severity}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Estimated Delay</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {optimization.incidentAnalysis.delayLabel || `+ ${Math.floor(optimization.incidentAnalysis.delayMinutes / 60)} hr ${optimization.incidentAnalysis.delayMinutes % 60} min`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-orange-700 dark:text-orange-300 mb-1">Traffic Condition</div>
                    <div className="text-xl font-bold text-orange-900 dark:text-orange-100">
                      {optimization.incidentAnalysis.trafficCondition || 'Heavy Congestion'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Recommendation:</strong> {optimization.incidentAnalysis.recommendation}
                  </div>
                  {optimization.incidentAnalysis.noAlternativeRoute && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      ℹ️ No alternative route available. Delay added to current path.
                    </div>
                  )}
                  {optimization.incidentAnalysis.shouldReroute && (
                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                      🔄 Re-routing recommended • Recovery: {optimization.incidentAnalysis.estimatedRecoveryTime}
                    </div>
                  )}
                  {optimization.incidentAnalysis.reroutedAt && (
                    <div className="text-xs text-gray-500 mt-2">
                      Last rerouted: {new Date(optimization.incidentAnalysis.reroutedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  The traffic incident has been cleared and routes have been restored to normal conditions.
                </div>
                {optimization.incidentAnalysis.resolvedAt && (
                  <div className="text-xs text-gray-500 mt-2">
                    Resolved at: {new Date(optimization.incidentAnalysis.resolvedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Reroute Simulation / Resolve Buttons */}
    <div className="mt-6 flex gap-4" data-aos="fade-up">
      {!optimization.isIncidentActive ? (
        <button
          onClick={handleSimulateIncident}
          disabled={rerouting}
          style={{
            background: rerouting 
              ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
              : 'linear-gradient(135deg, #ff6b47, #ff5733)',
            color: 'white',
            padding: '14px 28px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: rerouting ? 'not-allowed' : 'pointer',
            opacity: rerouting ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: rerouting 
              ? '0 4px 12px rgba(107, 114, 128, 0.3)' 
              : '0 4px 12px rgba(255, 87, 51, 0.4)',
            transition: 'all 0.3s ease',
            transform: rerouting ? 'scale(0.98)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            if (!rerouting) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 87, 51, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!rerouting) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 87, 51, 0.4)';
            }
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {rerouting ? '🔄' : '⚠️'}
          </span>
          <span>
            {rerouting ? 'Recalculating Route...' : 'Simulate Road Accident / Reroute'}
          </span>
        </button>
      ) : (
        <button
          onClick={handleResolveIncident}
          disabled={resolving}
          style={{
            background: resolving 
              ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
              : 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            padding: '14px 28px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: resolving ? 'not-allowed' : 'pointer',
            opacity: resolving ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: resolving 
              ? '0 4px 12px rgba(107, 114, 128, 0.3)' 
              : '0 4px 12px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.3s ease',
            transform: resolving ? 'scale(0.98)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            if (!resolving) {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!resolving) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
            }
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {resolving ? '🔄' : '✅'}
          </span>
          <span>
            {resolving ? 'Resolving Incident...' : 'Resolve Incident / Clear Blockage'}
          </span>
        </button>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {!optimization.isIncidentActive 
          ? 'Simulates a traffic incident and recalculates the optimal route with AI analysis'
          : 'Clears the incident and restores normal traffic conditions'
        }
      </p>
    </div>

    <div className="map-wrapper" data-aos="fade-up">
      <Map
        locations={optimization.locations || []}
        routes={optimization.routes || []}
        vehicles={optimization.vehicles || []}
        optimizationId={optimization._id}
        incidentLocation={optimization.incidentLocation || null}
        center={optimization.locations && optimization.locations.length > 0
          ? [optimization.locations[0].latitude, optimization.locations[0].longitude]
          : [22.7196, 75.8577]
        }
        zoom={13}
        height="500px"
      />
    </div>

    <div className="optimization-tabs" data-aos="fade-up">
      <div className="tabs-header">
        <button
          className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          Routes
        </button>
        <button
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
      </div>
      
      <div className="tabs-content">
        {activeTab === 'routes' && (
          <div className="routes-tab">
            {optimization.routes && optimization.routes.map((route, index) => (
              <div key={index} className="route-card rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
                <h3>Route {index + 1} - {route.vehicleName}</h3>
                <div className="chips">
                  <span className="chip">
                    <i className="fa fa-road"></i>
                    {Number((route.distance ?? route.totalDistance) ?? 0).toFixed(2)} km
                    {route.usingRealRoadData && ' (real)'}
                  </span>
                  <span className="chip">
                    <i className="fa fa-clock"></i>
                    {(() => {
                      const duration = route.duration;
                      
                      if (!duration) return 'N/A';
                      
                      const totalMinutes = Math.round(duration);
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      if (hours > 0) {
                        return `${hours} hr ${minutes} min`;
                      }
                      return `${minutes} min`;
                    })()}
                  </span>
                </div>
                <p>
                  <strong>Total Distance:</strong> {Number((route.distance ?? route.totalDistance) ?? 0).toFixed(2)} km
                  {route.usingRealRoadData && ' (real road data)'}
                </p>
                <p>
                  <strong>Total Capacity:</strong> {route.totalCapacity}
                </p>

                <p>
                  <strong>Total Estimated Time:</strong> {(() => {
                    const duration = route.duration;
                    
                    if (!duration) return 'N/A';
                    
                    const totalMinutes = Math.round(duration);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    if (hours > 0) {
                      return `${hours} hr ${minutes} min`;
                    }
                    return `${minutes} min`;
                  })()}
                </p>

                <div className="route-stops">
                  <h4>Stops</h4>
                  <ol className="stops-list">
                    {route.stops.map((stop, stopIndex) => (
                      <li key={stopIndex}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          {/* Stop Number Badge */}
                          <div style={{
                            minWidth: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: stopIndex === 0 || stopIndex === route.stops.length - 1 
                              ? 'linear-gradient(135deg, #FF6B47, #FF5733)'
                              : 'linear-gradient(135deg, #4A6FFF, #3357FF)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            flexShrink: 0
                          }}>
                            {stopIndex + 1}
                          </div>
                          
                          {/* Stop Details */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '500', fontSize: '15px' }}>{stop.locationName}</span>
                              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {stop.demand > 0 && <span className="chip stop-chip">Demand: {stop.demand}</span>}
                                {stopIndex === 0 || stopIndex === route.stops.length - 1 ? (
                                  <span className="badge stop-chip">Depot</span>
                                ) : null}
                              </span>
                            </div>
                            {stopIndex === 0 ? (
                              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>
                                🏁 Start Point - {stop.eta || '8:00 AM'}
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', gap: '12px' }}>
                                <span>
                                  <i className="fa fa-road" style={{ marginRight: '4px' }}></i>
                                  {stop.distanceFromPrev ? `${stop.distanceFromPrev.toFixed(2)} km from prev` : 'N/A'}
                                </span>
                                <span>
                                  <i className="fa fa-clock" style={{ marginRight: '4px' }}></i>
                                  ETA: {stop.eta || 'N/A'}
                                  {(() => {
                                    // Calculate relative time from previous stop
                                    if (stop.eta && route.stops[stopIndex - 1]?.eta) {
                                      try {
                                        const currentETA = new Date(`1970-01-01 ${stop.eta}`);
                                        const prevETA = new Date(`1970-01-01 ${route.stops[stopIndex - 1].eta}`);
                                        let diffMs = currentETA - prevETA;
                                        
                                        // Handle day boundary crossing
                                        if (diffMs < 0) {
                                          diffMs += 24 * 60 * 60 * 1000; // Add 24 hours
                                        }
                                        
                                        const diffMinutes = Math.floor(diffMs / (1000 * 60));
                                        const hours = Math.floor(diffMinutes / 60);
                                        const minutes = diffMinutes % 60;
                                        
                                        if (hours > 0) {
                                          return ` (+${hours} hr ${minutes} min)`;
                                        } else if (minutes > 0) {
                                          return ` (+${minutes} min)`;
                                        }
                                      } catch (e) {
                                        // Silently fail if time parsing fails
                                      }
                                    }
                                    return '';
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {activeTab === 'details' && (
          <div className="details-tab">
            <div className="details-section">
              <h3>Optimization Details</h3>
              <table className="details-table">
                <tbody>
                  <tr>
                    <td>Name</td>
                    <td>{optimization.name}</td>
                  </tr>
                  <tr>
                    <td>Date</td>
                    <td>{new Date(optimization.date).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td>Total Routes</td>
                    <td>{optimization.routes.length}</td>
                  </tr>
                  <tr>
                    <td>Total Distance</td>
                    <td>{Number(optimization?.totalDistance ?? 0).toFixed(2)} km</td>
                  </tr>
                  <tr>
                    <td>Total Stops</td>
                    <td>
                      {optimization.routes.reduce(
                        (total, route) => total + route.stops.length,
                        0
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default OptimizationDetail;