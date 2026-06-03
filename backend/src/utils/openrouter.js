const axios = require('axios');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const openrouterRequest = async (messages, model = 'anthropic/claude-3-haiku', options = {}) => {
  const response = await axios.post(
    `${OPENROUTER_BASE}/chat/completions`,
    {
      model,
      messages,
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature ?? 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'VINS Community Platform',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0]?.message?.content || '';
};

module.exports = { openrouterRequest };
