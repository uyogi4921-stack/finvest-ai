/* ═══════════════════════════════════════════════════════════
   FINVEST AI — ui.js
   Navigation, toast, leaderboard, community, SEBI reader,
   profile system, SIP calculator, glossary
═══════════════════════════════════════════════════════════ */

'use strict';

// ─── NAVIGATION ──────────────────────────────────────────
var PAGE_TITLES = {
  dashboard:   'Dashboard',
  market:      'Live Market',
  learn:       'Learn & Earn',
  leaderboard: 'Leaderboard',
  resources:   'Resources',
  profile:     'My Profile',
};

function navTo(id, tnBtn, mbBtn) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('on'); });
  var pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('on');

  // Top navbar links
  document.querySelectorAll('.tn-link').forEach(function(n) { n.classList.remove('on'); });
  if (tnBtn && tnBtn.classList.contains('tn-link')) {
    tnBtn.classList.add('on');
  } else {
    // Find matching top nav link by data-page
    var match = document.querySelector('.tn-link[data-page="' + id + '"]');
    if (match) match.classList.add('on');
  }

  // Mobile sidebar links
  document.querySelectorAll('.sb-mobile .ni').forEach(function(n) { n.classList.remove('on'); });
  var sbMatch = document.querySelector('.sb-mobile .ni[data-page="' + id + '"]');
  if (sbMatch) sbMatch.classList.add('on');

  // Bottom nav
  document.querySelectorAll('.bni').forEach(function(n) { n.classList.remove('on'); });
  if (mbBtn) mbBtn.classList.add('on');
  var bn = document.getElementById('bn-' + id);
  if (bn) bn.classList.add('on');

  curPage = id;
  closeSB();
  document.body.style.overflow = ''; // unlock scroll in case an overlay left it locked
  window.scrollTo(0, 0);

  // Refresh data when navigating
  if (id === 'dashboard') {
    renderHoldingsTable();
    updateDashboardStats();
    if (typeof renderTicker === 'function') renderTicker();
    if (typeof renderNews === 'function') renderNews();
  }
  if (id === 'leaderboard') renderLB();
  if (id === 'profile') renderProfile();
  if (id === 'market' && typeof termEnsure === 'function') termEnsure();
}

function toggleSB() {
  var sb = document.getElementById('sb');
  var ov = document.getElementById('sbov');
  if (sb) sb.classList.toggle('on');
  if (ov) ov.classList.toggle('on');
}
function closeSB() {
  var sb = document.getElementById('sb');
  var ov = document.getElementById('sbov');
  if (sb) sb.classList.remove('on');
  if (ov) ov.classList.remove('on');
}

// ─── TOAST ────────────────────────────────────────────────
var toastTmr = null;
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  if (toastTmr) clearTimeout(toastTmr);
  toastTmr = setTimeout(function() { t.classList.remove('on'); }, 2800);
}

// ─── PROFILE SYSTEM ─────────────────────────────────────
function showProfilePrompt() {
  document.getElementById('profModal').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  document.getElementById('profModal').classList.remove('on');
  document.body.style.overflow = '';
}

function saveProfile() {
  var name = document.getElementById('profName').value.trim();
  if (!name) { showToast('Please enter your name'); return; }

  var avatarBtns = document.querySelectorAll('.av-opt.sel');
  var avatar = avatarBtns.length > 0 ? avatarBtns[0].textContent : '\u{1F464}';

  var goal = document.getElementById('profGoal') ? document.getElementById('profGoal').value : 'Learn investing basics';
  var riskLevel = document.querySelector('input[name="risk"]:checked');
  var risk = riskLevel ? riskLevel.value : 'moderate';

  window.userProfile = {
    name: name,
    avatar: avatar,
    goal: goal,
    risk: risk,
    createdAt: Date.now(),
    totalTrades: tradeHistory.length
  };

  Store.set('profile', userProfile);
  closeProfileModal();
  updateProfileUI();
  showToast('Welcome to Finvest AI, ' + name + '!');

  // Give welcome XP if first time
  if (totalXP === 0) {
    addXP(50, '\uD83C\uDF89 +50 XP Welcome Bonus!');
  }

  // First-time users: run the how-to-use onboarding + placement test
  if (!userProfile.placement && typeof startOnboarding === 'function') {
    setTimeout(startOnboarding, 450);
  }
}

