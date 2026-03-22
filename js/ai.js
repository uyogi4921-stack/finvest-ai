/* ═══════════════════════════════════════════════════════════
   FINVEST AI — ai.js
   Fin — AI Portfolio Advisor
   Currently: Smart offline response engine (works everywhere)
   Upgrade: Replace getReply() with Claude API call below
═══════════════════════════════════════════════════════════ */

'use strict';

var aiStarted = false;
var aiTyping  = false;

// ─── PORTFOLIO CONTEXT (used if upgrading to Claude API) ──
var PORTFOLIO_CONTEXT = [
  'You are Fin, an AI portfolio advisor inside Finvest AI, a gamified investing platform for Indian Gen Z investors.',
  'The user\'s current portfolio:',
  '- TCS: 5 shares @ ₹3,812 = ₹19,060 (15.3%)',
  '- INFY: 10 shares @ ₹1,634 = ₹16,340 (13.1%)',
  '- ONGC: 100 shares @ ₹263 = ₹26,300 (21.1%)',
  '- RELIANCE: 15 shares @ ₹2,941 = ₹44,115 (35.4%)',
  '- WIPRO: 38 shares @ ₹488 = ₹18,544 (14.9%)',
  'Total portfolio value: ₹1,24,359',
  'Sector breakdown: IT 43.3%, Energy 56.5%, Banking 0%, FMCG 0%, Pharma 0%, Auto 0%',
  'Portfolio health score: 42/100 — Needs Work',
  'Key risks: Only 2 sectors covered, correlated IT exposure (TCS+INFY+WIPRO move together), ONGC PSU risk, RELIANCE over-concentration at 35%',
  'Be direct, specific to their holdings, use Indian market examples. Give actionable advice.',
].join('\n');

// ─── OFFLINE RESPONSE ENGINE ──────────────────────────────
// Each response is matched by keyword patterns in the user message.
// To add new responses, add another entry to AI_RESPONSES.

