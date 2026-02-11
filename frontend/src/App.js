import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleForm from './pages/VehicleForm';
import Locations from './pages/Locations';
import LocationForm from './pages/LocationForm';
import Optimizations from './pages/Optimizations';
import NewOptimization from './pages/NewOptimization';
import OptimizationDetail from './pages/OptimizationDetail';
import RouteSheet from './pages/RouteSheet';
import './App.css';
import { ToastProvider } from './components/ToastProvider';
import BottomNav from './components/BottomNav';

function App() {
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('reveal-visible');
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <ToastProvider>
          <div className="app">
            <Navbar />
            <BottomNav />
            <div className="container">
              <Routes>
                {/* Public dashboard as the landing page */}
                <Route path="/" element={<Dashboard />} />
                {/* Optional marketing/landing page, if needed */}
                <Route path="/home" element={<Home />} />

                <Route path="/dashboard" element={<Dashboard />} />

                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/vehicles/add" element={<VehicleForm />} />
                <Route path="/vehicles/edit/:id" element={<VehicleForm />} />

                <Route path="/locations" element={<Locations />} />
                <Route path="/locations/add" element={<LocationForm />} />
                <Route path="/locations/edit/:id" element={<LocationForm />} />

                <Route path="/optimizations" element={<Optimizations />} />
                <Route path="/optimizations/new" element={<NewOptimization />} />
                <Route path="/optimizations/:id" element={<OptimizationDetail />} />
                <Route path="/optimizations/:id/print" element={<RouteSheet />} />
              </Routes>
            </div>
          </div>
        </ToastProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;