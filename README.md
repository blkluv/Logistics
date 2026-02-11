Route It is a production-ready logistics solution designed to modernize fleet management. By combining the MERN stack with Google OR-Tools and Generative AI, this platform solves complex Vehicle Routing Problems (VRP) while adapting to real-world unpredictability. It allows fleet managers to visualize delivery networks, optimize multi-stop schedules, and proactively adjust routes based on AI-driven traffic predictions and simulated road incidents.


[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.2.0-blue.svg)](https://react.dev/)

[View Live Deployment](https://logistics-route-optimization-tool-r.vercel.app/)

## Overview

Route It provides intelligent multi-stop route optimization for logistics operations, featuring AI-powered traffic analysis, dynamic incident simulation, and interactive map visualization. Built for scalability and real-world deployment scenarios.

## ✨ Key Features

### Core Capabilities
- ✅ **Intelligent Multi-Stop Routing** - Google OR-Tools optimization with real road distance matrices via Mapbox
- ✅ **AI Traffic Analysis** - Gemini 2.5 Flash predicts optimal departure times based on traffic patterns
- ✅ **Dynamic Incident Management** - Real-time traffic incident simulation with intelligent rerouting
- ✅ **Interactive Map Visualization** - Mapbox GL integration with route geometry and incident markers
- ✅ **Vehicle Fleet Management** - Support for multiple vehicle types with capacity constraints
- ✅ **Location Management** - Depot and delivery point configuration with demand tracking

### Advanced Features
- Real-time route recalculation with fixed delay penalties
- AI-powered incident impact analysis (severity, delay estimation, recommendations)
- Alternative route detection with fallback to current path when no alternatives exist
- Dark mode support with responsive design
- JSON export functionality for route data analysis
- Comprehensive route analytics and statistics

## 🛠️ Tech Stack

### Frontend
- **React.js** - Modern UI with hooks and context API
- **Mapbox GL JS** - Interactive map visualization with route rendering
- **Tailwind CSS** - Utility-first styling with dark mode support
- **React Router** - Client-side routing
- **Axios** - HTTP client for API communication

### Backend
- **Node.js** - Runtime environment
- **Express.js** - RESTful API framework
- **MongoDB** - NoSQL database for data persistence
- **Mongoose** - ODM for MongoDB
- **Google Generative AI** - Gemini 2.5 Flash for traffic predictions
- **Mapbox APIs** - Directions and Matrix APIs for real road data

### Algorithms & Services
- **Google OR-Tools** - Vehicle routing problem (VRP) solver
- **Gemini AI** - Traffic pattern analysis and incident impact assessment
- **Mapbox Directions API** - Route geometry with incident exclusion
- **Mapbox Matrix API** - Real-time distance and duration matrices

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Mapbox API Token ([Get one here](https://account.mapbox.com/))
- Google Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

## Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd route-it
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
MAPBOX_TOKEN=your_mapbox_api_token
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_MAPBOX_TOKEN=your_mapbox_api_token
```

### 4. Run the Application

**Start Backend Server:**
```bash
cd backend
npm start
```
Server will run on `http://localhost:5000`

**Start Frontend Development Server:**
```bash
cd frontend
npm start
```
Application will open at `http://localhost:3000`

## Project Structure

```
route-it/
├── backend/
│   ├── controllers/
│   │   ├── locations.js
│   │   ├── optimization.js      # Core OR-Tools optimization logic
│   │   └── vehicles.js
│   ├── models/
│   │   ├── Location.js
│   │   ├── Optimization.js
│   │   └── Vehicle.js
│   ├── routes/
│   │   ├── locations.js
│   │   ├── optimization.js
│   │   └── vehicles.js
│   ├── services/
│   │   └── trafficAI.js         # Gemini AI integration
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map.js           # Mapbox visualization
│   │   │   ├── Navbar.js
│   │   │   └── ToastProvider.js
│   │   ├── pages/
│   │   │   ├── Dashboard.js
│   │   │   ├── Locations.js
│   │   │   ├── NewOptimization.js
│   │   │   ├── OptimizationDetail.js
│   │   │   ├── Optimizations.js
│   │   │   └── Vehicles.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── location.service.js
│   │   │   ├── optimization.service.js
│   │   │   └── vehicle.service.js
│   │   ├── styles/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── .gitignore
├── LICENSE
└── README.md
```

## Usage Guide

### 1. Add Vehicles
Navigate to **Vehicles** → **Add Vehicle**
- Enter vehicle name, capacity, and count
- Vehicles represent your delivery fleet

### 2. Add Locations
Navigate to **Locations** → **Add Location**
- Add depot (starting point) - mark as depot
- Add delivery locations with demand values
- Use map click or search to set coordinates

### 3. Create Optimization
Navigate to **Optimizations** → **New Optimization**
- Select vehicles from your fleet
- Select locations to visit
- Set departure time for AI traffic analysis
- Run optimization

### 4. View Results
- Interactive map with color-coded routes
- Route details with stops, distances, and ETAs
- AI traffic prediction insights
- Export to JSON for further analysis

### 5. Simulate Incidents
On optimization detail page:
- Click **Simulate Road Accident / Reroute**
- System applies AI-analyzed delay
- Routes recalculate with incident exclusion
- View alternative routes or delay impact

### 6. Resolve Incidents
- Click **Resolve Incident / Clear Blockage**
- Routes restore to normal conditions
- Compare before/after metrics

## API Documentation

### Vehicles
- `GET /api/vehicles` - Get all vehicles
- `POST /api/vehicles` - Create vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle

### Locations
- `GET /api/locations` - Get all locations
- `POST /api/locations` - Create location
- `PUT /api/locations/:id` - Update location
- `DELETE /api/locations/:id` - Delete location

### Optimizations
- `GET /api/optimization` - Get all optimizations
- `GET /api/optimization/:id` - Get optimization by ID
- `POST /api/optimization` - Create optimization
- `POST /api/optimization/:id/reroute` - Simulate incident
- `POST /api/optimization/:id/resolve` - Resolve incident
- `DELETE /api/optimization/:id` - Delete optimization

## Algorithm Details

### Google OR-Tools VRP Solver
- Capacity-constrained vehicle routing
- Distance minimization objective
- Real road distance matrices from Mapbox
- Service time consideration (15 min per stop)
- Depot return constraints

### AI Traffic Prediction
- Analyzes departure time vs. traffic patterns
- Considers rush hours and optimal windows
- Provides time savings estimates
- Suggests alternative departure times

### Incident Impact Analysis
- Fixed delay penalties (realistic approach)
- Severity classification (LOW/MODERATE/HIGH/CRITICAL)
- Recovery time estimation
- Rerouting recommendations

## Performance

- Optimized for up to 20 vehicles
- Supports up to 50 locations per optimization
- Real-time route geometry fetching
- Efficient distance matrix caching
- Responsive UI with loading states

## Security

- Environment variables for sensitive data
- CORS configuration for API security
- Input validation on all endpoints
- MongoDB injection prevention via Mongoose
- Secure API key handling

## Contributing

This is a demonstration project. For suggestions or issues, please open an issue on GitHub.

## Author

**Utkarsh Singh**

Built with expertise in MERN stack development, algorithm optimization, and AI integration.

## Acknowledgments

- Google OR-Tools for VRP optimization
- Mapbox for mapping and routing APIs
- Google Gemini AI for traffic intelligence
- MongoDB for data persistence
- React community for excellent tooling

---

**Note:** This application demonstrates production-ready code practices including error handling, API integration, responsive design, and scalable architecture suitable for real-world logistics operations.
