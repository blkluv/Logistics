import api from './api';

const getAll = async () => {
  try {
    const response = await api.get('/optimization');
    return response.data;
  } catch (error) {
    console.error('Error fetching optimizations:', error);
    throw error;
  }
};

const get = async (id) => {
  const response = await api.get(`/optimization/${id}`);
  return response.data;
};

const create = async (data) => {
  const response = await api.post('/optimization', data);
  return response.data;
};

const remove = async (id) => {
  const response = await api.delete(`/optimization/${id}`);
  return response.data;
};

const reroute = async (id, incidentData) => {
  const response = await api.post(`/optimization/${id}/reroute`, incidentData);
  return response.data;
};

const resolveIncident = async (id) => {
  const response = await api.post(`/optimization/${id}/resolve`);
  return response.data;
};

const getRoutedPolyline = async (id, routeIndex) => {
  const response = await api.get(`/optimization/${id}/route/${routeIndex}/polyline`);
  return response.data;
};

// Fetch real road geometry from Mapbox Directions API with optional incident exclusion
const getMapboxDirections = async (coordinates, incidentLocation = null) => {
  try {
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (!token) {
      throw new Error('Mapbox token not configured');
    }

    // Mapbox Directions API expects coordinates as "lng,lat;lng,lat;..."
    const coordString = coordinates
      .map(coord => `${coord[0]},${coord[1]}`)
      .join(';');

    // Build URL with optional incident exclusion
    let url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordString}?geometries=geojson&overview=full`;
    
    // Add exclude parameter if incident location exists
    if (incidentLocation && incidentLocation.latitude && incidentLocation.longitude) {
      url += `&exclude=point(${incidentLocation.longitude},${incidentLocation.latitude})`;
    }
    
    url += `&access_token=${token}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        geometry: route.geometry,
        distance: route.distance / 1000, // Convert meters to km
        duration: route.duration / 60, // Convert seconds to minutes
        success: true
      };
    }

    throw new Error('No routes returned from Mapbox');
  } catch (error) {
    console.error('Mapbox Directions API error:', error);
    return { success: false, error: error.message };
  }
};

const OptimizationService = {
  getAll,
  get,
  create,
  remove,
  reroute,
  resolveIncident,
  getRoutedPolyline,
  getMapboxDirections,
};

export default OptimizationService;