const mongoose = require('mongoose');

const fareSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    service: {
        type: String,
        enum: ['Uber', 'Ola', 'Rapido'],
        required: true
    },
    rideType: {
        type: String,
        enum: ['Bike', 'Auto', 'Car', 'SUV', 'Premium'],
        required: true
    },
    pickupLocation: {
        name: String,
        latitude: Number,
        longitude: Number
    },
    dropLocation: {
        name: String,
        latitude: Number,
        longitude: Number
    },
    actualFare: {
        type: Number,
        required: true
    },
    distance: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    surgeMultiplier: {
        type: Number,
        default: 1
    },
    notes: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Fare', fareSchema); 