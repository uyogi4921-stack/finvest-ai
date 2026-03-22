/* ═══════════════════════════════════════════════════════════
   FINVEST AI — market.js
   Market page: stock logos, B/S buttons, price simulation
   Holdings management with persistence
═══════════════════════════════════════════════════════════ */

'use strict';

window.prices  = {};
window.idxP    = {};
window.tabSec  = 'All';
window.curPage = 'dashboard';

// ─── HELPERS ─────────────────────────────────────────────
function rw(p) { return +(p + p * (Math.random() * .006 - .003)).toFixed(2); }
function fINR(n) { return '\u20B9' + Math.round(n).toLocaleString('en-IN'); }

// ─── STOCK LOGO ───────────────────────────────────────────
function mkLogo(sym, sz) {
  sz = sz || 34;
  var s = ST.find(function(x) { return x.s === sym; });
  var w = document.createElement('div');
  w.style.cssText = [
    'width:' + sz + 'px',
    'height:' + sz + 'px',
    'border-radius:8px',
    'flex-shrink:0',
    'background:' + (s ? s.c : '#333'),
    'position:relative',
    'overflow:hidden',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';');

  var fb = document.createElement('div');
  fb.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:9px;font-family:Syne,sans-serif;color:#fff;';
  fb.textContent = sym.slice(0, 4);
  w.appendChild(fb);

  if (s && s.d) {
    var img = document.createElement('img');
    img.src = 'https://logo.clearbit.com/' + s.d;
    img.alt = sym;
    img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:3px;background:#fff;border-radius:8px;';
    img.onload  = function() { fb.style.display = 'none'; };
    img.onerror = function() { img.remove(); fb.style.display = 'flex'; };
    w.appendChild(img);
  }
  return w;
}

function mkHCell(sym, name, qty) {
  var w = document.createElement('div');
  w.className = 'hstk';
  w.appendChild(mkLogo(sym, 34));
  var i = document.createElement('div');
  i.innerHTML = '<div class="hnm">' + sym + '</div><div class="hqty">' + name + ' &middot; ' + qty + '</div>';
  w.appendChild(i);
  return w;
}

// ─── PORTFOLIO CALCULATIONS ──────────────────────────────
function calcPortfolio() {
  var totalValue = 0;
  var totalInvested = 0;
  var sectorAlloc = {};

  HOLDS.forEach(function(h) {
    var p = prices[h.sym] || ST.find(function(s) { return s.s === h.sym; }).p;
    var val = h.qty * p;
    var inv = h.qty * h.avgPrice;
    totalValue += val;
    totalInvested += inv;

    var stk = ST.find(function(s) { return s.s === h.sym; });
    var sec = stk ? stk.sec : 'Other';
    sectorAlloc[sec] = (sectorAlloc[sec] || 0) + val;
  });

  return {
    totalValue: totalValue,
    totalInvested: totalInvested,
    totalGain: totalValue - totalInvested,
    gainPct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested * 100) : 0,
    sectorAlloc: sectorAlloc,
    stockCount: HOLDS.length,
    sectorCount: Object.keys(sectorAlloc).length
  };
}

// ─── HOLDINGS INIT ────────────────────────────────────────
function initHoldings() {
  renderHoldingsTable();
  updateDashboardStats();
}

