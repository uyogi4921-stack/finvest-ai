/* ═══════════════════════════════════════════════════════════
   FINVEST AI — Backend Server
   Express server with user data storage and admin panel

   Usage:
     npm start          → Production (port 3000)
     npm run dev         → Development with auto-reload
═══════════════════════════════════════════════════════════ */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIG ─────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'finvest2024';
const DATA_FILE = path.join(__dirname, 'data', 'users.json');
const ADMIN_TOKENS = new Set();

// ─── MIDDLEWARE ──────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

// CORS for local development
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});

// ─── DATA HELPERS ────────────────────────────────────────
function readUsers() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '{}');
    }
    var raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('Error reading users:', e.message);
    return {};
  }
}

function writeUsers(data) {
  try {
    var dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error writing users:', e.message);
  }
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

// ─── ADMIN AUTH ──────────────────────────────────────────
function adminAuth(req, res, next) {
  var token = req.headers.authorization;
  if (!token || !ADMIN_TOKENS.has(token)) {
    return res.status(401).json({ error: 'Unauthorized — admin login required' });
  }
  next();
}

// ─── API: ADMIN LOGIN ────────────────────────────────────
app.post('/api/admin/login', function(req, res) {
  var password = req.body.password;
  if (password === ADMIN_PASSWORD) {
    var token = crypto.randomBytes(32).toString('hex');
    ADMIN_TOKENS.add(token);
    // Clean old tokens (keep max 10)
    if (ADMIN_TOKENS.size > 10) {
      var arr = Array.from(ADMIN_TOKENS);
      ADMIN_TOKENS.delete(arr[0]);
    }
    res.json({ success: true, token: token });
  } else {
    res.status(403).json({ error: 'Invalid password' });
  }
});

// ─── API: USER SYNC ──────────────────────────────────────
// Users send their data to the server for admin visibility
app.post('/api/users/sync', function(req, res) {
  var data = req.body;
  if (!data || !data.profile || !data.profile.name) {
    return res.status(400).json({ error: 'Invalid user data' });
  }

  var users = readUsers();
  var userId = data.userId || generateId();

  users[userId] = {
    id: userId,
    profile: {
      name: data.profile.name,
      avatar: data.profile.avatar || '',
      goal: data.profile.goal || '',
      risk: data.profile.risk || 'moderate',
      createdAt: data.profile.createdAt || Date.now()
    },
    stats: {
      xp: data.xp || 0,
      level: data.level || 'Level 1',
      streak: data.streak || 0,
      lessonsCompleted: data.lessonsCompleted || 0,
      totalTrades: data.totalTrades || 0,
      holdingsCount: data.holdingsCount || 0,
      portfolioValue: data.portfolioValue || 0,
      walletBalance: data.walletBalance || 0
    },
    holdings: (data.holdings || []).map(function(h) {
      return { sym: h.sym, qty: h.qty, avgPrice: h.avgPrice };
    }),
    recentTrades: (data.recentTrades || []).slice(0, 20),
    lastActive: Date.now(),
    lastIP: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: (req.headers['user-agent'] || '').substring(0, 200)
  };

  writeUsers(users);
  res.json({ success: true, userId: userId });
});

// ─── API: ADMIN — GET ALL USERS ──────────────────────────
app.get('/api/admin/users', adminAuth, function(req, res) {
  var users = readUsers();
  var list = Object.values(users);

  // Sort by last active (most recent first)
  list.sort(function(a, b) { return (b.lastActive || 0) - (a.lastActive || 0); });

  // Compute summary stats
  var totalUsers = list.length;
  var activeToday = list.filter(function(u) {
    return (Date.now() - (u.lastActive || 0)) < 86400000;
  }).length;
  var totalXP = list.reduce(function(sum, u) { return sum + (u.stats.xp || 0); }, 0);
  var totalTrades = list.reduce(function(sum, u) { return sum + (u.stats.totalTrades || 0); }, 0);

  res.json({
    summary: {
      totalUsers: totalUsers,
      activeToday: activeToday,
      totalXP: totalXP,
      totalTrades: totalTrades
    },
    users: list
  });
});

// ─── API: ADMIN — GET SINGLE USER ────────────────────────
app.get('/api/admin/users/:id', adminAuth, function(req, res) {
  var users = readUsers();
  var user = users[req.params.id];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── API: ADMIN — DELETE USER ────────────────────────────
app.delete('/api/admin/users/:id', adminAuth, function(req, res) {
  var users = readUsers();
  if (!users[req.params.id]) return res.status(404).json({ error: 'User not found' });
  delete users[req.params.id];
  writeUsers(users);
  res.json({ success: true });
});

// ─── API: ADMIN — DASHBOARD STATS ────────────────────────
app.get('/api/admin/stats', adminAuth, function(req, res) {
  var users = readUsers();
  var list = Object.values(users);

  var now = Date.now();
  var oneDay = 86400000;
  var oneWeek = 7 * oneDay;

  // Activity over time
  var activeToday = 0, activeWeek = 0;
  var sectorMap = {};
  var levelMap = {};
  var tradesByDay = {};

  list.forEach(function(u) {
    if (now - (u.lastActive || 0) < oneDay) activeToday++;
    if (now - (u.lastActive || 0) < oneWeek) activeWeek++;

    var lv = u.stats.level || 'Level 1';
    levelMap[lv] = (levelMap[lv] || 0) + 1;

    (u.holdings || []).forEach(function(h) {
      sectorMap[h.sym] = (sectorMap[h.sym] || 0) + 1;
    });

    (u.recentTrades || []).forEach(function(t) {
      var day = new Date(t.time).toDateString();
      tradesByDay[day] = (tradesByDay[day] || 0) + 1;
    });
  });

  // Top stocks held
  var topStocks = Object.keys(sectorMap).sort(function(a, b) {
    return sectorMap[b] - sectorMap[a];
  }).slice(0, 10).map(function(s) {
    return { sym: s, count: sectorMap[s] };
  });

  res.json({
    totalUsers: list.length,
    activeToday: activeToday,
    activeWeek: activeWeek,
    levelDistribution: levelMap,
    topStocks: topStocks,
    tradesByDay: tradesByDay
  });
});

// ─── API: ADMIN — CHANGE PASSWORD ────────────────────────
app.post('/api/admin/change-password', adminAuth, function(req, res) {
  var newPass = req.body.newPassword;
  if (!newPass || newPass.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  // Write to a config file
  var configFile = path.join(__dirname, 'data', 'config.json');
  var config = {};
  try {
    if (fs.existsSync(configFile)) {
      config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    }
  } catch(e) {}
  config.adminPassword = newPass;
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  res.json({ success: true, message: 'Password changed. Restart server to apply.' });
});

// ─── SERVE ADMIN PAGE ────────────────────────────────────
app.get('/admin', function(req, res) {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ─── FALLBACK — SPA ──────────────────────────────────────
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── START SERVER ────────────────────────────────────────
app.listen(PORT, function() {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════╗');
  console.log('  ║   FINVEST AI — Server Running             ║');
  console.log('  ║                                           ║');
  console.log('  ║   App:   http://localhost:' + PORT + '             ║');
  console.log('  ║   Admin: http://localhost:' + PORT + '/admin       ║');
  console.log('  ║                                           ║');
  console.log('  ║   Admin Password: ' + ADMIN_PASSWORD + '          ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
});
