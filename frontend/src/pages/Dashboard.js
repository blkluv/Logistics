import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaTruck, FaMapMarkerAlt, FaRoute, FaPlus, 
  FaCalendarAlt, FaClock, FaRoad 
} from 'react-icons/fa';
import VehicleService from '../services/vehicle.service';
import LocationService from '../services/location.service';
import OptimizationService from '../services/optimization.service';
import Map from '../components/Map';
import { useToast } from '../components/ToastProvider';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [vehicles, setVehicles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalVehicles: 0,
    totalLocations: 0,
    totalOptimizations: 0,
    totalDistance: 0
  });
  const [selectedOptimization, setSelectedOptimization] = useState(null);
  const { notify } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch all data in parallel for better performance
      const [vehiclesRes, locationsRes, optimizationsRes] = await Promise.allSettled([
        VehicleService.getAll(),
        LocationService.getAll(),
        OptimizationService.getAll()
      ]);

      // Normalize data: Ensure we always have arrays even if a service fails
      const vehiclesData = vehiclesRes.status === 'fulfilled' && Array.isArray(vehiclesRes.value) ? vehiclesRes.value : [];
      const locationsData = locationsRes.status === 'fulfilled' && Array.isArray(locationsRes.value) ? locationsRes.value : [];
      const optimizationsData = optimizationsRes.status === 'fulfilled' && Array.isArray(optimizationsRes.value) ? optimizationsRes.value : [];

      setVehicles(vehiclesData);
      setLocations(locationsData);

      // FIX: Safe reduce to prevent "a.reduce is not a function"
      const totalDistance = optimizationsData.reduce(
        (sum, opt) => sum + (Number(opt.totalDistance) || 0), 
        0
      );
      
      setStats({
        totalVehicles: vehiclesData.length,
        totalLocations: locationsData.length,
        totalOptimizations: optimizationsData.length,
        totalDistance
      });
      
      // FIX: Safe sort for most recent optimization
      if (optimizationsData.length > 0) {
        const sorted = [...optimizationsData].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.updatedAt || 0);
          const dateB = new Date(b.createdAt || b.updatedAt || 0);
          return dateB - dateA;
        });
        setSelectedOptimization(sorted[0]);
      } else {
        setSelectedOptimization(null);
      }
      
    } catch (err) {
      console.error('Dashboard logic error:', err);
      setError('A system error occurred while processing data.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format helpers
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDistance = (distance) => {
    const n = Number(distance ?? 0);
    return `${(isFinite(n) ? n : 0).toFixed(2)} km`;
  };

  // Helper to map IDs back to full objects for the Map component
  const getMappedData = (type) => {
    if (!selectedOptimization || !selectedOptimization[type]) return [];
    const sourceArray = type === 'locations' ? locations : vehicles;
    return selectedOptimization[type].map(item => {
      const id = typeof item === 'object' ? item._id : item;
      return sourceArray.find(s => s._id === id);
    }).filter(Boolean);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 pb-20 md:pb-8">
      <div className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">Loading live logistics data...</p>
          </div>
        ) : error ? (
          <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md mx-auto">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <p className="text-slate-800 font-bold">{error}</p>
            <button className="mt-6 btn btn-primary w-full" onClick={fetchData}>Retry Connection</button>
          </div>
        ) : (
          <>
            <div className="dashboard-header flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Route Command Center</h1>
                <p className="text-slate-500 dark:text-slate-400">Monitoring {stats.totalVehicles} vehicles across {stats.totalLocations} endpoints.</p>
              </div>
              <Link to="/optimizations/new" className="mt-4 md:mt-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all shadow-lg">
                <FaPlus /> New Optimization Run
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                { label: 'Active Vehicles', val: stats.totalVehicles, icon: <FaTruck />, link: '/vehicles', color: 'blue' },
                { label: 'Total Stops', val: stats.totalLocations, icon: <FaMapMarkerAlt />, link: '/locations', color: 'indigo' },
                { label: 'Optimizations', val: stats.totalOptimizations, icon: <FaRoute />, link: '/optimizations', color: 'purple' },
                { label: 'Fleet Distance', val: formatDistance(stats.totalDistance), icon: <FaRoad />, color: 'emerald' }
              ].map((stat, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                  <div className={`text-${stat.color}-500 text-2xl mb-4`}>{stat.icon}</div>
                  <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">{stat.label}</h3>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.val}</p>
                  {stat.link && <Link to={stat.link} className="text-blue-500 text-xs mt-2 inline-block hover:underline">Manage Data →</Link>}
                </div>
              ))}
            </div>

            {selectedOptimization ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h2 className="font-bold text-xl text-slate-800 dark:text-white">Real-Time Route Preview</h2>
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-slate-500">
                      ID: {selectedOptimization._id?.substring(0,8)}
                    </span>
                  </div>
                  <div className="h-[450px] relative">
                    <Map 
                      locations={getMappedData('locations')}
                      routes={selectedOptimization.routes || []}
                      vehicles={getMappedData('vehicles')}
                      height="450px"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Summary Metrics</h2>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <span className="text-slate-500 text-sm">Timestamp</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                          {formatDate(selectedOptimization.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                        <span className="text-slate-500 text-sm">Deployment Efficiency</span>
                        <span className="font-bold text-emerald-500">Optimal</span>
                      </div>
                    </div>
                    <Link to={`/optimizations/${selectedOptimization._id}`} className="mt-6 w-full btn btn-outline flex justify-center py-3">
                      Deep Analytics
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                <div className="text-slate-300 text-6xl mb-4 flex justify-center"><FaRoute /></div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Ready to Optimize?</h2>
                <p className="text-slate-500 max-w-sm mx-auto mt-2">No routes generated yet. Add your fleet and delivery locations to begin.</p>
                <Link to="/optimizations/new" className="mt-8 inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Start First Run</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
