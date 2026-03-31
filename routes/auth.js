const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/postgres');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

async function authRoutes(fastify) {
  fastify.post('/register', async (request, reply) => {
    try {
      const { username, email, password } = request.body;

      if (!username || !email || !password) {
        return reply.code(400).send({ error: 'Faltan campos obligatorios' });
      }

      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existing.rows.length > 0) {
        return reply.code(409).send({ error: 'Usuario o email ya existe' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
        [username, email, passwordHash]
      );

      return {
        message: 'Usuario creado exitosamente',
        user: result.rows[0]
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Error interno al registrar usuario' });
    }
  });

  fastify.post('/login', async (request, reply) => {
    try {
      const { username, password } = request.body;

      if (!username || !password) {
        return reply.code(400).send({ error: 'Faltan credenciales' });
      }

      const result = await pool.query(
        'SELECT id, username, email, password_hash FROM users WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return reply.code(401).send({ error: 'Credenciales inválidas' });
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);

      if (!valid) {
        return reply.code(401).send({ error: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        {
          userid: user.id,
          username: user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      };
    } catch (err) {
      console.error(err);
      return reply.code(500).send({ error: 'Error interno al iniciar sesión' });
    }
  });

  fastify.get('/verify', { preHandler: authMiddleware }, async (request) => {
    return {
      valid: true,
      user: request.user
    };
  });
}

module.exports = authRoutes;