function selectAvatar(btn) {
  document.querySelectorAll('.av-opt').forEach(function(b) { b.classList.remove('sel'); });
  btn.classList.add('sel');
}

function updateProfileUI() {
  if (!userProfile) return;

  // Update avatar in topbar
  var avi = document.getElementById('topAvi');
  if (avi) {
    avi.textContent = userProfile.avatar || userProfile.name.charAt(0).toUpperCase();
  }

  // Update top nav XP
  var tnXp = document.getElementById('tnXp');
  if (tnXp) tnXp.innerHTML = '&#9889; ' + totalXP + ' XP';

  // Update streak
  var streakEl = document.getElementById('streakText');
  if (streakEl) streakEl.textContent = streakData.count + ' Day Streak';
}

function renderProfile() {
  if (!userProfile) return;

  var el = document.getElementById('profAvatar');
  if (el) el.textContent = (userProfile.name || 'U').charAt(0).toUpperCase();

  el = document.getElementById('profDisplayName');
  if (el) el.textContent = userProfile.name;

  el = document.getElementById('profGoalDisplay');
  if (el) {
    var goal = (userProfile.goal || 'Learn basics').replace(/^(Build long-term |Generate passive |Save for a big |Learn investing )/i, '');
    el.textContent = 'Goal: ' + goal.toLowerCase();
  }

  el = document.getElementById('profRiskDisplay');
  if (el) el.textContent = 'Risk: ' + (userProfile.risk || 'moderate');

  var lv = getLv(totalXP);
  el = document.getElementById('profLevel');
  if (el) el.textContent = 'Lv ' + lv.num;

  el = document.getElementById('profXP');
  if (el) el.textContent = totalXP;

  el = document.getElementById('profTrades');
  if (el) el.textContent = tradeHistory.length;

  el = document.getElementById('profStreak');
  if (el) el.textContent = streakData.count + 'd';

  el = document.getElementById('profJoined');
  if (el) {
    var d = new Date(userProfile.createdAt || Date.now());
    el.textContent = 'Member since ' + d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  updateThemeUI();
  renderAchievements();
  renderWallet();
}

function renderAchievements() {
  var el = document.getElementById('achievementsList');
  if (!el) return;

  var port = calcPortfolio();
  var achievements = [
    { icon: '&#128200;', title: 'First Trade',      desc: 'Place a buy or sell order',  done: tradeHistory.length > 0 },
    { icon: '&#127942;', title: 'Active Trader',    desc: 'Complete 5 trades',          done: tradeHistory.length >= 5 },
    { icon: '&#127891;', title: 'Curious Mind',     desc: 'Finish your first lesson',   done: completedL.size >= 1 },
    { icon: '&#128218;', title: 'Knowledge Seeker', desc: 'Finish 3 lessons',           done: completedL.size >= 3 },
    { icon: '&#128293;', title: 'On a Roll',        desc: '3-day learning streak',      done: streakData.count >= 3 },
    { icon: '&#128737;', title: 'Level 3 Investor', desc: 'Reach Level 3',              done: getLv(totalXP).num >= 3 },
    { icon: '&#127919;', title: 'Diversified',      desc: 'Hold 4+ different assets',   done: HOLDS.length >= 4 },
  ];

  var unlocked = achievements.filter(function(a) { return a.done; }).length;
  var countEl = document.getElementById('achCount');
  if (countEl) countEl.textContent = unlocked + '/' + achievements.length + ' unlocked';

  el.innerHTML = achievements.map(function(a) {
    return '<div class="ach-card ' + (a.done ? 'ach-done' : 'ach-locked') + '">'
      + '<div class="ach-icon">' + a.icon + '</div>'
      + '<div class="ach-title">' + a.title + '</div>'
      + '<div class="ach-desc">' + a.desc + '</div>'
      + '</div>';
  }).join('');
}

// \u2500\u2500\u2500 THEME \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function setTheme(t) {
  document.documentElement.classList.toggle('light', t === 'light');
  Store.set('theme', t);
  updateThemeUI();
}

