const express = require('express');
const router = express.Router();
const optimizationController = require('../controllers/optimization');

// @route   GET api/optimization
// @desc    Get all optimizations
// @access  Public
router.get('/', optimizationController.getOptimizations);

// @route   POST api/optimization
// @desc    Create optimization
// @access  Public
router.post('/', optimizationController.createOptimization);

// @route   POST api/optimization/:id/reroute
// @desc    Reroute optimization with incident simulation
// @access  Public
router.post('/:id/reroute', optimizationController.rerouteOptimization);

// @route   POST api/optimization/:id/resolve
// @desc    Resolve incident and restore normal routes
// @access  Public
router.post('/:id/resolve', optimizationController.resolveIncident);

// @route   GET api/optimization/:id/route/:routeIndex/polyline
// @desc    Get road-routed polyline for a route index
// @access  Public
router.get('/:id/route/:routeIndex/polyline', optimizationController.getRoutedPolyline);

// @route   GET api/optimization/:id
// @desc    Get optimization by ID
// @access  Public
router.get('/:id', optimizationController.getOptimizationById);

// @route   DELETE api/optimization/:id
// @desc    Delete optimization
// @access  Public
router.delete('/:id', optimizationController.deleteOptimization);

module.exports = router;