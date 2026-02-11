import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import LocationService from '../services/location.service';
import LocationSearch from '../components/LocationSearch';
import { useToast } from '../components/ToastProvider';
import '../styles/Forms.css';

const LocationForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const mapRef = useRef(null);
  const { notify } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    demand: '0',
    isDepot: false
  });
  
  const [viewState, setViewState] = useState({
    longitude: 77.1025,
    latitude: 28.7041,
    zoom: 11
  });
  
  const [markerPosition, setMarkerPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchLocation();
    }
  }, [id, isEditMode]);

  useEffect(() => {
    // Update marker when coordinates change
    if (formData.latitude && formData.longitude) {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        setMarkerPosition({ longitude: lng, latitude: lat });
        setViewState(prev => ({
          ...prev,
          longitude: lng,
          latitude: lat,
          zoom: 13
        }));
      }
    }
  }, [formData.latitude, formData.longitude]);

  const fetchLocation = async () => {
    try {
      setLoading(true);
      const response = await LocationService.get(id);
      const { name, address, latitude, longitude, demand, isDepot } = response;
      setFormData({
        name: name || '',
        address: address || '',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        demand: (demand || 0).toString(),
        isDepot: isDepot || false
      });
    } catch (err) {
      const errorMsg = 'Failed to load location data';
      setError(errorMsg);
      notify(errorMsg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (event) => {
    if (event.lngLat) {
      const { lng, lat } = event.lngLat;
      
      // Update form data with clicked coordinates
      setFormData(prev => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
      }));

      // Update marker position
      setMarkerPosition({ longitude: lng, latitude: lat });

      // If no name is set, try to get address from coordinates
      if (!formData.name) {
        reverseGeocode(lat, lng);
      }
    }
  };

  const reverseGeocode = async (lat, lng) => {
    setGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        const address = data.display_name;
        const name = address.split(',')[0];
        
        setFormData(prev => ({
          ...prev,
          name: name,
          address: address
        }));
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
      // Don't show error to user as this is just a convenience feature
    } finally {
      setGeocoding(false);
    }
  };

  const handleLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      name: location.name || prev.name,
      address: location.address || location.name,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString()
    }));
    
    setShowSearch(false);
  };

  const onChange = e => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const locationData = {
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        demand: parseInt(formData.demand),
        isDepot: formData.isDepot
      };

      if (isEditMode) {
        await LocationService.update(id, locationData);
      } else {
        await LocationService.create(locationData);
      }

      navigate('/locations');
      notify('Location saved successfully', 'success', { autoClose: 2000 });
    } catch (err) {
      const errorMsg = 'Failed to save location';
      setError(errorMsg);
      notify(errorMsg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="form-container">
      <h1>{isEditMode ? 'Edit Location' : 'Add Location'}</h1>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="location-options">
        <button
          type="button"
          className={`btn ${showSearch ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowSearch(!showSearch)}
        >
          <i className="fas fa-search"></i> Search Location
        </button>
        <span className="option-divider">or</span>
        <span className="option-text">Click on the map below</span>
      </div>

      {showSearch && (
        <div className="search-section">
          <LocationSearch 
            onLocationSelect={handleLocationSelect}
            mapRef={mapRef}
          />
        </div>
      )}

      <div style={{ height: '500px', width: '100%', marginBottom: '20px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onClick={handleMapClick}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          {markerPosition && (
            <Marker
              longitude={markerPosition.longitude}
              latitude={markerPosition.latitude}
              anchor="bottom"
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: formData.isDepot 
                    ? 'linear-gradient(135deg, #FF6B47, #FF5733)'
                    : 'linear-gradient(135deg, #4A6FFF, #3357FF)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  border: '3px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                }}
                title={formData.name || 'New Location'}
              >
                {formData.isDepot ? '🏭' : '📍'}
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
      </div>
      
      <p className="map-help">
        <i className="fas fa-info-circle"></i>
        Click on the map to set location coordinates. The location name and address will be automatically filled if available.
        {geocoding && <span className="geocoding-indicator"> <i className="fas fa-spinner fa-spin"></i> Getting address...</span>}
      </p>

      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="name">Location Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={onChange}
            required
            placeholder="e.g., Warehouse A, Office Building, etc."
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="address">Address</label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={onChange}
            placeholder="Full address of the location"
            rows="3"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="latitude">Latitude *</label>
            <input
              type="text"
              id="latitude"
              name="latitude"
              value={formData.latitude}
              onChange={onChange}
              required
              placeholder="e.g., 40.7128"
              readOnly={showSearch}
            />
          </div>
          <div className="form-group">
            <label htmlFor="longitude">Longitude *</label>
            <input
              type="text"
              id="longitude"
              name="longitude"
              value={formData.longitude}
              onChange={onChange}
              required
              placeholder="e.g., -74.0060"
              readOnly={showSearch}
            />
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="demand">Demand</label>
          <input
            type="number"
            id="demand"
            name="demand"
            value={formData.demand}
            onChange={onChange}
            min="0"
            placeholder="e.g., 100"
          />
          <small className="form-help">Amount of goods to be delivered/picked up at this location</small>
        </div>
        
        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="isDepot"
            name="isDepot"
            checked={formData.isDepot}
            onChange={onChange}
          />
          <label htmlFor="isDepot">This is a depot (starting/ending point for vehicles)</label>
        </div>
        
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/locations')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Location'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LocationForm;
