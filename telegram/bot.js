const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

let botInstance = null;

function formatResponse(title, emoji, text) {
  return `${emoji} *${title}*\n\n${text}\n\n✈️ _Travel Assistant IA_`;
}

function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log('Telegram no configurado: falta TELEGRAM_BOT_TOKEN');
    return null;
  }

  if (botInstance) {
    return botInstance;
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `👋 *¡Hola! Soy Addy, tu Travel Assistant IA*

Puedo ayudarte con:
🌤️ clima de ciudades
📍 ubicaciones y coordenadas
✈️ recomendaciones de viaje con IA

Prueba escribiendo:
- _que tiempo hace en madrid_
- _donde esta roma_
- _coordenadas de sevilla_
- _voy a viajar a lisboa, que me recomiendas hacer?_`,
      {
        parse_mode: 'Markdown'
      }
    );
  });

  bot.onText(/\/help/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `🆘 *Ayuda*

Comandos disponibles:
- /start → iniciar
- /help → ayuda
- /info → información

Ejemplos de preguntas:
🌤️ _que tiempo hace en madrid_
📍 _donde esta roma_
📍 _coordenadas de sevilla_
✈️ _voy a viajar a lisboa, que me recomiendas hacer?_`,
      {
        parse_mode: 'Markdown'
      }
    );
  });

  bot.onText(/\/info/, async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      `ℹ️ *Información del bot*

Estoy conectado al backend *Travel Assistant IA* y puedo usar:
- 🌤️ clima
- 📍 mapas y coordenadas
- 🧠 LLM para respuestas inteligentes
- 🗂️ historial y estadísticas`,
      {
        parse_mode: 'Markdown'
      }
    );
  });

  bot.on('message', async (msg) => {
    const text = msg.text;

    if (!text || text.startsWith('/')) {
      return;
    }

    try {
      const response = await axios.post(
        'http://localhost:3001/api/query',
        {
          question: text
        }
      );

      let reply =
        response.data?.data?.response ||
        'No pude generar una respuesta en este momento.';

      const lowerText = text.toLowerCase();

      if (lowerText.includes('tiempo') || lowerText.includes('clima')) {
        reply = formatResponse('Clima', '🌤️', reply);
      } else if (
        lowerText.includes('donde') ||
        lowerText.includes('dónde') ||
        lowerText.includes('coordenadas') ||
        lowerText.includes('ubicacion') ||
        lowerText.includes('ubicación')
      ) {
        reply = formatResponse('Ubicación', '📍', reply);
      } else if (
        lowerText.includes('viajar') ||
        lowerText.includes('recomiendas') ||
        lowerText.includes('qué hacer') ||
        lowerText.includes('que hacer')
      ) {
        reply = formatResponse('Recomendación de viaje', '✈️', reply);
      } else {
        reply = formatResponse('Travel Assistant IA', '🤖', reply);
      }

      await bot.sendMessage(msg.chat.id, reply, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error(
        'ERROR TELEGRAM:',
        error.response?.data || error.message
      );

      await bot.sendMessage(
        msg.chat.id,
        '⚠️ *Hubo un error conectando con el backend.*',
        {
          parse_mode: 'Markdown'
        }
      );
    }
  });

  console.log('Bot de Telegram iniciado');
  botInstance = bot;
  return bot;
}

module.exports = { startTelegramBot };