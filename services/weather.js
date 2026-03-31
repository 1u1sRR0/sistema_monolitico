const axios = require('axios');

const API_KEY = process.env.WEATHER_API_KEY;

async function getWeather(city) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric&lang=es`;

    const response = await axios.get(url);

    const data = response.data;

    return {
      ciudad: data.name,
      temperatura: data.main.temp,
      descripcion: data.weather[0].description
    };

  } catch (error) {
    console.error(error.message);
    return null;
  }
}

module.exports = { getWeather };