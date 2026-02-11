import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import VehicleService from '../services/vehicle.service';
import LocationService from '../services/location.service';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import { useToast } from '../components/ToastProvider';
import '../styles/NewOptimization.css';

const NewOptimization = () => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [departureTime, setDepartureTime] = useState('08:00');
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [selectAllLocations, setSelectAllLocations] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [vehiclesRes, locationsRes] = await Promise.all([
        VehicleService.getAll(),
        LocationService.getAll()
      ]);

      setVehicles(vehiclesRes || []);
      setLocations(locationsRes || []);
    } catch (err) {
      const errorMsg = 'Failed to load data';
      setError(errorMsg);
      notify(errorMsg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVehicleSelect = (vehicleId) => {
    if (selectedVehicles.includes(vehicleId)) {
      setSelectedVehicles(selectedVehicles.filter(id => id !== vehicleId));
    } else {
      setSelectedVehicles([...selectedVehicles, vehicleId]);
    }
  };

  const handleLocationSelect = (locationId) => {
    if (selectedLocations.includes(locationId)) {
      setSelectedLocations(selectedLocations.filter(id => id !== locationId));
    } else {
      setSelectedLocations([...selectedLocations, locationId]);
    }
  };

  // Update selectAllLocations when selectedLocations changes
  useEffect(() => {
    if (locations.length > 0) {
      setSelectAllLocations(selectedLocations.length === locations.length);
    }
  }, [selectedLocations, locations]);

  const handleSelectAllLocations = useCallback(() => {
    if (selectAllLocations) {
      setSelectedLocations([]);
      setSelectAllLocations(false);
    } else {
      setSelectedLocations(locations.map(loc => loc._id));
      setSelectAllLocations(true);
    }
  }, [selectAllLocations, locations]);

  const handleNextStep = useCallback(() => {
    if (step === 1 && selectedVehicles.length === 0) {
      setError('Please select at least one vehicle');
      return;
    }

    if (step === 2 && selectedLocations.length === 0) {
      setError('Please select at least one location');
      return;
    }

    setError('');
    setStep(step + 1);
  }, [step, selectedVehicles.length, selectedLocations.length]);

  const handlePrevStep = useCallback(() => {
    setStep(s => s - 1);
  }, []);

  // Keyboard shortcuts for better interactivity
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+A to select all locations in step 2
      if (event.ctrlKey && event.key === 'a' && step === 2) {
        event.preventDefault();
        handleSelectAllLocations();
        notify(selectAllLocations ? 'All locations deselected' : 'All locations selected', 'info', { autoClose: 1500 });
      }

      // Enter to proceed to next step
      if (event.key === 'Enter' && step < 3) {
        event.preventDefault();
        handleNextStep();
      }

      // Escape to go back to previous step
      if (event.key === 'Escape' && step > 1) {
        event.preventDefault();
        handlePrevStep();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [step, selectAllLocations, locations, selectedLocations, selectedVehicles, notify, handleNextStep, handlePrevStep, handleSelectAllLocations]);

  const handleOptimize = async () => {
    // Enhanced validation with user feedback
    if (!name.trim()) {
      const errorMsg = 'Please enter a name for this optimization';
      setError(errorMsg);
      notify(errorMsg, 'error');
      return;
    }

    if (selectedVehicles.length === 0) {
      const errorMsg = 'Please select at least one vehicle';
      setError(errorMsg);
      notify(errorMsg, 'error');
      return;
    }

    if (selectedLocations.length === 0) {
      const errorMsg = 'Please select at least one location';
      setError(errorMsg);
      notify(errorMsg, 'error');
      return;
    }

    // Additional validation: Check if there's at least one depot
    const hasDepot = locations.some(loc => selectedLocations.includes(loc._id) && loc.isDepot);
    if (!hasDepot) {
      const errorMsg = 'Please select at least one depot location';
      setError(errorMsg);
      notify(errorMsg, 'error');
      return;
    }

    try {
      setOptimizing(true);
      setError('');

      const optimizationData = {
        name: name.trim(),
        vehicleIds: selectedVehicles,
        locationIds: selectedLocations,
        departureTime,
        algorithm: 'google-or-tools' // Hardcoded to use OR-Tools only
      };

      notify('Starting Google OR-Tools optimization...', 'info', { autoClose: 3000 });

      const response = await OptimizationService.create(optimizationData);

      notify('Route optimization completed successfully!', 'success', { autoClose: 5000 });
      navigate(`/optimizations/${response._id}`);
    } catch (err) {
      console.error('Optimization error:', err);

      let errorMsg = 'Optimization failed. Please try again.';
      let shouldRetry = false;

      if (err.response) {
        // Server responded with error
        const status = err.response.status;
        const serverMsg = err.response.data?.msg;

        switch (status) {
          case 400:
            errorMsg = serverMsg || 'Invalid input data. Please check your selections and try again.';
            break;
          case 403:
            errorMsg = 'Access denied. You may not have permission to perform this action.';
            break;
          case 404:
            errorMsg = 'Service not found. Please check your connection.';
            shouldRetry = true;
            break;
          case 429:
            errorMsg = 'Too many requests. Please wait a moment and try again.';
            shouldRetry = true;
            break;
          case 500:
            errorMsg = 'Server error occurred. Our team has been notified.';
            shouldRetry = true;
            break;
          case 502:
          case 503:
          case 504:
            errorMsg = 'Service temporarily unavailable. Please try again in a few moments.';
            shouldRetry = true;
            break;
          default:
            errorMsg = serverMsg || `Request failed with status ${status}`;
        }
      } else if (err.request) {
        // Network error
        errorMsg = 'Network error. Please check your internet connection and try again.';
        shouldRetry = true;
      } else {
        // Other error
        errorMsg = err.message || 'An unexpected error occurred.';
      }

      setError(errorMsg);
      notify(errorMsg, 'error', { autoClose: shouldRetry ? 10000 : 8000 });

      // If it's a retryable error, suggest retrying
      if (shouldRetry) {
        setTimeout(() => {
          notify('You can try again now.', 'info', { autoClose: 5000 });
        }, 3000);
      }
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="new-optimization-container container mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1>New Optimization</h1>
        <div className="help-tooltip">
          <button
            className="help-button"
            onClick={() => notify(
              'Keyboard shortcuts:\n• Ctrl+A: Select/Deselect all locations\n• Enter: Next step\n• Escape: Previous step',
              'info',
              { autoClose: 8000 }
            )}
            title="Show keyboard shortcuts"
          >
            ❓
          </button>
        </div>
      </div>
      
      <div className="stepper">
        <div className={`step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Vehicles</div>
        </div>
        <div className={`step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Select Locations</div>
        </div>
        <div className={`step ${step === 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Optimize</div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="step-content">
        {step === 1 && (
          <div className="step-vehicles">
            <h2>Select Vehicles</h2>
            {vehicles.length === 0 ? (
              <div className="no-data">
                <p>No vehicles found. Please add vehicles first.</p>
                <button
                  className="btn btn-primary rounded-lg px-4 py-2"
                  onClick={() => navigate('/vehicles/add')}
                >
                  Add Vehicle
                </button>
              </div>
            ) : (
              <div className="vehicles-grid">
                {vehicles && vehicles.map(vehicle => (
                  <div
                    key={vehicle._id}
                    className={`vehicle-card ${selectedVehicles.includes(vehicle._id) ? 'selected' : ''}`}
                    onClick={() => handleVehicleSelect(vehicle._id)}
                  >
                    <div className="vehicle-icon">
                      <i className="fas fa-truck"></i>
                    </div>
                    <div className="vehicle-details">
                      <h3>{vehicle.name}</h3>
                      <p>
                        <strong>Capacity:</strong> {vehicle.capacity}
                      </p>
                      <p>
                        <strong>Count:</strong> {vehicle.count}
                      </p>
                    </div>
                    <div className="vehicle-select">
                      <input
                        type="checkbox"
                        checked={selectedVehicles.includes(vehicle._id)}
                        onChange={() => {}}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="step-locations">
            <div className="flex justify-between items-center mb-4">
              <h2>Select Locations</h2>
              <div className="location-stats">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {selectedLocations.length} of {locations.length} selected
                </span>
              </div>
            </div>
            {locations.length === 0 ? (
              <div className="no-data">
                <p>No locations found. Please add locations first.</p>
                <button
                  className="btn btn-primary rounded-lg px-4 py-2"
                  onClick={() => navigate('/locations/add')}
                >
                  Add Location
                </button>
              </div>
            ) : (
              <>
                <div className="map-wrapper">
                  <Map
                    locations={locations.filter(loc => selectedLocations.includes(loc._id))}
                  />
                </div>
                <div className="locations-list">
                  <table className="locations-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={selectAllLocations}
                            onChange={handleSelectAllLocations}
                          />
                        </th>
                        <th>Name</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Demand</th>
                        <th>Depot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locations && locations.map(location => (
                        <tr
                          key={location._id}
                          className={selectedLocations.includes(location._id) ? 'selected' : ''}
                          onClick={() => handleLocationSelect(location._id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedLocations.includes(location._id)}
                              onChange={() => {}}
                            />
                          </td>
                          <td>{location.name}</td>
                          <td>{Number(location?.latitude ?? 0).toFixed(6)}</td>
                          <td>{Number(location?.longitude ?? 0).toFixed(6)}</td>
                          <td>{location.demand || 0}</td>
                          <td>{location.isDepot ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="step-optimize">
            <h2>Optimize Routes</h2>
            <div className="optimization-summary">
              <div className="form-group">
                <label htmlFor="name">Optimization Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g., Weekly Delivery Route"
                />
              </div>

              <div className="form-group">
                <label htmlFor="departureTime">
                  <i className="fas fa-clock"></i> Departure Time
                </label>
                <input
                  type="time"
                  id="departureTime"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  required
                  className="time-input"
                />
                <small className="text-gray-500 dark:text-gray-400">
                  Select when you want to start the delivery route. AI will analyze this time for traffic patterns.
                </small>
              </div>

              <div className="summary-info-box">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Algorithm:</strong> Google OR-Tools (Advanced)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Using Google's state-of-the-art optimization engine for best results.
                </p>
              </div>
              
              <div className="summary-section">
                <h3>Selected Vehicles ({selectedVehicles.length})</h3>
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Vehicle Capacity:</span>
                    <span className="stat-value">
                      {vehicles && vehicles
                        .filter(v => selectedVehicles.includes(v._id))
                        .reduce((total, v) => total + ((v.capacity || 0) * (v.count || 1)), 0)} units
                    </span>
                  </div>
                </div>
                <ul>
                  {vehicles && vehicles
                    .filter(v => selectedVehicles.includes(v._id))
                    .map(vehicle => (
                      <li key={vehicle._id}>
                        {vehicle.name} - Capacity: {vehicle.capacity}, Count: {vehicle.count}
                      </li>
                    ))}
                </ul>
              </div>

              <div className="summary-section">
                <h3>Selected Locations ({selectedLocations.length})</h3>
                <div className="summary-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Location Demand:</span>
                    <span className="stat-value">
                      {locations && locations
                        .filter(l => selectedLocations.includes(l._id))
                        .reduce((total, l) => total + (l.demand || 0), 0)} units
                    </span>
                  </div>
                </div>
                <ul>
                  {locations && locations
                    .filter(l => selectedLocations.includes(l._id))
                    .map(location => (
                      <li key={location._id}>
                        {location.name} - Demand: {location.demand || 0}
                        {location.isDepot && ' (Depot)'}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="step-actions">
        {step > 1 && (
          <button className="btn btn-secondary rounded-lg px-4 py-2" onClick={handlePrevStep}>
            Previous
          </button>
        )}
        
        {step < 3 ? (
          <button className="btn btn-primary rounded-lg px-4 py-2" onClick={handleNextStep}>
            Next
          </button>
        ) : (
          <button
            className="btn btn-success rounded-lg px-4 py-2"
            onClick={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? 'Optimizing with OR-Tools...' : 'Run Optimization'}
          </button>
        )}
      </div>
    </div>
  );
};

export default NewOptimization;