function updateThemeUI() {
  var light = document.documentElement.classList.contains('light');
  document.querySelectorAll('.theme-card').forEach(function(c) {
    c.classList.toggle('on', c.getAttribute('data-theme') === (light ? 'light' : 'dark'));
  });
  var navBtn = document.querySelector('.tn-theme');
  if (navBtn) navBtn.textContent = light ? '\u263e' : '\u2600';
  // Re-tint sector donut for the active theme
  if (typeof updateDashboardStats === 'function' && curPage === 'dashboard') updateDashboardStats();
  // Recolor chart workspace
  if (typeof termApplyTheme === 'function') termApplyTheme();
}

function editProfile() {
  if (!userProfile) { showProfilePrompt(); return; }
  // Pre-fill profile modal with existing data
  var nameInp = document.getElementById('profName');
  if (nameInp) nameInp.value = userProfile.name || '';

  var goalInp = document.getElementById('profGoal');
  if (goalInp) {
    for (var i = 0; i < goalInp.options.length; i++) {
      if (goalInp.options[i].text === userProfile.goal) {
        goalInp.selectedIndex = i;
        break;
      }
    }
  }

  // Pre-select avatar
  document.querySelectorAll('.av-opt').forEach(function(b) {
    b.classList.remove('sel');
    if (b.textContent === userProfile.avatar) b.classList.add('sel');
  });

  // Pre-select risk
  var riskInp = document.querySelector('input[name="risk"][value="' + (userProfile.risk || 'moderate') + '"]');
  if (riskInp) riskInp.checked = true;

  showProfilePrompt();
}

function resetProfile() {
  if (!confirm('This will reset ALL your data \u2014 XP, holdings, trades, profile. Are you sure?')) return;
  Store.remove('profile');
  Store.remove('xp');
  Store.remove('completedLessons');
  Store.remove('holdings');
  Store.remove('trades');
  Store.remove('watchlist');
  Store.remove('challenges');
  Store.remove('streak');
  window.location.reload();
}

