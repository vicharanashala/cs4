const { openrouterRequest } = require('../lib/openrouter');

const SYSTEM_PROMPT =
  'You are a sentiment analyzer. Analyze the emotional tone of the following text from an ' +
  'internship community forum. Return ONLY valid JSON in this exact format, no other text: ' +
  '{"score": <float -1.0 to 1.0>, "label": <one of: positive, neutral, negative, anxious, frustrated>}';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getModel = (modelName) => {
  if (modelName === 'Post') return require('../models/Post');
  if (modelName === 'Comment') return require('../models/Comment');
  throw new Error(`Unknown model: ${modelName}`);
};

const extractText = (doc, modelName) => {
  if (modelName === 'Post') {
    return `${doc.title} ${doc.description}`;
  }
  return doc.content || '';
};

const callSentimentApi = async (text) => {
  const response = await openrouterRequest(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    'anthropic/claude-3-haiku',
    { maxTokens: 100, temperature: 0.1 }
  );

  const jsonMatch = response.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  const parsed = JSON.parse(jsonMatch[0]);
  if (typeof parsed.score !== 'number' || !parsed.label) throw new Error('Invalid JSON shape');
  return parsed;
};

const analyzeSentiment = async (docId, modelName) => {
  try {
    const Model = getModel(modelName);
    const doc = await Model.findById(docId);
    if (!doc) return;

    const text = extractText(doc, modelName);
    const words = text.trim().split(/\s+/);

    // Skip if word count < 10 AND text ends with '?'
    if (words.length < 10 && text.trim().endsWith('?')) return;

    let parsed;
    try {
      parsed = await callSentimentApi(text);
    } catch {
      // First failure: mark pending, wait 5 seconds, retry once
      await Model.findByIdAndUpdate(docId, {
        $set: { 'sentiment.source': 'pending' },
      });
      await sleep(5000);
      try {
        parsed = await callSentimentApi(text);
      } catch {
        // Retry also failed: mark unanalyzed
        await Model.findByIdAndUpdate(docId, {
          $set: { 'sentiment.source': 'unanalyzed' },
        });
        return;
      }
    }

    await Model.findByIdAndUpdate(docId, {
      $set: {
        'sentiment.score': parsed.score,
        'sentiment.label': parsed.label,
        'sentiment.analyzedAt': new Date(),
        'sentiment.source': 'api',
      },
    });
  } catch {
    // Non-fatal: swallow all errors so caller is never affected
  }
};

module.exports = { analyzeSentiment };
