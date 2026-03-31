require('dotenv').config();

const fastify = require('fastify')({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  }
});

const pool = require('./db/postgres');
const { startTelegramBot } = require('./telegram/bot');

// ✅ Swagger
async function registerSwagger() {
  await fastify.register(require('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'Travel Assistant IA API',
        description: 'API del asistente inteligente de viajes con JWT, clima, mapas, Telegram y LLM',
        version: '1.0.0'
      }
    }
  });

  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/api/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });
}

// ✅ Rutas
async function registerRoutes() {
  // ⚠️ IMPORTANTE: usar await
  await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
  await fastify.register(require('./routes/query'), { prefix: '/api' });

  fastify.get('/api/status', async () => {
    const result = await pool.query('SELECT NOW()');
    return {
      status: 'ok',
      db: 'conectada',
      time: result.rows[0].now
    };
  });

  fastify.get('/api/health', async () => {
    try {
      await pool.query('SELECT 1');

      return {
        status: 'ok',
        services: {
          api: 'running',
          database: 'connected'
        }
      };
    } catch (error) {
      return {
        status: 'error',
        services: {
          api: 'running',
          database: 'disconnected'
        }
      };
    }
  });
}

// ✅ Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;

    await registerSwagger();
    await registerRoutes();

    // 🔥 MUY IMPORTANTE → asegura que todas las rutas están cargadas
    await fastify.ready();

    // 🔥 ahora sí imprime TODAS las rutas
    console.log(fastify.printRoutes());

    await fastify.listen({
      port: port,
      host: '0.0.0.0'
    });

    console.log(`Servidor en http://localhost:${port}`);

    // 🚀 Telegram después de levantar servidor
    startTelegramBot();

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();