// ─── LEADERBOARD ─────────────────────────────────────────
// Leaderboard roster \u2014 global traders with trades / win-rate / P&L
window.LB_PLAYERS = [
  { f:'\uD83C\uDDEE\uD83C\uDDF3', nm:'Aarav Mehta',   trades:142, win:71, pnl:38.4, xp:4820, bot:false },
  { f:'\uD83C\uDDEE\uD83C\uDDF9', nm:'Sofia Rossi',   trades:118, win:68, pnl:31.2, xp:4310, bot:false },
  { f:'\uD83C\uDDF8\uD83C\uDDEC', nm:'Marcus Chen',   trades:99,  win:65, pnl:27.0, xp:3940, bot:false },
  { f:'\uD83C\uDDEE\uD83C\uDDF3', nm:'Priya Sharma',  trades:87,  win:64, pnl:22.8, xp:3510, bot:false },
  { f:'\uD83C\uDDE6\uD83C\uDDFA', nm:'Quant_Quokka',  trades:220, win:58, pnl:19.4, xp:3210, bot:true  },
  { f:'\uD83C\uDDFA\uD83C\uDDF8', nm:'Jordan Bailey', trades:76,  win:62, pnl:17.6, xp:2980, bot:false },
  { f:'\uD83C\uDDEE\uD83C\uDDEA', nm:"Liam O'Connor", trades:65,  win:60, pnl:14.9, xp:2710, bot:false },
  { f:'\uD83C\uDDEF\uD83C\uDDF5', nm:'Yuki Tanaka',   trades:58,  win:59, pnl:12.1, xp:2440, bot:false },
  { f:'\uD83C\uDDE9\uD83C\uDDEA', nm:'Mia Schmidt',   trades:51,  win:57, pnl:10.3, xp:2180, bot:false },
  { f:'\uD83C\uDDFA\uD83C\uDDF8', nm:'AlphaBot_3000', trades:310, win:55, pnl:8.7,  xp:1950, bot:true  },
  { f:'\uD83C\uDDEB\uD83C\uDDF7', nm:'Chlo\u00E9 Martin',  trades:47,  win:56, pnl:7.2,  xp:1720, bot:false },
  { f:'\uD83C\uDDEC\uD83C\uDDE7', nm:'Noah Williams', trades:42,  win:54, pnl:5.9,  xp:1510, bot:false },
  { f:'\uD83C\uDDEA\uD83C\uDDF8', nm:'Luc\u00EDa Garc\u00EDa',  trades:33,  win:53, pnl:4.8,  xp:1290, bot:false },
  { f:'\uD83C\uDDE6\uD83C\uDDEA', nm:'Omar Haddad',   trades:28,  win:52, pnl:3.5,  xp:980,  bot:false },
  { f:'\uD83C\uDDE7\uD83C\uDDF7', nm:'Lucas Silva',   trades:21,  win:51, pnl:2.1,  xp:640,  bot:false },
];

window.lbTab = 'week';

function setLBTab(tab, btn) {
  lbTab = tab;
  document.querySelectorAll('.lb-tab').forEach(function(b) { b.classList.remove('on'); });
  if (btn) btn.classList.add('on');
  renderLB();
}

