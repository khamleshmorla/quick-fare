const express = require('express');
const { calculateRoute } = require('../controllers/routeController');

const router = express.Router();

router.get('/route', calculateRoute);

module.exports = router;