var AI_RESPONSES = {
  diversification:
    '<b>Your portfolio scores <span class="r">42/100</span> on diversification.</b> Here\'s the honest breakdown:<br><br>'
    + '<span class="pill pr">IT: 43.3%</span> TCS+INFY+WIPRO all move together on US tech news<br>'
    + '<span class="pill pr">Energy: 56.5%</span> ONGC+RELIANCE — dangerously concentrated<br>'
    + '<span class="pill po">Banking: 0%</span> <span class="pill po">FMCG: 0%</span> <span class="pill po">Pharma: 0%</span><br><br>'
    + '<b>You have 5 stocks but only 2 sector bets.</b> If US tech slows OR oil crashes, your <span class="r">entire portfolio falls simultaneously</span>.'
    + '<hr><span class="o">Fix:</span> Add <b>HDFC Bank</b> (Banking), <b>ITC</b> (FMCG), <b>Sun Pharma</b> (Pharma). These 3 alone raise your score to ~68/100.',

  missing:
    '<b>You\'re missing 4 out of 6 major sectors entirely.</b><br><br>'
    + '<b>1. Banking → Target 20-25%</b><br>Add <b>HDFC Bank</b> or <b>ICICI Bank</b>. India\'s credit growth is 15%+. Completely uncorrelated to your IT cycle.<br><br>'
    + '<b>2. FMCG → Target 10-15%</b><br>Add <b>ITC</b> (3.5% dividend yield) or <b>HUL</b>. People still buy soap when markets crash — this is your portfolio cushion.<br><br>'
    + '<b>3. Pharma → Target 8-12%</b><br>Add <b>Sun Pharma</b> or <b>Cipla</b>. USD-earning exports, completely uncorrelated to your IT cycle.<br><br>'
    + '<b>4. Auto → Target 8-10%</b><br>Add <b>Tata Motors</b> (EV play via Jaguar Land Rover).'
    + '<hr><span class="o">Priority order:</span> Banking first → FMCG → Pharma.',

  risk:
    '<b>Your riskiest holding is ONGC.</b><br><br>'
    + '<b>1. <span class="r">ONGC</span> — Highest Risk</b><br>Government-owned PSU. Govt forces ONGC to sell fuel below market price. Subject to both global crude prices AND political decisions simultaneously — a double risk.<br><br>'
    + '<b>2. Your IT cluster</b><br>TCS + INFY + WIPRO all react to the same US tech spending news. One bad quarter hits all 3 at once. You think you have 3 stocks — you really have 1 bet.<br><br>'
    + '<b>3. RELIANCE at 35%</b><br>Great company but 35% in one stock is too concentrated — even for TCS or HDFC.'
    + '<hr><span class="g">Safest holding:</span> TCS. Dollar-earning, consistent buybacks, strong management.',

  suggestions:
    '<b>3 specific stocks to start balancing your portfolio:</b><br><br>'
    + '<b>1. HDFC Bank</b> <span class="pill pg">Top Pick</span><br>India\'s finest private bank. Low NPAs, strong credit growth, reliable dividends. Completely uncorrelated to your current holdings. <i>Target: 15-18%.</i><br><br>'
    + '<b>2. ITC Limited</b><br>Diversified FMCG + cigarettes + hotels. 3.5% dividend yield — pays you while you hold. Acts as cushion when tech markets correct. <i>Target: 8-10%.</i><br><br>'
    + '<b>3. Sun Pharma</b><br>India\'s largest pharma company. USD-facing exports. <i>Target: 7-9%.</i>'
    + '<hr><span class="o">To fund these:</span> Trim WIPRO (weakest IT name) and some ONGC. Don\'t sell TCS or Reliance yet.',

  ongc:
    '<span class="o">Hold ONGC for now, but don\'t add more.</span><br><br>'
    + '<b>Reasons to hold:</b><ul><li>Trading at low P/E — not overvalued at ₹263</li><li>Decent dividend yield (~4.5%)</li><li>If crude stays above $80/barrel, earnings hold</li></ul>'
    + '<b>Reasons NOT to add more:</b><ul><li>You already have 21% in ONGC — more than enough energy exposure</li><li>PSU discount: govt interference on pricing is a structural problem</li><li>Combined Energy allocation is 56.5% — extreme for any retail portfolio</li></ul>'
    + '<span class="g">My recommendation:</span> If ONGC falls below ₹230 on weak crude data, trim 30-40% and rotate into HDFC Bank.',

  reliance:
    '<b>Reliance is your best stock</b> — but you own too much of it (35.4%). One bad earnings quarter can crater your entire portfolio.<br><br>'
    + '<span class="g">Don\'t sell Reliance.</span> Just stop adding. As you build Banking and FMCG positions over 2-3 years, Reliance will naturally settle to a healthier 20-25%.',

  tcs:
    '<b>TCS is your strongest holding</b> — keep it. Dollar-earning, consistent buybacks, low debt, rock-solid management. <span class="g">No action needed.</span> Just ensure it doesn\'t exceed 15-18% of your portfolio as you diversify.',

  wipro:
    '<b>WIPRO is your weakest IT holding.</b> Revenue growth has consistently lagged TCS and Infosys over the past 5 years. If you need to trim one IT stock to fund diversification, <b>WIPRO is the one to reduce first.</b>',

  beginner:
    '<b>Welcome to investing! Step-by-step guide for India:</b><br><br>'
    + '<b>Step 1 — Open 3 accounts:</b><ul><li>Bank account (likely have this)</li><li>Demat account with CDSL or NSDL through a SEBI-registered DP</li><li>Trading account with a broker (Zerodha, Groww, Angel One)</li></ul>'
    + '<b>Step 2 — Start with index funds:</b> Buy a Nifty 50 ETF (like Nifty BeES). Instant diversification, ultra-low fees, matches India\'s top 50 companies.<br><br>'
    + '<b>Step 3 — Learn before you stock-pick:</b> Read Zerodha Varsity (free). Complete all lessons here on Finvest AI.<br><br>'
    + '<b>Step 4 — Start a SIP:</b> Even ₹500/month. Time in market beats timing the market.',

  sip:
    'SIP is absolutely the right strategy at your stage. Invest a fixed amount monthly regardless of conditions — removes emotion completely.<br><br>'
    + 'Even <b>₹500/month</b> in a Nifty 50 ETF would add instant diversification to your currently concentrated direct stock portfolio.',

  hdfc:
    '<b>HDFC Bank is exactly what your portfolio needs most urgently.</b><br><br>'
    + 'India\'s finest private bank — consistently low NPAs, strong credit growth, reliable dividends. Adding 15-18% in HDFC Bank would immediately add Banking exposure and raise your portfolio health score from 42 to ~60+.',

  silver:
    '<span class="r">Silver is not a long-term core holding for you.</span><br><br>'
    + 'Silver goes viral every few years, spikes, then collapses — most late buyers lose money. It produces no earnings, pays no dividends, doesn\'t compound. Just sits there.<br><br>'
    + '<b>Your actual problem:</b> You have ₹0 in Banking and FMCG. That\'s the real risk. Fix diversification first.',

  default:
    'Based on your holdings — heavy in IT and Energy with zero Banking, FMCG, or Pharma — my main advice is to <b>prioritise diversification above all else</b>.<br><br>'
    + 'Your single most impactful next step: <span class="g">add HDFC Bank</span> for Banking exposure. One stock, one action, and your portfolio health score goes from 42 to ~60+.<br><br>'
    + 'Ask me about any specific stock, sector, risk type, or investing concept!',
};

/**
 * Match user message to a response.
 * Upgrade this function to a real API call (see comment below).
 */
