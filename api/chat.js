/* Vercel serverless function — AI tutor (Fin) backed by the Anthropic Messages
   API. Mirrors the /api/chat route in server.js so the live AI works on Vercel.
   No ANTHROPIC_API_KEY → { ok:false, reason:'no-key' } and the client uses its
   built-in offline engine. */

const { cors } = require('./_data');

const FINVEST_MODEL = process.env.FINVEST_MODEL || 'claude-haiku-4-5-20251001';

function buildFinSystem(ctx) {
  ctx = ctx || {};
  const lines = [
    'You are Fin, the friendly AI investing tutor inside Finvest AI — a gamified PAPER-TRADING app (virtual money, no real funds).',
    'Audience: Gen-Z beginners. Be warm, encouraging and conversational, like a knowledgeable friend — never robotic or templated.',
    'Keep answers concise (about 60-150 words). Lead with the direct answer, then a short why. Avoid jargon, or define it in plain words.',
    'Always ground advice in the user\'s actual portfolio context below when relevant. Personalise — refer to their holdings, sectors and goal.',
    'Never give real-money financial advice or price predictions; frame everything as education for practice. No disclaimers longer than one short clause.',
    'Formatting: plain text only. Use blank lines between short paragraphs and "• " for bullet points. Do NOT use markdown symbols like # or **.'
  ];
  const c = [];
  if (ctx.market) c.push('Active market: ' + ctx.market);
  if (ctx.profile) c.push('User: ' + [ctx.profile.name, ctx.profile.goal && ('goal ' + ctx.profile.goal), ctx.profile.risk && (ctx.profile.risk + ' risk')].filter(Boolean).join(', '));
  if (ctx.holdings) c.push('Holdings: ' + ctx.holdings);
  if (ctx.sectors) c.push('Sectors: ' + ctx.sectors);
  if (typeof ctx.gainPct === 'number') c.push('Overall P&L: ' + ctx.gainPct.toFixed(1) + '%');
  if (ctx.value) c.push('Portfolio value: ' + ctx.value);
  if (c.length) lines.push('\nUser portfolio context:\n' + c.join('\n'));
  return lines.join('\n');
}

module.exports = async function (req, res) {
  cors(res);
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST only' }); return; }

  const KEY = process.env.ANTHROPIC_API_KEY || '';
  if (!KEY) { res.json({ ok: false, reason: 'no-key' }); return; }

  const body = req.body || {};
  const message = String(body.message || '').slice(0, 1200).trim();
  if (!message) { res.status(400).json({ ok: false, error: 'message required' }); return; }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: FINVEST_MODEL,
        max_tokens: 700,
        system: buildFinSystem(body.context || {}),
        messages: [{ role: 'user', content: message }]
      })
    });
    if (!r.ok) {
      const errTxt = await r.text();
      console.error('Anthropic error', r.status, errTxt.slice(0, 200));
      res.json({ ok: false, error: 'api ' + r.status });
      return;
    }
    const j = await r.json();
    const text = (j.content || []).filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; }).join('\n').trim();
    if (!text) { res.json({ ok: false, error: 'empty' }); return; }
    res.json({ ok: true, reply: text });
  } catch (e) {
    console.error('chat error', e && e.message);
    res.json({ ok: false, error: String((e && e.message) || e) });
  }
};
