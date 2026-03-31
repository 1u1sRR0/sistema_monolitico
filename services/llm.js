const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function askOllama(prompt) {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'gemma3:4b';

  const response = await axios.post(`${baseUrl}/api/generate`, {
    model,
    prompt,
    stream: false
  });

  return response.data.response;
}

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
}

async function askLLM(prompt) {
  const provider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();

  if (provider === 'gemini') {
    try {
      return await askGemini(prompt);
    } catch (error) {
      console.error('⚠️ Gemini falló, intentando con Ollama...');
      console.error('Detalle Gemini:', error.message);

      try {
        return await askOllama(prompt);
      } catch (fallbackError) {
        console.error('❌ Ollama también falló.');
        console.error('Detalle Ollama:', fallbackError.message);
        throw new Error('No se pudo obtener respuesta de ningún LLM');
      }
    }
  }

  return await askOllama(prompt);
}

module.exports = { askLLM };