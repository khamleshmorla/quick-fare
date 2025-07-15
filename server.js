const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/ride-fare-comparison', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Import Fare model
const Fare = require('./models/fare');

// Enable CORS for all routes
app.use(cors());

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyDPrJsx1qkMrAvYwkMMT6Gs6YMWarej_gs';

// City-specific pricing
const CITY_PRICING = {
    "mumbai": {
        "bike": { base: 25, per_km: 3.5, per_min: 0.4, service_fee: 0.05 },
        "auto": { base: 30, per_km: 4.5, per_min: 0.6, service_fee: 6 },
        "sedan": { base: 40, per_km: 7, per_min: 1.0, service_fee: 0.08 },
        "toll": 40
    },
    "delhi": {
        "bike": { base: 25, per_km: 3.2, per_min: 0.3, service_fee: 2 },
        "auto": { base: 30, per_km: 4.2, per_min: 0.5, service_fee: 5 },
        "sedan": { base: 40, per_km: 6.8, per_min: 0.9, service_fee: 8 },
        "toll": 30
    }
};

// Calculate distance cost with tiered pricing
function calculateDistanceCost(distance_km, per_km_rates) {
    let cost = 0;
    let remaining_distance = distance_km;
    
    for (const [threshold, rate] of per_km_rates) {
        if (remaining_distance <= 0) break;
        const applicable_distance = Math.min(threshold, remaining_distance);
        cost += applicable_distance * rate * 1.05; // Apply 1.05x multiplier
        remaining_distance -= applicable_distance;
    }
    
    return cost;
}

// Estimate surge multiplier based on time and day
function estimateSurgeMultiplier(city, vehicleType) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Peak hours (8-10 AM, 6-9 PM on weekdays)
    let surge = 1.0;
    if ((hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 21)) {
        surge = vehicleType === "sedan" ? 1.05 : 1.03; // Adjusted peak multipliers
    }

    // Higher surge on weekends
    if (day === 0 || day === 6) { // Saturday/Sunday
        surge *= 1.03; // Adjusted weekend multiplier
    }

    return surge;
}

// Main fare calculation function
function calculateRideFare(city, vehicleType, straightLineDistanceKm, estimatedTimeMin, includeTolls = false) {
    // City and vehicle validation
    city = city.toLowerCase();
    if (!CITY_PRICING[city] || !CITY_PRICING[city][vehicleType]) {
        throw new Error("Unsupported city or vehicle type");
    }

    const pricing = CITY_PRICING[city][vehicleType];
    const routeAdjustmentFactor = 1.3; // Adjust straight-line distance to real road distance
    const adjustedDistanceKm = straightLineDistanceKm * routeAdjustmentFactor;

    // Tiered distance cost for Mumbai sedan
    let distanceCost;
    if (city === "mumbai" && vehicleType === "sedan") {
        distanceCost = calculateDistanceCost(adjustedDistanceKm, [[3, 8], [Infinity, 6]]);
    } else {
        distanceCost = adjustedDistanceKm * pricing.per_km;
    }

    // Time cost
    const timeCost = estimatedTimeMin * pricing.per_min;

    // Surge pricing
    const surge = estimateSurgeMultiplier(city, vehicleType);

    // Service fee (percentage or fixed)
    let serviceFee;
    if (typeof pricing.service_fee === 'number' && pricing.service_fee < 1) {
        serviceFee = (pricing.base + distanceCost + timeCost) * pricing.service_fee;
    } else {
        serviceFee = pricing.service_fee;
    }

    // Total fare with 1.05x multiplier
    const subtotal = (pricing.base + distanceCost + timeCost) * surge * 1.05;
    let total = subtotal + serviceFee;

    // Add tolls if applicable
    if (includeTolls) {
        total += CITY_PRICING[city].toll;
    }

    // Set minimum fare based on distance
    let minFare;
    if (adjustedDistanceKm <= 2) {
        minFare = pricing.base * 1.1; // 10% above base fare for very short distances
    } else if (adjustedDistanceKm <= 5) {
        minFare = pricing.base * 1.3; // 30% above base fare for short distances
    } else {
        minFare = pricing.base * 1.5; // 50% above base fare for longer distances
    }

    return Math.round(Math.max(total, minFare));
}

