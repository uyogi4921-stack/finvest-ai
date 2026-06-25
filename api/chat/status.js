/* Vercel serverless function — reports whether the Claude-backed tutor is
   available (i.e. an ANTHROPIC_API_KEY is configured). The client checks this
   once and falls back to its offline engine when llm is false. */

const { cors } = require('../_data');

module.exports = function (req, res) {
  cors(res);
  const KEY = process.env.ANTHROPIC_API_KEY || '';
  res.json({
    ok: true,
    llm: !!KEY,
    model: KEY ? (process.env.FINVEST_MODEL || 'claude-haiku-4-5-20251001') : null
  });
};
