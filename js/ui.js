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
  community:   'Community',
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
  window.scrollTo(0, 0);

  // Refresh data when navigating
  if (id === 'dashboard') {
    renderHoldingsTable();
    updateDashboardStats();
  }
  if (id === 'leaderboard') renderLB();
  if (id === 'profile') renderProfile();
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
  if (el) el.textContent = userProfile.avatar || '\u{1F464}';

  el = document.getElementById('profDisplayName');
  if (el) el.textContent = userProfile.name;

  el = document.getElementById('profGoalDisplay');
  if (el) el.textContent = userProfile.goal || 'Learn investing basics';

  el = document.getElementById('profRiskDisplay');
  if (el) {
    var riskLabels = { low: 'Conservative', moderate: 'Moderate', high: 'Aggressive' };
    el.textContent = riskLabels[userProfile.risk] || 'Moderate';
  }

  var lv = getLv(totalXP);
  el = document.getElementById('profLevel');
  if (el) el.textContent = lv.l;

  el = document.getElementById('profXP');
  if (el) el.textContent = totalXP;

  el = document.getElementById('profLessons');
  if (el) el.textContent = completedL.size + '/15';

  el = document.getElementById('profTrades');
  if (el) el.textContent = tradeHistory.length;

  el = document.getElementById('profStreak');
  if (el) el.textContent = streakData.count + ' days';

  el = document.getElementById('profHoldings');
  if (el) el.textContent = HOLDS.length + ' stocks';

  var port = calcPortfolio();
  el = document.getElementById('profPortValue');
  if (el) el.textContent = fINR(port.totalValue);

  el = document.getElementById('profJoined');
  if (el) {
    var d = new Date(userProfile.createdAt);
    el.textContent = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Achievements
  renderAchievements();

  // Wallet
  renderWallet();
}