// Get traffic conditions from Google Maps
async function getTrafficConditions(startLat, startLng, endLat, endLng) {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLat},${startLng}&destinations=${endLat},${endLng}&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`
        );

        const result = response.data.rows[0].elements[0];
        const durationInTraffic = result.duration_in_traffic.value;
        const normalDuration = result.duration.value;
        
        // Calculate traffic multiplier
        const trafficRatio = durationInTraffic / normalDuration;
        let trafficMultiplier = 1.0;
        
        if (trafficRatio > 1.5) {
            trafficMultiplier = 1.3; // Heavy traffic
        } else if (trafficRatio > 1.2) {
            trafficMultiplier = 1.15; // Moderate traffic
        }

        return {
            distance: result.distance.value / 1000, // Convert to km
            duration: durationInTraffic / 60, // Convert to minutes
            trafficMultiplier
        };
    } catch (error) {
        console.error('Error fetching traffic data:', error);
        return null;
    }
}

// Get area type using Google Places API
async function getAreaType(lat, lng) {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
        );

        const addressComponents = response.data.results[0].address_components;
        const types = addressComponents.map(comp => comp.types[0]);
        
        if (types.includes('airport')) return 'airport';
        if (types.includes('train_station')) return 'railway';
        if (types.includes('business')) return 'business';
        if (types.includes('commercial')) return 'commercial';
        if (types.includes('residential')) return 'residential';
        return 'suburban';
    } catch (error) {
        console.error('Error fetching area type:', error);
        return 'residential';
    }
}

// Get time-based multiplier
function getTimeMultiplier() {
    const hour = new Date().getHours();
    
    if (hour >= 8 && hour < 11) return TIME_MULTIPLIERS.peak.morning;
    if (hour >= 17 && hour < 20) return TIME_MULTIPLIERS.peak.evening;
    if (hour >= 22 || hour < 6) return TIME_MULTIPLIERS.peak.night;
    if (hour >= 20 && hour < 22) return TIME_MULTIPLIERS.off_peak.late_night;
    return TIME_MULTIPLIERS.off_peak.day;
}

// Root endpoint to serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'distance.html'));
});

// Main fare estimation endpoint
app.post('/api/fare-estimate', async (req, res) => {
    try {
        const { start_latitude, start_longitude, end_latitude, end_longitude } = req.body;

        // Get traffic conditions
        const trafficData = await getTrafficConditions(
            start_latitude, start_longitude, end_latitude, end_longitude
        );
        if (!trafficData) {
            throw new Error('Could not fetch traffic data');
        }

        // Calculate fares for all services and vehicle types
        const prices = [];
        const city = "mumbai"; // You can determine this based on coordinates
        const services = ['ola', 'uber', 'rapido'];
        const vehicleTypes = {
            'ola': ['bike', 'auto', 'mini', 'sedan'],
            'uber': ['bike', 'auto', 'go', 'premier'],
            'rapido': ['bike', 'auto', 'car']
        };

        for (const service of services) {
            for (const vehicleType of vehicleTypes[service]) {
                const fare = calculateRideFare(
                    city,
                    vehicleType,
                    trafficData.distance,
                    trafficData.duration,
                    true // Include tolls
                );

                if (fare) {
                    prices.push({
                        service: service.charAt(0).toUpperCase() + service.slice(1),
                        vehicle_type: vehicleType,
                        display_name: `${service.charAt(0).toUpperCase() + service.slice(1)} ${vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)}`,
                        distance: trafficData.distance,
                        duration: trafficData.duration,
                        fare: fare,
                        surge_multiplier: estimateSurgeMultiplier(city, vehicleType)
                    });
                }
            }
        }

        res.json({
            success: true,
            data: {
                prices,
                traffic_condition: trafficData.trafficMultiplier > 1.2 ? 'Heavy' : 
                                 trafficData.trafficMultiplier > 1.1 ? 'Moderate' : 'Light',
                time_of_day: new Date().getHours() >= 8 && new Date().getHours() < 11 ? 'Morning Peak' :
                           new Date().getHours() >= 17 && new Date().getHours() < 20 ? 'Evening Peak' :
                           new Date().getHours() >= 22 || new Date().getHours() < 6 ? 'Night' : 'Off Peak'
            }
        });
    } catch (error) {
        console.error('Error calculating fares:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // This makes the server accessible from any IP

app.listen(PORT, HOST, () => {
    console.log('=================================');
    console.log(`Server running at:`);
    console.log(`- http://localhost:${PORT}`);
    console.log(`- http://[your-ip-address]:${PORT}`);
    console.log('\nAvailable endpoints:');
    console.log('- GET  /                     - Main page');
    console.log('- POST /api/fare-estimate    - Get fare estimates');
    console.log('=================================');
}); 