const axios = require('axios');

async function chatCompletion({ system, user, model, maxTokens = 4096, temperature = 0.4 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'OPENAI_API_KEY not configured', text: '' };
  }
  const chosenModel = model || process.env.KNOWLEDGE_ENGINE_AI_MODEL || 'gpt-4o-mini';
  try {
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: chosenModel,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      },
    );
    const text = res.data?.choices?.[0]?.message?.content || '';
    return { ok: true, text, model: chosenModel };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return { ok: false, error: msg, text: '' };
  }
}

function parseJsonFromLlm(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

module.exports = { chatCompletion, parseJsonFromLlm };
