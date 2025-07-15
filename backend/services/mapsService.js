const axios = require('axios');
const cheerio = require('cheerio');

const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;

async function getDistanceAndTime(pickup, drop) {
  const pickupCoords = await geocodeAddress(pickup);
  const dropCoords = await geocodeAddress(drop);

  const uberUrl = `https://www.uber.com/in/en/price-estimate/?origin_lat=${pickupCoords.lat}&origin_lng=${pickupCoords.lng}&destination_lat=${dropCoords.lat}&destination_lng=${dropCoords.lng}`;
  const response = await axios.get(uberUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  const html = response.data;
  const $ = cheerio.load(html);

  const fares = [];
  $('li[data-testid="product_selector.list_item"]').each((i, elem) => {
    const service = $(elem).find('p._css-jsRibq').text().trim().split(/[\s\n]/)[0];
    const estimate = $(elem).find('p._css-jeMYle').text().trim();
    const etaText = $(elem).find('p[data-testid="product_selector.list_item.eta_string"]').text().trim();
    const durationMatch = etaText.match(/(\d+)\s*mins/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 30;

    if (service && estimate) {
      fares.push({
        service,
        estimate,
        duration
      });
    }
  });

  if (fares.length === 0) {
    throw new Error('No fare estimates found on page');
  }

  const uberFare = fares[0];
  return {
    distance: 0,
    distanceText: 'N/A',
    time: uberFare.duration,
    timeText: `${uberFare.duration} min`,
    uberFares: fares
  };
}

async function geocodeAddress(address) {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${OPENCAGE_API_KEY}&limit=1`;
  const response = await axios.get(url);
  const data = response.data;
  if (data.results && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry;
    return { lat, lng };
  }
  throw new Error('OpenCage: No results found');
}

module.exports = { getDistanceAndTime };