function renderHoldingsTable() {
  var container = document.getElementById('holdingsBody');
  if (!container) return;
  container.innerHTML = '';

  if (HOLDS.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:28px;color:var(--mu);grid-column:1/-1;">No holdings yet. Go to Market to buy stocks!</div>';
    return;
  }

  HOLDS.forEach(function(h, i) {
    var stk = ST.find(function(s) { return s.s === h.sym; });
    var p = prices[h.sym] || (stk ? stk.p : 0);
    var val = h.qty * p;
    var inv = h.qty * h.avgPrice;
    var pnl = val - inv;
    var pnlPct = inv > 0 ? (pnl / inv * 100) : 0;
    var pos = pnl >= 0;

    var row = document.createElement('div');
    row.className = 'hr';
    row.innerHTML = '';

    var cell1 = document.createElement('div');
    cell1.className = 'hstk';
    cell1.appendChild(mkLogo(h.sym, 34));
    var info = document.createElement('div');
    info.innerHTML = '<div class="hnm">' + h.sym + '</div><div class="hqty">' + h.name + ' &middot; ' + h.qty + ' shares</div>';
    cell1.appendChild(info);

    var cell2 = document.createElement('div');
    cell2.className = 'hval';
    cell2.id = 'hp' + i;
    cell2.textContent = fINR(p);

    var cell3 = document.createElement('div');
    cell3.className = 'hval';
    cell3.textContent = fINR(val);

    var cell4 = document.createElement('div');
    cell4.className = 'hval ' + (pos ? 'pos' : 'neg');
    cell4.textContent = (pos ? '+' : '') + pnlPct.toFixed(1) + '%';

    row.appendChild(cell1);
    row.appendChild(cell2);
    row.appendChild(cell3);
    row.appendChild(cell4);
    container.appendChild(row);
  });
}

function updateDashboardStats() {
  var port = calcPortfolio();
  var pos = port.totalGain >= 0;

  var bal = document.getElementById('dashBal');
  if (bal) bal.textContent = fINR(port.totalValue);

  var chg = document.getElementById('dashChg');
  if (chg) {
    chg.className = 'h-chg ' + (pos ? '' : 'neg-chg');
    chg.innerHTML = (pos ? '&#8593; +' : '&#8595; ') + fINR(Math.abs(port.totalGain)) + ' (' + Math.abs(port.gainPct).toFixed(2) + '%) all-time';
  }

  var inv = document.getElementById('dashInvested');
  if (inv) inv.textContent = fINR(port.totalInvested);

  var invSub = document.getElementById('dashInvSub');
  if (invSub) invSub.textContent = 'Across ' + port.stockCount + ' stocks';

  var gain = document.getElementById('dashGain');
  if (gain) {
    gain.textContent = (pos ? '+' : '') + fINR(port.totalGain);
    gain.className = 'ds-val ' + (pos ? 'pos' : 'neg');
  }

  var gainSub = document.getElementById('dashGainSub');
  if (gainSub) {
    gainSub.textContent = (pos ? '+' : '') + port.gainPct.toFixed(2) + '% all-time';
    gainSub.className = 'ds-sub ' + (pos ? 'pos' : 'neg');
  }

  // Render sector chart
  renderSectorChart(port.sectorAlloc, port.totalValue);

  // Render recent activity
  renderRecentActivity();
}

