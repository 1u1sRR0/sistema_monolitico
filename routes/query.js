const pool = require('../db/postgres');
const authMiddleware = require('../middleware/auth');
const { getWeather } = require('../services/weather');
const { getLocation } = require('../services/maps');
const { askLLM } = require('../services/llm');

function extractCity(question) {
  const text = question.toLowerCase().trim();

  const patterns = [
    /tiempo en ([a-záéíóúñ\s]+)/i,
    /clima en ([a-záéíóúñ\s]+)/i,
    /qué tiempo hace en ([a-záéíóúñ\s]+)/i,
    /que tiempo hace en ([a-záéíóúñ\s]+)/i,
    /dónde está ([a-záéíóúñ\s]+)/i,
    /donde está ([a-záéíóúñ\s]+)/i,
    /coordenadas de ([a-záéíóúñ\s]+)/i,
    /ubicación de ([a-záéíóúñ\s]+)/i,
    /ubicacion de ([a-záéíóúñ\s]+)/i,
    /qué hacer en ([a-záéíóúñ\s]+)/i,
    /que hacer en ([a-záéíóúñ\s]+)/i,
    /viajar a ([a-záéíóúñ\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1]
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return null;
}

async function buildResponse(question) {
  const lowerQuestion = question.toLowerCase();
  const city = extractCity(question);
  let responseText = `Has preguntado: ${question}`;

  // Caso 1: clima
  if (lowerQuestion.includes('tiempo') || lowerQuestion.includes('clima')) {
    const targetCity = city || 'Madrid';
    const weather = await getWeather(targetCity);

    if (weather) {
      responseText = `El clima en ${weather.ciudad} es ${weather.descripcion} con ${weather.temperatura}°C`;
    } else {
      responseText = `No pude obtener el clima de ${targetCity}`;
    }
  }

  // Caso 2: mapas / ubicación
  else if (
    lowerQuestion.includes('dónde está') ||
    lowerQuestion.includes('donde está') ||
    lowerQuestion.includes('coordenadas') ||
    lowerQuestion.includes('ubicación') ||
    lowerQuestion.includes('ubicacion')
  ) {
    const targetCity = city || 'Madrid';
    const location = await getLocation(targetCity);

    if (location) {
      responseText = `${targetCity} está en latitud ${location.latitud} y longitud ${location.longitud}. Lugar encontrado: ${location.nombre}`;
    } else {
      responseText = `No pude obtener la ubicación de ${targetCity}`;
    }
  }

  // Caso 3: respuesta inteligente de viaje con LLM
  else {
    const targetCity = city || 'Madrid';

    let weatherInfo = null;
    let locationInfo = null;

    try {
      weatherInfo = await getWeather(targetCity);
    } catch (e) {}

    try {
      locationInfo = await getLocation(targetCity);
    } catch (e) {}

    const prompt = `
Eres un asistente inteligente de viajes.
Responde en español, de forma útil, breve y clara.

Pregunta del usuario:
${question}

Contexto disponible:
- Ciudad detectada: ${targetCity}
- Clima: ${weatherInfo ? `${weatherInfo.descripcion}, ${weatherInfo.temperatura}°C` : 'No disponible'}
- Ubicación: ${locationInfo ? `${locationInfo.nombre}, lat ${locationInfo.latitud}, lon ${locationInfo.longitud}` : 'No disponible'}

Da una respuesta práctica para un viajero.
`;

    try {
      responseText = await askLLM(prompt);
    } catch (llmError) {
      console.error('ERROR LLM:', llmError.message);
      responseText = `No pude generar una respuesta inteligente en este momento, pero la ciudad detectada es ${targetCity}.`;
    }
  }

  return responseText;
}

function checkExternalApiKey(request, reply) {
  const receivedKey = request.headers['x-api-key'];
  const validKey = process.env.EXTERNAL_API_KEY;

  if (!receivedKey || receivedKey !== validKey) {
    return reply.code(401).send({ error: 'API key externa inválida' });
  }
}

async function queryRoutes(fastify) {
  fastify.post('/query', async (request, reply) => {
    try {
      const { question } = request.body;

      if (!question) {
        return reply.code(400).send({ error: 'Falta la pregunta' });
      }

      const responseText = await buildResponse(question);
      const userId = request.user ? request.user.userid : null;

      const result = await pool.query(
        'INSERT INTO queries (user_id, question, response) VALUES ($1, $2, $3) RETURNING id, question, response, created_at',
        [userId, question, responseText]
      );

      return {
        message: 'Consulta guardada correctamente',
        data: result.rows[0]
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Error interno al procesar la consulta' });
    }
  });

  fastify.post('/external', { preHandler: checkExternalApiKey }, async (request, reply) => {
    try {
      const { question, source } = request.body;

      if (!question) {
        return reply.code(400).send({ error: 'Falta la pregunta' });
      }

      const responseText = await buildResponse(question);

      const result = await pool.query(
        'INSERT INTO queries (user_id, question, response) VALUES ($1, $2, $3) RETURNING id, question, response, created_at',
        [null, `[external:${source || 'unknown'}] ${question}`, responseText]
      );

      return {
        message: 'Consulta externa procesada correctamente',
        data: result.rows[0]
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Error interno al procesar la consulta externa' });
    }
  });

  fastify.get('/history', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const result = await pool.query(
        'SELECT id, question, response, created_at FROM queries WHERE user_id = $1 ORDER BY created_at DESC',
        [request.user.userid]
      );

      return {
        message: 'Historial obtenido correctamente',
        data: result.rows
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Error interno al obtener el historial' });
    }
  });

  fastify.get('/stats', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const totalResult = await pool.query(
        'SELECT COUNT(*)::int AS total_queries FROM queries WHERE user_id = $1',
        [request.user.userid]
      );

      const lastResult = await pool.query(
        'SELECT question, response, created_at FROM queries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [request.user.userid]
      );

      return {
        message: 'Estadísticas obtenidas correctamente',
        data: {
          total_queries: totalResult.rows[0].total_queries,
          last_query: lastResult.rows[0] || null
        }
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Error interno al obtener estadísticas' });
    }
  });
}

module.exports = queryRoutes;