function renderLB() {
  var userName = userProfile ? userProfile.name : 'You';
  var userAvatar = userProfile ? userProfile.avatar : '&#128100;';

  // All-Time scales scores up; This Week uses base; Humans Only drops bots
  var scale = lbTab === 'all' ? 7.4 : 1;
  var roster = LB_PLAYERS.filter(function(p) { return lbTab === 'humans' ? !p.bot : true; });

  var all = roster.map(function(p) {
    return {
      e: p.f, nm: p.nm, bot: p.bot, you: false,
      trades: Math.round(p.trades * (lbTab === 'all' ? 4.2 : 1)),
      win: p.win,
      pnl: +(p.pnl * (lbTab === 'all' ? 1.6 : 1)).toFixed(1),
      pts: Math.round(p.xp * scale)
    };
  });

  // Estimate the user's win-rate / P&L from their portfolio
  var port = (typeof calcPortfolio === 'function') ? calcPortfolio() : { gainPct: 0 };
  all.push({
    e: userAvatar, nm: userName, bot: false, you: true,
    trades: tradeHistory.length,
    win: tradeHistory.length ? Math.min(95, 50 + Math.round(port.gainPct)) : 0,
    pnl: +(port.gainPct || 0).toFixed(1),
    pts: totalXP
  });

  all.sort(function(a, b) { return b.pts - a.pts; });
  all.forEach(function(u, i) { u.r = i + 1; });

  var maxPnl = Math.max.apply(null, all.map(function(u) { return Math.abs(u.pnl); }).concat([1]));

  // \u2500\u2500 Rank badge \u2500\u2500
  var userEntry = all.find(function(u) { return u.you; });
  var badge = document.getElementById('lbRankBadge');
  if (badge && userEntry) {
    badge.innerHTML = "You're ranked <b>#" + userEntry.r + "</b> &middot; " + userEntry.pts.toLocaleString() + ' XP';
  }
  var countEl = document.getElementById('lbCount');
  if (countEl) countEl.textContent = all.length + ' traders';

  // \u2500\u2500 Podium (2nd \u00B7 1st \u00B7 3rd) \u2500\u2500
  var top3 = all.slice(0, 3);
  var podOrder = [1, 0, 2];
  var medals = ['&#129352;', '&#128081;', '&#129353;']; // silver wreath, crown, bronze
  var podiumEl = document.getElementById('podium');
  if (podiumEl) {
    podiumEl.innerHTML = podOrder.map(function(oi) {
      var u = top3[oi];
      if (!u) return '';
      var barW = Math.min(100, Math.round(Math.abs(u.pnl) / maxPnl * 100));
      return '<div class="lb-pod' + (u.r === 1 ? ' lb-pod-1' : '') + (u.you ? ' you' : '') + '">'
        + '<div class="lb-pod-rank">' + medals[oi] + ' RANK #' + u.r + '</div>'
        + '<div class="lb-pod-user"><span class="lb-pod-av">' + u.e + '</span>'
        + '<div><div class="lb-pod-nm">' + u.nm + (u.you ? ' <span class="lb-you">(You)</span>' : '') + '</div>'
        + '<div class="lb-pod-sub">' + u.trades + ' trades &middot; ' + u.win + '% win</div></div></div>'
        + '<div class="lb-pod-xp">' + u.pts.toLocaleString() + ' XP</div>'
        + '<div class="lb-pod-pnl">' + (u.pnl >= 0 ? '+' : '') + u.pnl + '% P&L</div>'
        + '<div class="lb-pod-bar"><div style="width:' + barW + '%"></div></div>'
        + '</div>';
    }).join('');
  }

  // \u2500\u2500 Full ranking table \u2500\u2500
  var el = document.getElementById('lblist');
  if (!el) return;
  var header = '<div class="lb-row lb-row-head">'
    + '<span class="lb-c-rank">#</span><span class="lb-c-name">TRADER</span>'
    + '<span class="lb-c-num">TRADES</span><span class="lb-c-num">WIN RATE</span>'
    + '<span class="lb-c-num">P&L</span><span class="lb-c-num">XP</span></div>';
  el.innerHTML = header + all.map(function(u) {
    return '<div class="lb-row' + (u.you ? ' you' : '') + '">'
      + '<span class="lb-c-rank">#' + u.r + '</span>'
      + '<span class="lb-c-name"><span class="lb-flag">' + u.e + '</span>'
      + '<span class="lb-tname">' + u.nm + '</span>'
      + (u.bot ? '<span class="lb-bot">&#129302; bot</span>' : '')
      + (u.you ? '<span class="lb-you">You</span>' : '') + '</span>'
      + '<span class="lb-c-num">' + u.trades + '</span>'
      + '<span class="lb-c-num">' + u.win + '%</span>'
      + '<span class="lb-c-num ' + (u.pnl >= 0 ? 'pos' : 'neg') + '">' + (u.pnl >= 0 ? '&#8599; +' : '&#8600; ') + u.pnl + '%</span>'
      + '<span class="lb-c-num lb-xp">' + u.pts.toLocaleString() + '</span>'
      + '</div>';
  }).join('');
}


// ─── SIP CALCULATOR ──────────────────────────────────────
function calcSIP() {
  var monthly = parseFloat(document.getElementById('sipAmount').value) || 0;
  var rate = parseFloat(document.getElementById('sipRate').value) || 12;
  var years = parseFloat(document.getElementById('sipYears').value) || 5;

  if (monthly <= 0) return;

  var r = rate / 100 / 12;
  var n = years * 12;
  var invested = monthly * n;
  var futureValue = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  var returns = futureValue - invested;

  document.getElementById('sipInvested').textContent = fINR(invested);
  document.getElementById('sipReturns').textContent = fINR(returns);
  document.getElementById('sipTotal').textContent = fINR(futureValue);

  // Update progress bar
  var pct = invested / futureValue * 100;
  var bar = document.getElementById('sipBar');
  if (bar) {
    bar.innerHTML = '<div style="width:' + pct + '%;background:var(--teal);height:100%;border-radius:4px;transition:width .5s"></div>'
      + '<div style="width:' + (100 - pct) + '%;background:var(--gr);height:100%;border-radius:0 4px 4px 0;transition:width .5s"></div>';
  }
}

