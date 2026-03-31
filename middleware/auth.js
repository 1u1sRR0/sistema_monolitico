const jwt = require('jsonwebtoken');
require('dotenv').config();

async function authMiddleware(request, reply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    request.user = decoded;
  } catch (err) {
    return reply.code(401).send({ error: 'Token inválido o expirado' });
  }
}

module.exports = authMiddleware;