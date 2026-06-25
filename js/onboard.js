/* ═══════════════════════════════════════════════════════════
   FINVEST AI — onboard.js
   First-run onboarding + reusable "How to use" guide.
   Flow for new users: profile → intro slides → placement quiz.
═══════════════════════════════════════════════════════════ */

'use strict';

var INTRO_SLIDES = [
  { ic: '&#128640;', t: 'Welcome to Finvest AI', d: 'Practice investing with <b>real market data</b> and virtual money — zero real-world risk. Learn, trade, and level up.' },
  { ic: '&#9783;', t: 'Dashboard', d: 'Your net worth, holdings and returns at a glance — plus a live <b>index ticker</b> (NIFTY, S&P 500, BTC…) and <b>Bloomberg news</b>.' },
  { ic: '&#128200;', t: 'Market terminal', d: 'Switch between <b>US, India & Crypto</b>. Real candlestick charts with RSI & MACD, a watchlist, and one-tap <b>Buy / Sell</b>.' },
  { ic: '&#127891;', t: 'Learn path', d: 'A game-like path of lessons across <b>Beginner → Intermediate → Advanced</b>. Finish gamified quizzes to earn XP and unlock the next node.' },
  { ic: '&#127942;', t: 'Compete & track', d: 'Climb the <b>Leaderboard</b>, keep your streak alive, switch <b>light / dark</b> themes, and review achievements in your Profile.' }
];

var _intro = { idx: 0, mode: 'onboard' };

function ensureIntroDom() {
  if (document.getElementById('introOv')) return;
  var ov = document.createElement('div');
  ov.className = 'intro-ov'; ov.id = 'introOv';
  ov.innerHTML =
    '<div class="intro-card">'
    + '<button class="intro-skip" id="introSkip" onclick="introSkip()">Skip</button>'
    + '<div class="intro-ic" id="introIc"></div>'
    + '<div class="intro-t" id="introT"></div>'
    + '<div class="intro-d" id="introD"></div>'
    + '<div class="intro-dots" id="introDots"></div>'
    + '<div class="intro-nav"><button class="intro-back" id="introBack" onclick="introPrev()">Back</button>'
    + '<button class="intro-next" id="introNext" onclick="introNext()">Next</button></div>'
    + '</div>';
  document.body.appendChild(ov);
}

function renderIntro() {
  var s = INTRO_SLIDES[_intro.idx];
  document.getElementById('introIc').innerHTML = s.ic;
  document.getElementById('introT').innerHTML = s.t;
  // Welcome slide surfaces the market-specific virtual cash grant
  var desc = s.d;
  if (_intro.idx === 0) {
    var m = window.MKT || (window.MARKETS && MARKETS[currentMarket]);
    if (m) {
      var bal = (typeof fINR === 'function') ? fINR(m.startCash) : m.cur + m.startCash.toLocaleString();
      desc = 'You start with <b>' + bal + '</b> in virtual money — practice investing with <b>real market data</b> at zero real-world risk. Learn, trade, and level up.';
    }
  }
  document.getElementById('introD').innerHTML = desc;
  document.getElementById('introDots').innerHTML = INTRO_SLIDES.map(function (_, i) {
    return '<span class="intro-dot' + (i === _intro.idx ? ' on' : '') + '"></span>';
  }).join('');
  document.getElementById('introBack').style.visibility = _intro.idx === 0 ? 'hidden' : 'visible';
  var last = _intro.idx === INTRO_SLIDES.length - 1;
  document.getElementById('introNext').textContent = last
    ? (_intro.mode === 'onboard' ? 'Find my level →' : 'Got it')
    : 'Next';
  document.getElementById('introSkip').style.display = (_intro.mode === 'onboard') ? 'block' : 'none';
}

function showIntro(mode) {
  ensureIntroDom();
  _intro.idx = 0; _intro.mode = mode || 'help';
  document.getElementById('introOv').classList.add('on');
  document.body.style.overflow = 'hidden';
  renderIntro();
}

function introNext() {
  if (_intro.idx < INTRO_SLIDES.length - 1) { _intro.idx++; renderIntro(); return; }
  closeIntro();
  if (_intro.mode === 'onboard' && typeof startPlacement === 'function') startPlacement();
}
function introPrev() { if (_intro.idx > 0) { _intro.idx--; renderIntro(); } }
function introSkip() {
  closeIntro();
  if (_intro.mode === 'onboard' && typeof startPlacement === 'function') startPlacement();
}
function closeIntro() {
  var ov = document.getElementById('introOv');
  if (ov) ov.classList.remove('on');
  document.body.style.overflow = '';
}

// New user just set up their profile → run the onboarding flow.
function startOnboarding() { showIntro('onboard'); }
// Re-open the guide anytime (navbar "?" button).
function openHelp() { showIntro('help'); }

// ─── FIRST-TRADE CTA ─────────────────────────────────────
// Duolingo-style next action for brand-new users: surface the virtual cash
// grant and point them at their first trade. Hidden once they trade or dismiss.
function renderFirstTradeCTA() {
  var el = document.getElementById('ftCta');
  if (!el) return;
  var traded = (window.tradeHistory && tradeHistory.length > 0);
  var dismissed = Store.get('ftDismissed', false);
  if (traded || dismissed) { el.hidden = true; return; }

  var m = window.MKT || (window.MARKETS && MARKETS[currentMarket]);
  var bal = (window.wallet && typeof wallet.balance === 'number') ? wallet.balance : (m ? m.startCash : 0);
  var name = (window.userProfile && userProfile.name) ? userProfile.name.split(' ')[0] : 'there';
  var balText = (typeof fINR === 'function') ? fINR(bal) : (m ? m.cur + bal.toLocaleString() : bal);

  var t = document.getElementById('ftCtaTitle');
  var d = document.getElementById('ftCtaDesc');
  if (t) t.innerHTML = 'Welcome, ' + name + '! You have <b>' + balText + '</b> in virtual money to practice with.';
  if (d) d.textContent = 'Make your first trade — buy any stock to see how your portfolio moves. Zero real-world risk.';
  el.hidden = false;
}

function goFirstTrade() {
  if (typeof navTo === 'function') navTo('market');
  if (typeof showToast === 'function') showToast('💡 Pick a stock and tap Buy to start');
}

function dismissFirstTrade() {
  Store.set('ftDismissed', true);
  var el = document.getElementById('ftCta');
  if (el) el.hidden = true;
}