// ─── SECTOR CHART (Canvas) ──────────────────────────────
function renderSectorChart(alloc, total) {
  var canvas = document.getElementById('sectorCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.offsetWidth * 2;
  var h = canvas.height = canvas.offsetHeight * 2;
  ctx.clearRect(0, 0, w, h);

  var cx = w * 0.35, cy = h / 2, r = Math.min(cx, cy) - 20;
  var colors = { IT: '#4d9fff', Banking: '#00e5a0', Energy: '#ff7b3a', Auto: '#9b6dff', FMCG: '#ffb547', Pharma: '#ff4d6a', Metals: '#cd7f32', Infra: '#2ecc71', Telecom: '#e74c3c', Chemicals: '#1abc9c', Realty: '#e67e22' };
  var sectors = Object.keys(alloc);
  if (sectors.length === 0) return;

  var angle = -Math.PI / 2;
  sectors.forEach(function(sec) {
    var pct = alloc[sec] / total;
    var sweep = pct * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = colors[sec] || '#666';
    ctx.fill();
    angle += sweep;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1221';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#f0f4ff';
  ctx.font = 'bold ' + (r * 0.22) + 'px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sectors.length + ' Sectors', cx, cy - 5);
  ctx.font = (r * 0.15) + 'px DM Sans, sans-serif';
  ctx.fillStyle = '#6b7a99';
  ctx.fillText(HOLDS.length + ' Stocks', cx, cy + r * 0.2);

  // Legend
  var legendEl = document.getElementById('sectorLegend');
  if (legendEl) {
    legendEl.innerHTML = sectors.map(function(sec) {
      var pct = (alloc[sec] / total * 100).toFixed(1);
      return '<div class="slg-item"><div class="slg-dot" style="background:' + (colors[sec] || '#666') + '"></div><span class="slg-name">' + sec + '</span><span class="slg-pct">' + pct + '%</span></div>';
    }).join('');
  }
}

// ─── RECENT ACTIVITY ────────────────────────────────────
function renderRecentActivity() {
  var el = document.getElementById('activityList');
  if (!el) return;

  var items = tradeHistory.slice(-5).reverse();
  if (items.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--mu);font-size:12px">No trades yet. Start trading in the Market!</div>';
    return;
  }

  el.innerHTML = items.map(function(t) {
    var isBuy = t.type === 'buy';
    var icon = isBuy ? '&#128994;' : '&#128308;';
    var label = isBuy ? 'Bought' : 'Sold';
    var timeAgo = getTimeAgo(t.time);
    return '<div class="act-item">'
      + '<div class="act-icon" style="color:' + (isBuy ? 'var(--gr)' : 'var(--rd)') + '">' + icon + '</div>'
      + '<div class="act-info"><div class="act-title">' + label + ' ' + t.qty + ' ' + t.sym + '</div><div class="act-sub">' + fINR(t.total) + ' &middot; ' + timeAgo + '</div></div>'
      + '</div>';
  }).join('');
}

function getTimeAgo(ts) {
  var diff = Date.now() - ts;
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  return days + 'd ago';
}

// ─── INDEX STRIP ─────────────────────────────────────────
function renderIdx() {
  var el = document.getElementById('ixstrip');
  if (!el) return;
  el.innerHTML = IDX.map(function(x) {
    var v = idxP[x.n], ch = ((v - x.b) / x.b * 100).toFixed(2), pos = ch >= 0;
    return '<div class="ixchip">'
      + '<div class="ixnm">' + x.n + '</div>'
      + '<div class="ixv" style="color:' + (pos ? 'var(--gr)' : 'var(--rd)') + '">'
      + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }) + '</div>'
      + '<div class="ixc ' + (pos ? 'pos' : 'neg') + '">' + (pos ? '&#9650;' : '&#9660;') + ' ' + Math.abs(ch) + '%</div>'
      + '</div>';
  }).join('');
}