function renderAchievements() {
  var el = document.getElementById('achievementsList');
  if (!el) return;

  var achievements = [
    { id: 'first_trade', icon: '&#128176;', title: 'First Trade', desc: 'Complete your first buy or sell', done: tradeHistory.length > 0 },
    { id: 'five_lessons', icon: '&#128218;', title: 'Knowledge Seeker', desc: 'Complete 5 lessons', done: completedL.size >= 5 },
    { id: 'all_lessons', icon: '&#127942;', title: 'Scholar', desc: 'Complete all 15 lessons', done: completedL.size >= 15 },
    { id: 'diversified', icon: '&#127919;', title: 'Diversified', desc: 'Hold stocks from 3+ sectors', done: calcPortfolio().sectorCount >= 3 },
    { id: 'ten_trades', icon: '&#128202;', title: 'Active Trader', desc: 'Complete 10 trades', done: tradeHistory.length >= 10 },
    { id: 'level4', icon: '&#9889;', title: 'Trader Rank', desc: 'Reach Level 4', done: getLv(totalXP).num >= 4 },
    { id: 'streak7', icon: '&#128293;', title: 'On Fire', desc: '7-day login streak', done: streakData.count >= 7 },
    { id: 'legend', icon: '&#128081;', title: 'Legend', desc: 'Reach Level 7 \u2014 Legend', done: getLv(totalXP).num >= 7 },
  ];

  el.innerHTML = achievements.map(function(a) {
    return '<div class="ach-card ' + (a.done ? 'ach-done' : 'ach-locked') + '">'
      + '<div class="ach-icon">' + a.icon + '</div>'
      + '<div class="ach-info"><div class="ach-title">' + a.title + '</div><div class="ach-desc">' + a.desc + '</div></div>'
      + (a.done ? '<div class="ach-check">&#10003;</div>' : '<div class="ach-lock">&#128274;</div>')
      + '</div>';
  }).join('');
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
function renderLB() {
  var userName = userProfile ? userProfile.name : 'You';
  var userAvatar = userProfile ? userProfile.avatar : '&#128100;';

  // Bot players with semi-random but consistent scores
  var bots = [
    { e:'&#128081;', nm:'Arjun K.',  lv:'Level 7 \u00B7 Legend',       basePts:4920 },
    { e:'&#129489;', nm:'Priya M.',  lv:'Level 6 \u00B7 Fund Manager', basePts:3840 },
    { e:'&#128105;', nm:'Sneha R.',  lv:'Level 5 \u00B7 Sr. Trader',   basePts:3410 },
    { e:'&#129474;', nm:'Rahul V.',  lv:'Level 4 \u00B7 Trader',       basePts:2980 },
    { e:'&#128105;', nm:'Divya S.',  lv:'Level 3 \u00B7 Analyst',      basePts:380 },
    { e:'&#128102;', nm:'Karan M.',  lv:'Level 2 \u00B7 Learner',      basePts:290 },
    { e:'&#128102;', nm:'Aditya P.', lv:'Level 2 \u00B7 Learner',      basePts:210 },
  ];

  // Build full list including user
  var all = bots.map(function(b) {
    return { e: b.e, nm: b.nm, lv: b.lv, pts: b.basePts, you: false };
  });

  all.push({
    e: userAvatar,
    nm: userName,
    lv: getLv(totalXP).l,
    pts: totalXP,
    you: true
  });

  // Sort by points descending
  all.sort(function(a, b) { return b.pts - a.pts; });

  // Assign ranks
  all.forEach(function(u, i) { u.r = i + 1; });

  var rankColors = ['var(--gd)', '#aaa', '#cd7f32'];

  // Update podium
  var top3 = all.slice(0, 3);
  // Podium order: 2nd, 1st, 3rd
  var podOrder = [1, 0, 2];
  var podClasses = ['p2', 'p1', 'p3'];
  var podiumEl = document.getElementById('podium');
  if (podiumEl) {
    podiumEl.innerHTML = podOrder.map(function(idx, pi) {
      var u = top3[idx];
      if (!u) return '';
      var isYou = u.you;
      var avStyle = idx === 0 ? 'background:rgba(255,181,71,.15);border:2px solid var(--gd)' : (idx === 1 ? 'background:rgba(200,200,200,.1)' : 'background:rgba(205,127,50,.15)');
      return '<div class="pod ' + podClasses[pi] + (isYou ? ' pod-you' : '') + '">'
        + '<div class="pav" style="' + avStyle + '">' + u.e + '</div>'
        + '<div class="pnm">' + u.nm + (isYou ? ' <span style="color:var(--gr);font-size:9px">(You)</span>' : '') + '</div>'
        + '<div class="ppts">' + u.pts.toLocaleString() + ' pts</div>'
        + '<div class="pblk">' + u.r + '</div></div>';
    }).join('');
  }

  // Update challenge timer
  var timerEl = document.getElementById('lbTimer');
  if (timerEl) {
    var now = new Date();
    var sun = new Date(now);
    sun.setDate(sun.getDate() + (7 - sun.getDay()) % 7);
    sun.setHours(23, 59, 59, 999);
    var diff = sun - now;
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    timerEl.textContent = 'Resets in ' + days + 'd ' + hours + 'h';
  }

  // Full rankings list
  var el = document.getElementById('lblist');
  if (!el) return;

  el.innerHTML = all.map(function(u, i) {
    return '<div class="lbi' + (u.you ? ' you' : '') + '">'
      + '<div class="lbrk" style="color:' + (i < 3 ? rankColors[i] : 'var(--mu)') + '">' + u.r + '</div>'
      + '<div class="lbav">' + u.e + '</div>'
      + '<div class="lbu">'
      + '<div class="lbnm">' + u.nm + (u.you ? ' <span style="color:var(--gr);font-size:10px">\u2190 You</span>' : '') + '</div>'
      + '<div class="lblv">' + u.lv + '</div>'
      + '</div>'
      + '<div><div class="lbpts">' + u.pts.toLocaleString() + '</div><div class="lbpl">pts</div></div>'
      + '</div>';
  }).join('');

  // Show user rank summary
  var userEntry = all.find(function(u) { return u.you; });
  var rankSummary = document.getElementById('lbRankSummary');
  if (rankSummary && userEntry) {
    var nextUser = all[userEntry.r - 2]; // person above
    if (nextUser && !nextUser.you) {
      var gap = nextUser.pts - userEntry.pts;
      rankSummary.innerHTML = 'You\'re <b>#' + userEntry.r + '</b> &mdash; <span style="color:var(--gd)">' + gap + ' XP</span> to overtake ' + nextUser.nm;
    } else {
      rankSummary.innerHTML = 'You\'re <b>#' + userEntry.r + '</b> &mdash; <span style="color:var(--gr)">Top of the board!</span>';
    }
  }
}

// ─── COMMUNITY ────────────────────────────────────────────
var joinedRooms = Store.get('joinedRooms', {});

function joinRoom(type) {
  if (!userProfile) { showProfilePrompt(); return; }
  if (joinedRooms[type]) {
    showToast('\u2705 Already in ' + (type === 'beginner' ? 'Beginner' : 'Intermediate') + ' Room!');
    return;
  }
  joinedRooms[type] = true;
  Store.set('joinedRooms', joinedRooms);
  addXP(50, '\uD83C\uDF89 Joined ' + (type === 'beginner' ? 'Beginner' : 'Intermediate') + ' Room! +50 XP');
  updateRoomUI();
}

function updateRoomUI() {
  ['beginner', 'intermediate'].forEach(function(type) {
    var btnId = type === 'beginner' ? 'joinBegBtn' : 'joinIntBtn';
    var btn = document.getElementById(btnId);
    var card = document.getElementById('room-' + type);
    if (joinedRooms[type]) {
      if (btn) {
        btn.textContent = '\u2705 Joined';
        btn.classList.add('joined');
        btn.disabled = true;
      }
      if (card) card.classList.add('room-joined');
    }
  });
}

function participateChallenge(id, xp, msg) {
  if (!userProfile) { showProfilePrompt(); return; }
  if (completedChallenges[id]) {
    showToast('Already completed this challenge!');
    return;
  }
  completedChallenges[id] = true;
  Store.set('challenges', completedChallenges);
  addXP(xp, msg);

  // Disable the button
  var btn = document.querySelector('[data-challenge="' + id + '"]');
  if (btn) {
    btn.textContent = 'Done \u2713';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
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
    bar.innerHTML = '<div style="width:' + pct + '%;background:var(--bl);height:100%;border-radius:4px;transition:width .5s"></div>'
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
    return '<div class="gloss-item">'
      + '<div class="gloss-term">' + g.term + '</div>'
      + '<div class="gloss-def">' + g.def + '</div>'
      + '</div>';
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
  var amt = parseInt(document.getElementById('walletAmtInp').value) || 0;
  if (amt <= 0) { showToast('Enter a valid amount'); return; }

  if (walletAction === 'deposit') {
    walletDeposit(amt);
    showToast('&#128994; ' + fINR(amt) + ' added to wallet!');
  } else {
    if (amt > wallet.balance) { showToast('Insufficient balance!'); return; }
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
