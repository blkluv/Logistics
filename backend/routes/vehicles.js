const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicles');

// @route   GET api/vehicles
// @desc    Get all vehicles
// @access  Public
router.get('/', vehicleController.getVehicles);

// @route   GET api/vehicles/:id
// @desc    Get vehicle by ID
// @access  Public
router.get('/:id', vehicleController.getVehicleById);

// @route   POST api/vehicles
// @desc    Create vehicle
// @access  Public
router.post('/', vehicleController.createVehicle);

// @route   PUT api/vehicles/:id
// @desc    Update vehicle
// @access  Public
router.put('/:id', vehicleController.updateVehicle);

// @route   DELETE api/vehicles/:id
// @desc    Delete vehicle
// @access  Public
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;