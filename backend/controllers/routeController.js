const { getDistanceAndTime } = require('../services/mapsService');

async function calculateRoute(req, res) {
  const { pickup, drop, rideType } = req.query;

  if (!pickup || !drop || !rideType) {
    return res.status(400).json({ error: 'Pickup, drop, and rideType are required' });
  }

  try {
    const routeData = await getDistanceAndTime(pickup, drop);
    const uberFare = routeData.uberFares.find(fare => 
      fare.service.toLowerCase().includes(rideType.toLowerCase())
    ) || routeData.uberFares[0];

    res.json({
      pickup,
      drop,
      rideType,
      distance: routeData.distanceText,
      time: routeData.timeText,
      estimatedFare: uberFare ? uberFare.estimate : 'N/A',
      uberOptions: routeData.uberFares
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate route', details: error.message });
  }
}

module.exports = { calculateRoute };