// ─── LUMPSUM CALCULATOR ──────────────────────────────────
function calcLumpsum() {
  var principal = parseFloat(document.getElementById('lsAmount').value) || 0;
  var rate = parseFloat(document.getElementById('lsRate').value) || 12;
  var years = parseFloat(document.getElementById('lsYears').value) || 5;

  if (principal <= 0) return;

  var futureValue = principal * Math.pow(1 + rate / 100, years);
  var returns = futureValue - principal;

  document.getElementById('lsInvested').textContent = fINR(principal);
  document.getElementById('lsReturns').textContent = fINR(returns);
  document.getElementById('lsTotal').textContent = fINR(futureValue);
}

// Keep the Resources calculators in sync with the active market: currency symbol
// in the amount labels + result placeholders, and re-run both calculations so
// values never show a stale currency.
function syncCalcCurrency() {
  var cur = (window.MKT || MARKETS[currentMarket]).cur;
  var amtLbls = { sipAmtLbl: 'Monthly Investment', lsAmtLbl: 'Investment Amount' };
  Object.keys(amtLbls).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = amtLbls[id] + ' (' + cur + ')';
  });
  ['sipInvested', 'sipReturns', 'sipTotal', 'lsInvested', 'lsReturns', 'lsTotal'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && /^[₹$]?0$/.test(el.textContent.trim())) el.textContent = cur + '0';
  });
  if (typeof calcSIP === 'function') calcSIP();
  if (typeof calcLumpsum === 'function') calcLumpsum();
}

// The "hold or reduce X" quick-ask must point at a stock that exists in the
// active market — hardcoding ONGC broke it in US/Crypto. Pick the user's
// largest holding; fall back to the market's first stock.
function syncTopHoldingChip() {
  var chip = document.getElementById('chipHold');
  if (!chip) return;
  var sym = null;
  if (window.HOLDS && HOLDS.length) {
    var top = HOLDS.slice().sort(function(a, b) {
      var pa = (window.prices && prices[a.sym]) || a.avgPrice || 0;
      var pb = (window.prices && prices[b.sym]) || b.avgPrice || 0;
      return (b.qty * pb) - (a.qty * pa);
    })[0];
    if (top) sym = top.sym;
  }
  if (!sym && window.ST && ST.length) sym = ST[0].s;
  if (!sym) return;
  chip.textContent = sym + ' advice';
  chip.setAttribute('onclick', "qs('Should I hold or reduce " + sym + "?')");
}

// ─── GLOSSARY ────────────────────────────────────────────
function renderGlossary(query) {
  var el = document.getElementById('glossaryList');
  if (!el) return;

  var q = (query || '').toLowerCase();
  var list = GLOSSARY.filter(function(g) {
    if (!q) return true;
    return g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q);
  });

  el.innerHTML = list.map(function(g) {
    var t = g.term.replace(/'/g, "\\'");
    return '<button class="gloss-item" onclick="askGloss(\'' + t + '\')">'
      + '<div class="gloss-term">' + g.term + ' <span class="gloss-ask">Ask Fin &#8594;</span></div>'
      + '<div class="gloss-def">' + g.def + '</div>'
      + '</button>';
  }).join('');
}