// ─── MARKET GRID ─────────────────────────────────────────
function renderMkt(q) {
  q = (q || '').toLowerCase();
  var grid = document.getElementById('mgrid');
  if (!grid) return;

  var list = ST.filter(function(s) {
    if (tabSec !== 'All' && s.sec !== tabSec) return false;
    if (q && !s.s.toLowerCase().includes(q)
          && !s.n.toLowerCase().includes(q)
          && !s.sec.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!list.length) {
    grid.innerHTML = '<div style="color:var(--mu);padding:28px;text-align:center;grid-column:1/-1">No stocks found</div>';
    return;
  }

  grid.innerHTML = '';
  list.forEach(function(s) {
    var p   = prices[s.s] || s.p;
    var ch  = +((p - s.p) / s.p * 100).toFixed(2);
    var pos = ch >= 0;
    var inWL = watchlist.indexOf(s.s) !== -1;

    var card = document.createElement('div');
    card.className = 'scard';
    (function(sym) {
      card.onclick = function() { openStockDetail(sym); };
    })(s.s);

    var left = document.createElement('div');
    left.className = 'scl';
    left.appendChild(mkLogo(s.s, 36));
    var info = document.createElement('div');
    info.innerHTML = '<div class="scnm">' + s.s + (inWL ? ' <span style="color:var(--gd);font-size:10px">&#9733;</span>' : '') + '</div><div class="scsec">' + s.n + '</div>';
    left.appendChild(info);
    card.appendChild(left);

    var mid = document.createElement('div');
    mid.className = 'scm';
    mid.innerHTML = '<div class="scp">' + fINR(p) + '</div>'
      + '<div class="scc ' + (pos ? 'pos' : 'neg') + '">'
      + (pos ? '&#9650;' : '&#9660;') + ' ' + Math.abs(ch) + '%</div>';
    card.appendChild(mid);

    var btns = document.createElement('div');
    btns.className = 'scbtns';

    var bb = document.createElement('button');
    bb.className = 'btnb';
    bb.textContent = 'B';
    bb.title = 'Buy ' + s.s;
    (function(sym) {
      bb.onclick = function(e) { e.stopPropagation(); openBS(sym, 'buy'); };
    })(s.s);

    var sb = document.createElement('button');
    sb.className = 'btns';
    sb.textContent = 'S';
    sb.title = 'Sell ' + s.s;
    (function(sym) {
      sb.onclick = function(e) { e.stopPropagation(); openBS(sym, 'sell'); };
    })(s.s);

    btns.appendChild(bb);
    btns.appendChild(sb);
    card.appendChild(btns);
    grid.appendChild(card);
  });
}

function setTab(sec, btn) {
  tabSec = sec;
  document.querySelectorAll('.mtab').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
  renderMkt(document.getElementById('mktQ').value || '');
}

function clearMkt() {
  document.getElementById('mktQ').value = '';
  document.getElementById('mktClr').style.display = 'none';
  renderMkt('');
}

// ─── PRICE SIMULATION ────────────────────────────────────
function tickPrices() {
  ST.forEach(function(s) { prices[s.s] = rw(prices[s.s]); });
  IDX.forEach(function(x) { idxP[x.n] = rw(idxP[x.n]); });

  if (curPage === 'market') {
    renderIdx();
    renderMkt(document.getElementById('mktQ').value || '');
  }

  // Update dashboard dynamically
  if (curPage === 'dashboard') {
    renderHoldingsTable();
    updateDashboardStats();
  }
}

// ─── BUY / SELL MODAL ────────────────────────────────────
var BSC = { sym: '', type: '', price: 0 };

function openBS(sym, type) {
  if (!userProfile) {
    showProfilePrompt();
    return;
  }

  var s = ST.find(function(x) { return x.s === sym; });
  if (!s) return;

  BSC = { sym: sym, type: type, price: prices[sym] || s.p };

  document.getElementById('bssym').textContent   = sym;
  document.getElementById('bsnm').textContent    = s.n + ' \u00B7 ' + s.sec;
  document.getElementById('bsprice').textContent = fINR(BSC.price);

  var isBuy = type === 'buy';
  document.getElementById('bstype').innerHTML    = isBuy ? '&#128994; BUY ORDER' : '&#128308; SELL ORDER';
  document.getElementById('bstype').style.color  = isBuy ? 'var(--gr)' : 'var(--rd)';

  // Show current holding info for sell
  if (!isBuy) {
    var hold = HOLDS.find(function(h) { return h.sym === sym; });
    if (hold) {
      document.getElementById('bstype').innerHTML += ' <span style="font-size:10px;opacity:.7">(You own ' + hold.qty + ')</span>';
    }
  }

  var ok = document.getElementById('bsok');
  ok.textContent = isBuy ? 'Confirm Buy' : 'Confirm Sell';
  ok.style.background = isBuy
    ? 'linear-gradient(135deg,var(--gr),#00a87a)'
    : 'linear-gradient(135deg,var(--rd),#c41b3a)';
  ok.style.color = isBuy ? '#060912' : '#fff';

  var lw = document.getElementById('bslogo');
  lw.innerHTML = '';
  lw.style.cssText = 'width:44px;height:44px;border-radius:10px;flex-shrink:0;background:' + s.c + ';position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;';
  var fb2 = document.createElement('div');
  fb2.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;font-family:Syne,sans-serif;color:#fff;';
  fb2.textContent = sym.slice(0, 4);
  lw.appendChild(fb2);
  if (s.d) {
    var img2 = document.createElement('img');
    img2.src = 'https://logo.clearbit.com/' + s.d;
    img2.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:4px;background:#fff;border-radius:10px;z-index:1;';
    img2.onload  = function() { fb2.style.display = 'none'; };
    img2.onerror = function() { img2.remove(); fb2.style.display = 'flex'; };
    lw.appendChild(img2);
  }

  document.getElementById('bsqty').value = '1';
  updBS();
  document.getElementById('bsov').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function updBS() {
  var q = parseInt(document.getElementById('bsqty').value) || 0;
  document.getElementById('bstotal').textContent = fINR(q * BSC.price);
}

function confirmBS() {
  var q = parseInt(document.getElementById('bsqty').value) || 0;
  if (q < 1) { showToast('Enter at least 1 share'); return; }

  var isBuy = BSC.type === 'buy';
  var total = q * BSC.price;

  if (isBuy) {
    // Add to holdings
    var existing = HOLDS.find(function(h) { return h.sym === BSC.sym; });
    if (existing) {
      var oldTotal = existing.qty * existing.avgPrice;
      var newTotal = q * BSC.price;
      existing.avgPrice = Math.round((oldTotal + newTotal) / (existing.qty + q));
      existing.qty += q;
    } else {
      var stk = ST.find(function(s) { return s.s === BSC.sym; });
      HOLDS.push({
        sym: BSC.sym,
        name: stk ? stk.n : BSC.sym,
        qty: q,
        avgPrice: Math.round(BSC.price)
      });
    }
  } else {
    // Remove from holdings
    var hold = HOLDS.find(function(h) { return h.sym === BSC.sym; });
    if (hold) {
      hold.qty -= q;
      if (hold.qty <= 0) {
        HOLDS = HOLDS.filter(function(h) { return h.sym !== BSC.sym; });
        window.HOLDS = HOLDS;
      }
    }
  }

  // Save holdings
  Store.set('holdings', HOLDS);

  // Record trade
  tradeHistory.push({
    sym: BSC.sym,
    type: BSC.type,
    qty: q,
    price: Math.round(BSC.price),
    total: Math.round(total),
    time: Date.now()
  });
  Store.set('trades', tradeHistory);

  showToast((isBuy ? '\uD83D\uDFE2 Bought ' : '\uD83D\uDD34 Sold ') + q + ' ' + BSC.sym + ' for ' + fINR(total));
  addXP(10, '\u26A1 +10 XP for ' + (isBuy ? 'buying' : 'selling') + '!');

  // Refresh dashboard
  renderHoldingsTable();
  updateDashboardStats();

  closeBSModal();
}

function closeBSModal() {
  document.getElementById('bsov').classList.remove('on');
  document.body.style.overflow = '';
}

// ─── WATCHLIST ──────────────────────────────────────────
function toggleWatchlist(sym) {
  var idx = watchlist.indexOf(sym);
  if (idx !== -1) {
    watchlist.splice(idx, 1);
    showToast(sym + ' removed from watchlist');
  } else {
    watchlist.push(sym);
    showToast(sym + ' added to watchlist');
  }
  Store.set('watchlist', watchlist);
  renderMkt(document.getElementById('mktQ') ? document.getElementById('mktQ').value : '');
}

// ─── STOCK DETAIL MODAL (TradingView Chart) ────────────
// NSE symbol mapping for TradingView
var TV_MAP = {
  TCS: 'NSE:TCS', INFY: 'NSE:INFY', WIPRO: 'NSE:WIPRO', HCLT: 'NSE:HCLTECH',
  TECHM: 'NSE:TECHM', HDFC: 'NSE:HDFCBANK', ICICI: 'NSE:ICICIBANK', SBI: 'NSE:SBIN',
  AXIS: 'NSE:AXISBANK', KOTAK: 'NSE:KOTAKBANK', RELI: 'NSE:RELIANCE', ONGC: 'NSE:ONGC',
  BPCL: 'NSE:BPCL', IOC: 'NSE:IOC', TATAM: 'NSE:TATAMOTORS', MM: 'NSE:M&M',
  MARUTI: 'NSE:MARUTI', BAJAJ: 'NSE:BAJAJ-AUTO', HUL: 'NSE:HINDUNILVR', ITC: 'NSE:ITC',
  NEST: 'NSE:NESTLEIND', SUN: 'NSE:SUNPHARMA', DRL: 'NSE:DRREDDY', CIPLA: 'NSE:CIPLA',
  LTIM: 'NSE:LTIM', MPHL: 'NSE:MPHASIS', COFO: 'NSE:COFORGE', PERS: 'NSE:PERSISTENT', ZENS: 'NSE:ZENSAR',
  INDB: 'NSE:INDUSINDBK', BNDH: 'NSE:BANDHANBNK', FED: 'NSE:FEDERALBNK', IDFC: 'NSE:IDFCFIRSTB',
  BOB: 'NSE:BANKBARODA', PNB: 'NSE:PNB', CNBK: 'NSE:CANBK', AUFI: 'NSE:AUBANK',
  BAFL: 'NSE:BAJFINANCE', BAFN: 'NSE:BAJAJFINSV', SBIN: 'NSE:SBILIFE', HDFL: 'NSE:HDFCLIFE',
  NTPC: 'NSE:NTPC', PWGR: 'NSE:POWERGRID', ADNE: 'NSE:ADANIENSO', ADNG: 'NSE:ADANIGREEN',
  TPOW: 'NSE:TATAPOWER', COAL: 'NSE:COALINDIA', GAIL: 'NSE:GAIL', PLNG: 'NSE:PETRONET',
  HERO: 'NSE:HEROMOTOCO', EICH: 'NSE:EICHERMOT', TVSL: 'NSE:TVSMOTOR', ASML: 'NSE:ASHOKLEY',
  MSMI: 'NSE:MOTHERSON', BORE: 'NSE:BOSCHLTD', EXID: 'NSE:EXIDEIND', MRF: 'NSE:MRF',
  DABR: 'NSE:DABUR', BRIT: 'NSE:BRITANNIA', GOCP: 'NSE:GODREJCP', MRCO: 'NSE:MARICO',
  COLP: 'NSE:COLPAL', TITN: 'NSE:TITAN', UNSP: 'NSE:UNITDSPR',
  DIVI: 'NSE:DIVISLAB', LURD: 'NSE:LUPIN', APLS: 'NSE:APOLLOHOSP', TORR: 'NSE:TORNTPHARM',
  BIOT: 'NSE:BIOCON', ALKE: 'NSE:ALKEM', MAXH: 'NSE:MAXHEALTH', AUPH: 'NSE:AUROPHARMA', ZCAD: 'NSE:ZYDUSLIFE',
  TATA: 'NSE:TATASTEEL', JSWL: 'NSE:JSWSTEEL', HNDL: 'NSE:HINDALCO', VEDL: 'NSE:VEDL',
  NMDC: 'NSE:NMDC', SAIL: 'NSE:SAIL', APNT: 'NSE:ASIANPAINT',
  LART: 'NSE:LT', ULTC: 'NSE:ULTRACEMCO', SHRC: 'NSE:SHREECEM', AMBC: 'NSE:AMBUJACEM',
  DLFC: 'NSE:DLF', GODR: 'NSE:GODREJPROP', OBRO: 'NSE:OBEROIRLTY', PRES: 'NSE:PRESTIGE',
  GRAS: 'NSE:GRASIM', SICC: 'NSE:SIEMENS', ABBC: 'NSE:ABB',
  BRTI: 'NSE:BHARTIARTL', JIOT: 'NSE:JIOFIN', IDEA: 'NSE:IDEA', TCOM: 'NSE:TATACOMM',
  PIIL: 'NSE:PIIND', SRF: 'NSE:SRF', ATUL: 'NSE:ATUL', NFIL: 'NSE:NAVINFLUOR', DEEP: 'NSE:DEEPAKNTR', CLGR: 'NSE:CLEANSCI',
  ADNP: 'NSE:ADANIPORTS', ADNE2: 'NSE:ADANIENT',
  ICIL: 'NSE:ICICIGI', LICI: 'NSE:LICI',
  INFO: 'NSE:NAUKRI', ZOMM: 'NSE:ZOMATO', PAYT: 'NSE:PAYTM', PLCY: 'NSE:POLICYBZR', NYKA: 'NSE:NYKAA', DMRT: 'NSE:DELHIVERY'
};

function openStockDetail(sym) {
  var s = ST.find(function(x) { return x.s === sym; });
  if (!s) return;
  var p = prices[sym] || s.p;
  var ch = +((p - s.p) / s.p * 100).toFixed(2);
  var pos = ch >= 0;

  // Header info
  document.getElementById('sdSym').textContent = sym;
  document.getElementById('sdName').textContent = s.n + ' \u00B7 ' + s.sec;
  document.getElementById('sdPrice').textContent = fINR(p);

  var chEl = document.getElementById('sdChange');
  chEl.textContent = (pos ? '\u25B2 +' : '\u25BC ') + Math.abs(ch) + '%';
  chEl.style.background = pos ? 'rgba(0,229,160,.12)' : 'rgba(255,77,106,.12)';
  chEl.style.color = pos ? 'var(--gr)' : 'var(--rd)';

  // Logo
  var lw = document.getElementById('sdLogo');
  lw.innerHTML = '';
  lw.appendChild(mkLogo(sym, 48));

  // Stats grid
  var hold = HOLDS.find(function(h) { return h.sym === sym; });
  var holdQty = hold ? hold.qty : 0;
  var holdVal = hold ? hold.qty * p : 0;
  var dayChange = (p * 0.012 * (Math.random() > 0.5 ? 1 : -1)).toFixed(0);
  var vol = (Math.random() * 50 + 5).toFixed(1);

  document.getElementById('sdStats').innerHTML =
    '<div class="sd-stat"><div class="sd-stat-lbl">Day Change</div><div class="sd-stat-val" style="color:' + (dayChange >= 0 ? 'var(--gr)' : 'var(--rd)') + '">' + (dayChange >= 0 ? '+' : '') + fINR(Math.abs(dayChange)) + '</div></div>'
    + '<div class="sd-stat"><div class="sd-stat-lbl">Volume</div><div class="sd-stat-val">' + vol + 'L</div></div>'
    + '<div class="sd-stat"><div class="sd-stat-lbl">Sector</div><div class="sd-stat-val">' + s.sec + '</div></div>'
    + '<div class="sd-stat"><div class="sd-stat-lbl">You Own</div><div class="sd-stat-val">' + holdQty + ' shares</div></div>'
    + '<div class="sd-stat"><div class="sd-stat-lbl">Your Value</div><div class="sd-stat-val">' + (holdVal > 0 ? fINR(holdVal) : '-') + '</div></div>'
    + '<div class="sd-stat"><div class="sd-stat-lbl">Base Price</div><div class="sd-stat-val">' + fINR(s.p) + '</div></div>';

  // Buy/Sell buttons
  document.getElementById('sdBuy').onclick = function() { closeSD(); openBS(sym, 'buy'); };
  document.getElementById('sdSell').onclick = function() { closeSD(); openBS(sym, 'sell'); };

  // TradingView chart
  var chartEl = document.getElementById('sdChart');
  var tvSym = TV_MAP[sym] || 'NSE:' + sym;
  chartEl.innerHTML = '';
  var widgetDiv = document.createElement('div');
  widgetDiv.className = 'tradingview-widget-container';
  widgetDiv.style.cssText = 'width:100%;height:100%';
  widgetDiv.innerHTML = '<div class="tradingview-widget-container__widget" style="width:100%;height:100%"></div>';
  chartEl.appendChild(widgetDiv);

  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: tvSym,
    interval: 'D',
    timezone: 'Asia/Kolkata',
    theme: 'dark',
    style: '1',
    locale: 'en',
    backgroundColor: 'rgba(13, 18, 33, 1)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    calendar: false,
    hide_volume: false,
    support_host: 'https://www.tradingview.com'
  });
  widgetDiv.appendChild(script);

  document.getElementById('sdov').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function closeSD() {
  document.getElementById('sdov').classList.remove('on');
  document.body.style.overflow = '';
  // Clean up chart
  var chartEl = document.getElementById('sdChart');
  if (chartEl) chartEl.innerHTML = '';
}
