const axios = require('axios');

async function getLocation(city) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'sistema-monolitico-app/1.0'
      }
    });

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const place = response.data[0];

    return {
      nombre: place.display_name,
      latitud: place.lat,
      longitud: place.lon
    };
  } catch (error) {
    console.error('ERROR MAPS:', error.message);
    return null;
  }
}

module.exports = { getLocation };