import React, { useState, useEffect, useRef } from 'react';
import '../styles/LocationSearch.css';

const LocationSearch = ({ onLocationSelect, mapRef }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchRef = useRef(null);

  // Load search history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('locationSearchHistory');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save search to history
  const saveToHistory = (searchTerm) => {
    const newHistory = [
      searchTerm,
      ...searchHistory.filter(item => item !== searchTerm)
    ].slice(0, 10); // Keep only last 10 searches
    
    setSearchHistory(newHistory);
    localStorage.setItem('locationSearchHistory', JSON.stringify(newHistory));
  };

  // Search function using Nominatim API
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Using Nominatim API for geocoding (free and open-source)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }
      
      const data = await response.json();
      setSearchResults(data);
      
      if (data.length === 0) {
        setError('No locations found. Try a different search term.');
      }
    } catch (err) {
      setError('Error searching for location. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationSelect = (result) => {
    const location = {
      name: result.display_name.split(',')[0],
      address: result.display_name,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon)
    };
    
    // Save search term to history
    saveToHistory(searchTerm);
    
    onLocationSelect(location);
    setSearchResults([]);
    setSearchTerm('');
    setShowHistory(false);
    
    // Fly to the location on the map
    if (mapRef && mapRef.current) {
      mapRef.current.flyTo({
        center: [location.longitude, location.latitude],
        zoom: 15,
        duration: 2000
      });
    }
  };

  const handleHistorySelect = (historyItem) => {
    setSearchTerm(historyItem);
    setShowHistory(false);
    // Trigger search after a brief delay
    setTimeout(() => handleSearch(), 100);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('locationSearchHistory');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="location-search-container" ref={searchRef}>
      <div className="search-input-container">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          placeholder="Search for a location..."
          className="search-input"
        />
        <button 
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim()}
          className="search-button"
        >
          {isLoading ? '⏳' : '🔍'}
        </button>
      </div>

      {/* Search History */}
      {showHistory && searchHistory.length > 0 && (
        <div className="search-history">
          <div className="history-header">
            <span>Recent Searches</span>
            <button onClick={clearHistory} className="clear-history-btn">
              Clear
            </button>
          </div>
          {searchHistory.map((item, index) => (
            <div
              key={index}
              className="history-item"
              onClick={() => handleHistorySelect(item)}
            >
              <span className="history-icon">🕒</span>
              <span className="history-text">{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="search-result-item"
              onClick={() => handleLocationSelect(result)}
            >
              <div className="result-name">{result.display_name.split(',')[0]}</div>
              <div className="result-address">{result.display_name}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="search-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
