const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locations');

// @route   GET api/locations
// @desc    Get all locations
// @access  Public
router.get('/', locationController.getLocations);

// @route   GET api/locations/:id
// @desc    Get location by ID
// @access  Public
router.get('/:id', locationController.getLocationById);

// @route   POST api/locations
// @desc    Create location
// @access  Public
router.post('/', locationController.createLocation);

// @route   PUT api/locations/:id
// @desc    Update location
// @access  Public
router.put('/:id', locationController.updateLocation);

// @route   DELETE api/locations/:id
// @desc    Delete location
// @access  Public
router.delete('/:id', locationController.deleteLocation);

module.exports = router;