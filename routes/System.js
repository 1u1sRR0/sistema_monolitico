async function routes(fastify) {
  fastify.get('/status', async () => {
    return {
      status: 'ok',
      service: 'Sistema Monolítico con Componentes Externos',
      timestamp: new Date().toISOString()
    };
  });
}

module.exports = routes;