// ─── SEBI INLINE BOOKLET ──────────────────────────────────
function showSC(i, el) {
  document.querySelectorAll('.stab').forEach(function(t) { t.classList.remove('on'); });
  if (el) el.classList.add('on');
  var c = document.getElementById('sc');
  if (c && SEBI_CHAPS[i]) {
    c.innerHTML = SEBI_CHAPS[i];
    c.scrollTop = 0;
  }
}

// ─── WALLET UI ───────────────────────────────────────────
var walletAction = 'deposit';

function renderWallet() {
  var balEl = document.getElementById('walletBal');
  if (balEl) balEl.textContent = fINR(wallet.balance);

  var txnEl = document.getElementById('walletTxns');
  if (!txnEl) return;

  var txns = wallet.transactions.slice(0, 8);
  if (txns.length === 0) {
    txnEl.innerHTML = '<div class="wallet-txn-empty">No transactions yet</div>';
    return;
  }

  txnEl.innerHTML = txns.map(function(t) {
    var isCredit = t.type === 'deposit' || t.type === 'sell';
    var icon = t.type === 'deposit' ? '&#128994;' : (t.type === 'withdraw' ? '&#128308;' : (t.type === 'buy' ? '&#128308;' : '&#128994;'));
    return '<div class="wallet-txn">'
      + '<div class="wallet-txn-icon">' + icon + '</div>'
      + '<div class="wallet-txn-info"><div class="wallet-txn-desc">' + t.desc + '</div><div class="wallet-txn-time">' + getTimeAgo(t.time) + '</div></div>'
      + '<div class="wallet-txn-amt ' + (isCredit ? 'pos' : 'neg') + '">' + (isCredit ? '+' : '-') + fINR(t.amount) + '</div>'
      + '</div>';
  }).join('');
}

function showWalletModal(type) {
  walletAction = type;
  document.getElementById('walletModalTitle').textContent = type === 'deposit' ? 'Add Money' : 'Withdraw Money';
  document.getElementById('walletModalBal').textContent = fINR(wallet.balance);
  document.getElementById('walletAmtInp').value = '';
  var btn = document.getElementById('walletConfirmBtn');
  btn.textContent = type === 'deposit' ? 'Add Money' : 'Withdraw';
  btn.className = 'wallet-confirm-btn ' + type;
  document.getElementById('walletModal').classList.add('on');
}

function closeWalletModal() {
  document.getElementById('walletModal').classList.remove('on');
}

function setWalletAmt(amt) {
  document.getElementById('walletAmtInp').value = amt;
}

function confirmWalletAction() {
  var inp = document.getElementById('walletAmtInp');
  var raw = inp.value.trim();

  // Input validation
  if (!raw || raw === '') { showToast('Please enter an amount'); return; }
  var amt = parseInt(raw);
  if (isNaN(amt) || amt <= 0) { showToast('Enter a valid positive amount'); inp.value = ''; return; }
  if (amt < 100) { showToast('Minimum amount is \u20B9100'); return; }
  if (amt > 10000000) { showToast('Maximum amount is \u20B91,00,00,000'); return; }
  if (raw.includes('.') || raw.includes('-') || raw.includes('e')) { showToast('Enter a whole number without decimals'); inp.value = Math.abs(Math.floor(amt)); return; }

  if (walletAction === 'deposit') {
    walletDeposit(amt);
    showToast('&#128994; ' + fINR(amt) + ' added to wallet!');
  } else {
    if (amt > wallet.balance) { showToast('Insufficient balance! You have ' + fINR(wallet.balance)); return; }
    walletWithdraw(amt);
    showToast('&#128308; ' + fINR(amt) + ' withdrawn from wallet');
  }

  closeWalletModal();
  renderWallet();
}

// ─── FAB WELCOME BUBBLE ──────────────────────────────────
(function() {
  setTimeout(function() {
    var bubble = document.getElementById('fabBubble');
    if (bubble) bubble.classList.add('on');
    setTimeout(function() {
      if (bubble) bubble.classList.remove('on');
    }, 5000);
  }, 2000);
})();
