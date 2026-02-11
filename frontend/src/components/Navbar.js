import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaTruck, 
  FaBars, 
  FaTimes, 
  FaSun, 
  FaMoon,
  FaTachometerAlt,
  FaRoute,
  FaMapMarkedAlt
} from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/ToastProvider';
import '../styles/Navbar.css';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FaTachometerAlt /> },
    { path: '/vehicles', label: 'Vehicles', icon: <FaTruck /> },
    { path: '/locations', label: 'Locations', icon: <FaMapMarkedAlt /> },
    { path: '/optimizations', label: 'Optimizations', icon: <FaRoute /> }
  ];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''} bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50`}>
      <div className="container mx-auto px-6">
        <Link to="/" className="navbar-brand group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
              <FaTruck className="text-xl" />
            </div>
            <span className="brand-text text-2xl font-extrabold tracking-tight text-white">
              Route It
            </span>
          </div>
        </Link>

        <div className="navbar-mobile-toggle" onClick={toggleMenu}>
          {isOpen ? <FaTimes /> : <FaBars />}
        </div>

        <div className={`navbar-menu ${isOpen ? 'open' : ''}`}>
          <>
            <div className="navbar-links">
              {navItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`navbar-link group ${((location.pathname === item.path) || (location.pathname.startsWith(item.path))) ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {((location.pathname === item.path) || (location.pathname.startsWith(item.path))) && (
                    <div className="active-indicator" />
                  )}
                </Link>
              ))}
            </div>

            <div className="navbar-user">
              <button 
                className="btn btn-outline btn-sm group" 
                onClick={() => {
                  const newTheme = theme === 'light' ? 'dark' : 'light';
                  toggleTheme();
                  notify(`Switched to ${newTheme} theme`, 'info', { autoClose: 2000 });
                }} 
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <FaMoon className="group-hover:rotate-12 transition-transform duration-300" />
                ) : (
                  <FaSun className="group-hover:rotate-12 transition-transform duration-300" />
                )}
                <span className="ml-2">
                  {theme === 'light' ? 'Dark' : 'Light'}
                </span>
              </button>
            </div>
          </>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
