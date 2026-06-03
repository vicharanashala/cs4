const { openrouterRequest } = require('../utils/openrouter');
const { logEvent, getRequestMeta } = require('../middleware/logger');
const FAQ = require('../models/FAQ');

const buildSystemPrompt = async () => {
  const categories = await FAQ.find().sort({ order: 1 }).lean();
  const faqContext = categories
    .map((section) => {
      const qs = section.sub.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n');
      return `### ${section.main}\n${qs}`;
    })
    .join('\n\n---\n\n');

  return `You are Yaksha, the helpful AI assistant for the VINS (Vicharanashala Internship) programme at IIT Ropar.

You help students with questions about the VINS internship. You are knowledgeable, friendly, and concise.

Here is the complete FAQ for the programme:
${faqContext}

Guidelines:
- Answer based on the FAQ above whenever possible
- If a question isn't covered in the FAQ, say so honestly and suggest they type #escalate in Yaksha chat on samagama.in
- Keep answers concise and clear
- Don't make up information not in the FAQ
- Use a warm, helpful tone`;
};

exports.chat = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    }

    const systemPrompt = await buildSystemPrompt();

    // Build conversation with limited history (last 10 messages for context)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message.trim() },
    ];

    const reply = await openrouterRequest(messages, 'anthropic/claude-3-haiku', {
      maxTokens: 800,
      temperature: 0.5,
    });

    await logEvent({
      category: 'system',
      action: 'chatbot_query',
      ...getRequestMeta(req),
      details: { messageLength: message.length },
    });

    res.json({ reply });
  } catch (err) {
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'AI service rate limit reached. Please try again shortly.' });
    }
    next(err);
  }
};
