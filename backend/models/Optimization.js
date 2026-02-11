const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  vehicleName: String,
  stops: [{
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location'
    },
    locationName: String,
    latitude: Number,
    longitude: Number,
    demand: Number,
    order: Number,
    cumulativeDistance: Number,
    distanceFromPrev: Number,
    arrivalTime: Number,
    eta: String
  }],
  distance: Number,
  duration: Number,
  totalCapacity: Number,
  geometry: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString'
    },
    coordinates: [[Number]] // Array of [lng, lat] pairs
  },
  usingRealRoadData: {
    type: Boolean,
    default: false
  }
});

const AlgorithmResultSchema = new mongoose.Schema({
  algorithm: {
    type: String,
    required: true
  },
  routes: [RouteSchema],
  totalDistance: {
    type: Number,
    default: 0
  },
  totalDuration: {
    type: Number,
    default: 0
  },
  executionTime: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const OptimizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  vehicles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  }],
  locations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  algorithmResults: [AlgorithmResultSchema],
  // Keep legacy fields for backward compatibility
  routes: [RouteSchema],
  totalDistance: {
    type: Number,
    default: 0
  },
  totalDuration: {
    type: Number,
    default: 0
  },
  departureTime: {
    type: String,
    default: '08:00'
  },
  isIncidentActive: {
    type: Boolean,
    default: false
  },
  incidentLocation: {
    latitude: Number,
    longitude: Number
  },
  detourLocation: {
    latitude: Number,
    longitude: Number
  },
  originalRoutes: [RouteSchema],
  // AI Traffic Prediction
  aiPrediction: {
    success: Boolean,
    bestTime: String,
    alternativeTime: String,
    estimatedSavingsMinutes: Number,
    trafficRating: String,
    reasoning: String,
    avoidTimes: [String],
    confidence: String
  },
  // Incident Analysis (for re-routing)
  incidentAnalysis: {
    success: Boolean,
    fixedDelayMinutes: Number,
    delayMinutes: Number,
    delayLabel: String,
    severity: String,
    trafficMultiplier: Number,
    trafficCondition: String,
    recommendation: String,
    shouldReroute: Boolean,
    estimatedRecoveryTime: String,
    reroutedAt: Date,
    originalDuration: Number,
    incidentType: String,
    resolved: Boolean,
    resolvedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Optimization', OptimizationSchema);