function getReply(msg) {
  var q = msg.toLowerCase();

  if (q.match(/diversif|concentrated|properly|spread|sector.*mix/))   return AI_RESPONSES.diversification;
  if (q.match(/missing|sector.*add|which.*sector|what.*sector/))       return AI_RESPONSES.missing;
  if (q.match(/riski|highest risk|dangerous|volatile.*stock|worst/))   return AI_RESPONSES.risk;
  if (q.match(/suggest|recommend|balance|which stock.*buy|add.*portfolio/)) return AI_RESPONSES.suggestions;
  if (q.match(/ongc|hold.*ongc|reduce.*ongc/))                         return AI_RESPONSES.ongc;
  if (q.match(/reli|reliance/))                                         return AI_RESPONSES.reliance;
  if (q.match(/tcs|tata consultancy/))                                  return AI_RESPONSES.tcs;
  if (q.match(/wipro/))                                                 return AI_RESPONSES.wipro;
  if (q.match(/beginner|start.*invest|how.*invest|first.*invest/))     return AI_RESPONSES.beginner;
  if (q.match(/sip|systematic|monthly.*invest/))                       return AI_RESPONSES.sip;
  if (q.match(/hdfc|icici|bank.*stock/))                               return AI_RESPONSES.hdfc;
  if (q.match(/silver|gold|metal|commodity/))                          return AI_RESPONSES.silver;

  return AI_RESPONSES.default;
}

/*
 * ─── UPGRADE TO CLAUDE API ────────────────────────────────
 * Replace getReply() with this async version:
 *
 * async function getReply(msg) {
 *   const response = await fetch('https://api.anthropic.com/v1/messages', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
 *     body: JSON.stringify({
 *       model: 'claude-sonnet-4-20250514',
 *       max_tokens: 600,
 *       system: PORTFOLIO_CONTEXT,
 *       messages: chatHistory
 *     })
 *   });
 *   const data = await response.json();
 *   return data.content[0].text;
 * }
 * Then make sendMsg() async and await getReply().
 */

// ─── CHAT UI ─────────────────────────────────────────────
function openAI() {
  document.getElementById('aipanel').classList.add('on');
  document.getElementById('aiov').classList.add('on');
  document.body.style.overflow = 'hidden';
  closeSB();

  if (!aiStarted) {
    aiStarted = true;
    setTimeout(function() {
      addBot(
        'Hey! \uD83D\uDC4B I\'m <b>Fin</b>, your AI portfolio advisor — works <span class="g">100% offline</span>, no internet needed!<br><br>'
        + 'I\'ve scanned your holdings. Direct truth: you have a <span class="r">serious concentration problem</span>:<br><br>'
        + '<span class="pill pr">56.5% Energy</span> <span class="pill pr">43.3% IT</span> <span class="pill po">0% Banking</span> <span class="pill po">0% FMCG</span><br><br>'
        + '<b>100% of your money is in just 2 sectors.</b> If US tech slows OR oil prices crash, your entire portfolio takes a simultaneous hit.<br><br>'
        + 'Tap any quick question below, or ask me anything. \uD83C\uDFAF'
      );
    }, 500);
  }
}

function closeAI() {
  document.getElementById('aipanel').classList.remove('on');
  document.getElementById('aiov').classList.remove('on');
  document.body.style.overflow = '';
}

function addBot(html) {
  var a = document.getElementById('aichat');
  var d = document.createElement('div');
  d.className = 'msg bot';
  d.innerHTML = '<div class="mav">\uD83E\uDD16</div><div class="mbub">' + html + '</div>';
  a.appendChild(d);
  a.scrollTop = a.scrollHeight;
}

function addUser(text) {
  var a = document.getElementById('aichat');
  var d = document.createElement('div');
  d.className = 'msg usr';
  d.innerHTML = '<div class="mbub">' + text + '</div><div class="mav">U</div>';
  a.appendChild(d);
  a.scrollTop = a.scrollHeight;
}

function showTyping() {
  var a = document.getElementById('aichat');
  var d = document.createElement('div');
  d.className = 'msg bot';
  d.id = 'typbub';
  d.innerHTML = '<div class="mav">\uD83E\uDD16</div><div class="mbub"><div class="typic"><div class="td"></div><div class="td"></div><div class="td"></div></div></div>';
  a.appendChild(d);
  a.scrollTop = a.scrollHeight;
}

function hideTyping() {
  var t = document.getElementById('typbub');
  if (t) t.remove();
}

function sendMsg() {
  if (aiTyping) return;
  var inp = document.getElementById('aiinp');
  var txt = inp.value.trim();
  if (!txt) return;

  inp.value = '';
  inp.style.height = 'auto';
  document.getElementById('qpwrap').style.display = 'none';

  addUser(txt);
  aiTyping = true;
  document.getElementById('aisend').disabled = true;
  showTyping();

  // Realistic delay 700–1300ms
  setTimeout(function() {
    hideTyping();
    addBot(getReply(txt));
    aiTyping = false;
    document.getElementById('aisend').disabled = false;
    document.getElementById('aichat').scrollTop = 99999;
  }, 700 + Math.random() * 600);
}

function qs(msg) {
  document.getElementById('aiinp').value = msg;
  sendMsg();
}
