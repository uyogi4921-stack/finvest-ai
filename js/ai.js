/* ═══════════════════════════════════════════════════════════
   FINVEST AI — ai.js
   Fin — AI Portfolio Advisor
   Smart offline response engine with conversation memory
═══════════════════════════════════════════════════════════ */

'use strict';

var aiStarted = false;
var aiTyping  = false;
var chatHistory = Store.get('chatHistory', []); // persist conversation memory across sessions

// ─── DYNAMIC PORTFOLIO CONTEXT ──────────────────────────
function getPortfolioSummary() {
  var port = calcPortfolio();
  var sectors = Object.keys(port.sectorAlloc);
  var sectorStr = sectors.map(function(s) {
    return s + ' ' + (port.sectorAlloc[s] / port.totalValue * 100).toFixed(1) + '%';
  }).join(', ');
  return {
    value: port.totalValue,
    invested: port.totalInvested,
    gain: port.totalGain,
    gainPct: port.gainPct,
    stocks: port.stockCount,
    sectors: port.sectorCount,
    sectorStr: sectorStr || 'None',
    holdings: HOLDS.map(function(h) { return h.sym + '(' + h.qty + ')'; }).join(', ') || 'None'
  };
}

// ─── RESPONSE BANK — Multiple variants per topic ────────
var AI_BANK = {
  diversification: [
    function(p) {
      return '<b>Portfolio Diversification Analysis</b><br><br>'
        + 'You have <b>' + p.stocks + ' stocks</b> across <b>' + p.sectors + ' sectors</b>.<br><br>'
        + '<b>Sectors:</b> ' + p.sectorStr + '<br><br>'
        + (p.sectors < 3
          ? '<span class="r">Your portfolio is under-diversified.</span> Aim for at least 4-5 sectors to reduce risk. Consider adding Banking, FMCG, or Pharma stocks.'
          : (p.sectors < 5
            ? '<span class="o">Getting better!</span> You cover ' + p.sectors + ' sectors. Adding 1-2 more would strengthen your portfolio.'
            : '<span class="g">Well diversified!</span> You cover ' + p.sectors + ' sectors — solid spread.'))
        + '<hr><b>Tip:</b> A well-diversified Indian portfolio covers IT, Banking, Energy, FMCG, Pharma, and Auto.';
    },
    function(p) {
      var missing = ['IT','Banking','Energy','FMCG','Pharma','Auto'].filter(function(s) {
        return !p.sectorStr.includes(s);
      });
      return '<b>Diversification Score: ' + Math.min(100, Math.round(p.sectors / 6 * 100)) + '/100</b><br><br>'
        + 'Your portfolio spans ' + p.sectors + ' sector' + (p.sectors !== 1 ? 's' : '') + '.<br>'
        + (missing.length > 0
          ? '<br><span class="r">Missing sectors:</span> ' + missing.join(', ') + '<br><br>Adding even one stock from a missing sector significantly reduces your portfolio risk.'
          : '<br><span class="g">All major sectors covered!</span> Great job building a balanced portfolio.')
        + '<hr><b>Rule of thumb:</b> No single sector should exceed 30% of your portfolio.';
    }
  ],
  missing: [
    function(p) {
      var all = ['IT','Banking','Energy','FMCG','Pharma','Auto','Metals','Infra'];
      var missing = all.filter(function(s) { return !p.sectorStr.includes(s); });
      if (missing.length === 0) return '<span class="g">You\'re covering all major sectors!</span> Focus on rebalancing weights rather than adding new sectors.';
      var recs = {
        Banking: 'HDFC Bank or ICICI Bank — India\'s credit growth engine',
        FMCG: 'ITC (3.5% dividend) or HUL — recession-proof',
        Pharma: 'Sun Pharma or Cipla — USD-earning exports',
        Auto: 'Tata Motors (EV play) or Maruti (volume leader)',
        IT: 'TCS or Infosys — strong dollar earnings',
        Energy: 'Reliance or NTPC — India\'s backbone',
        Metals: 'Tata Steel or Hindalco — infrastructure boom',
        Infra: 'L&T — India\'s largest infra company'
      };
      return '<b>You\'re missing ' + missing.length + ' key sector' + (missing.length > 1 ? 's' : '') + ':</b><br><br>'
        + missing.map(function(s, i) {
          return '<b>' + (i+1) + '. ' + s + '</b><br>' + (recs[s] || 'Consider adding exposure') + '<br>';
        }).join('<br>')
        + '<hr><span class="o">Priority:</span> Start with the sector that has the least correlation to your existing holdings.';
    }
  ],
  risk: [
    function(p) {
      var maxHold = null, maxVal = 0;
      HOLDS.forEach(function(h) {
        var val = h.qty * (prices[h.sym] || h.avgPrice);
        if (val > maxVal) { maxVal = val; maxHold = h; }
      });
      if (!maxHold) return 'You have no holdings yet. Start with a diversified approach — buy stocks from at least 3 different sectors.';
      var pct = (maxVal / p.value * 100).toFixed(1);
      return '<b>Risk Analysis for Your Portfolio</b><br><br>'
        + '<b>Biggest concentration:</b> ' + maxHold.sym + ' at <span class="' + (pct > 30 ? 'r' : 'o') + '">' + pct + '%</span> of your portfolio.<br><br>'
        + (pct > 30 ? '<span class="r">Warning:</span> Any single stock above 30% is considered concentrated. If ' + maxHold.sym + ' has a bad quarter, it disproportionately impacts your entire portfolio.<br><br>' : '')
        + '<b>Sector concentration:</b> ' + p.sectors + ' sector' + (p.sectors !== 1 ? 's' : '') + '<br>'
        + (p.sectors < 3 ? '<span class="r">High risk</span> — too few sectors' : (p.sectors < 5 ? '<span class="o">Moderate risk</span> — add more sectors' : '<span class="g">Low risk</span> — well spread'))
        + '<hr><b>Golden rule:</b> No single stock > 25%, no single sector > 35%.';
    },
    function(p) {
      return '<b>Portfolio Risk Score</b><br><br>'
        + 'Based on your ' + p.stocks + ' holdings across ' + p.sectors + ' sectors:<br><br>'
        + '<b>Concentration risk:</b> ' + (p.sectors < 3 ? '<span class="r">High</span>' : '<span class="g">Managed</span>') + '<br>'
        + '<b>Single stock risk:</b> Check if any holding exceeds 25-30% of total value<br>'
        + '<b>Market correlation:</b> ' + (p.sectors < 4 ? 'Your sectors may be correlated — a market event could hit multiple holdings simultaneously' : 'Reasonable sector spread reduces correlation risk') + '<br><br>'
        + '<b>How to reduce risk:</b><ol>'
        + '<li>Trim overweight positions above 25%</li>'
        + '<li>Add stocks from uncorrelated sectors</li>'
        + '<li>Consider index ETFs (Nifty 50) for instant diversification</li></ol>';
    }
  ],
  suggestions: [
    function(p) {
      var missing = ['IT','Banking','Energy','FMCG','Pharma','Auto'].filter(function(s) {
        return !p.sectorStr.includes(s);
      });
      var picks = {
        Banking: { sym: 'HDFC Bank', why: 'India\'s best-run private bank. Low NPAs, consistent growth.' },
        FMCG: { sym: 'ITC', why: '3.5% dividend yield. Hotels + FMCG diversification. Recession-proof.' },
        Pharma: { sym: 'Sun Pharma', why: 'India\'s largest pharma company. Strong global presence.' },
        Auto: { sym: 'Tata Motors', why: 'JLR EV transition + India commercial vehicle leader.' },
        IT: { sym: 'TCS', why: 'India\'s IT bellwether. Consistent buybacks, dollar earnings.' },
        Energy: { sym: 'NTPC', why: 'India\'s largest power producer. Green energy transition play.' }
      };
      if (missing.length === 0) {
        return '<b>Your portfolio looks well-rounded!</b><br><br>Since you cover all major sectors, focus on:<br>'
          + '<b>1.</b> Rebalancing — trim overweight positions<br>'
          + '<b>2.</b> Quality — ensure each holding is a sector leader<br>'
          + '<b>3.</b> Consider a Nifty 50 ETF for your core allocation';
      }
      var top3 = missing.slice(0, 3);
      return '<b>Top Stock Picks to Balance Your Portfolio:</b><br><br>'
        + top3.map(function(s, i) {
          var pick = picks[s];
          return '<b>' + (i+1) + '. ' + pick.sym + '</b> <span class="pill pg">' + s + '</span><br>'
            + pick.why + '<br>';
        }).join('<br>')
        + '<hr><span class="o">Start with just one.</span> Adding ' + picks[top3[0]].sym + ' alone improves your diversification significantly.';
    }
  ],
  beginner: [
    function() {
      return '<b>Getting Started with Investing in India:</b><br><br>'
        + '<b>Step 1 — Open accounts:</b><ul>'
        + '<li>Bank account (savings)</li>'
        + '<li>Demat + Trading account (Zerodha, Groww, Angel One)</li></ul>'
        + '<b>Step 2 — Start simple:</b><ul>'
        + '<li>Begin with a Nifty 50 ETF or index fund SIP</li>'
        + '<li>Even ₹500/month builds the habit</li></ul>'
        + '<b>Step 3 — Learn as you go:</b><ul>'
        + '<li>Complete all 15 lessons here on Finvest AI</li>'
        + '<li>Read Zerodha Varsity (free, excellent)</li></ul>'
        + '<b>Step 4 — Graduate to stocks:</b><ul>'
        + '<li>Only after 3-6 months of learning</li>'
        + '<li>Start with large-cap blue chips (TCS, HDFC Bank, Reliance)</li></ul>';
    },
    function() {
      return '<b>Investing 101 — The Absolute Basics:</b><br><br>'
        + '<b>What is a stock?</b> A tiny piece of ownership in a company. If the company grows, your share grows in value.<br><br>'
        + '<b>What is NSE/BSE?</b> India\'s two stock exchanges where stocks are traded.<br><br>'
        + '<b>What is a Demat account?</b> A digital locker that holds your shares electronically.<br><br>'
        + '<b>How much money do I need?</b> You can start with as little as ₹100 through SIP (Systematic Investment Plan).<br><br>'
        + '<b>Is it risky?</b> Yes, but risk reduces over long time horizons (10+ years). Never invest money you\'ll need within 1-2 years.'
        + '<hr><b>Golden rule:</b> Time in the market beats timing the market. Start early, stay consistent.';
    }
  ],
  sip: [
    function() {
      return '<b>SIP — The Smartest Way to Start:</b><br><br>'
        + 'A Systematic Investment Plan invests a fixed amount every month, regardless of market conditions.<br><br>'
        + '<b>Why SIP works:</b><ul>'
        + '<li><b>Rupee cost averaging:</b> Buy more units when prices are low, fewer when high</li>'
        + '<li><b>No timing needed:</b> Removes emotion from investing</li>'
        + '<li><b>Power of compounding:</b> ₹5,000/month at 12% = ₹1.16 Cr in 25 years</li></ul>'
        + '<b>Best SIP options for beginners:</b><br>'
        + '1. Nifty 50 Index Fund<br>'
        + '2. Nifty Next 50 Fund<br>'
        + '3. Flexi-cap Fund from a top AMC'
        + '<hr>Try our <b>SIP Calculator</b> in the Resources section to see your projected returns!';
    }
  ],
  portfolio: [
    function(p) {
      var gainColor = p.gain >= 0 ? 'g' : 'r';
      var gainSign = p.gain >= 0 ? '+' : '';
      return '<b>Your Portfolio Snapshot:</b><br><br>'
        + '<b>Total Value:</b> ' + fINR(p.value) + '<br>'
        + '<b>Total Invested:</b> ' + fINR(p.invested) + '<br>'
        + '<b>P&L:</b> <span class="' + gainColor + '">' + gainSign + fINR(p.gain) + ' (' + gainSign + p.gainPct.toFixed(2) + '%)</span><br>'
        + '<b>Holdings:</b> ' + p.stocks + ' stocks across ' + p.sectors + ' sectors<br><br>'
        + '<b>Sector Breakdown:</b> ' + p.sectorStr + '<br><br>'
        + (p.stocks === 0
          ? 'You have no holdings yet! Head to the Market tab and start building your portfolio.'
          : (p.gain >= 0
            ? '<span class="g">Your portfolio is in profit.</span> Keep holding quality stocks and consider adding to weaker sectors.'
            : '<span class="r">Your portfolio is currently at a loss.</span> Don\'t panic — focus on holding quality companies. Losses are temporary if your fundamentals are strong.'));
    }
  ],
  market: [
    function() {
      return '<b>Current Market View:</b><br><br>'
        + 'The Indian equity market continues to be one of the world\'s best-performing markets over the long term.<br><br>'
        + '<b>Key things to watch:</b><ul>'
        + '<li>RBI interest rate decisions — affects banking stocks</li>'
        + '<li>Crude oil prices — impacts Energy sector and trade deficit</li>'
        + '<li>US Fed policy — global liquidity flow affects FII investments</li>'
        + '<li>India GDP growth — currently among the fastest globally</li></ul>'
        + '<b>For your portfolio:</b> Focus on companies with strong earnings growth, low debt, and sustainable competitive advantages.'
        + '<hr>Check the <b>Market</b> tab for live stock prices and charts!';
    }
  ],
  mutual_funds: [
    function() {
      return '<b>Mutual Funds vs Direct Stocks:</b><br><br>'
        + '<b>Mutual Funds are better if you:</b><ul>'
        + '<li>Don\'t have time for daily research</li>'
        + '<li>Want professional management</li>'
        + '<li>Prefer instant diversification</li></ul>'
        + '<b>Direct stocks are better if you:</b><ul>'
        + '<li>Enjoy researching companies</li>'
        + '<li>Want higher potential returns</li>'
        + '<li>Can handle more volatility</li></ul>'
        + '<b>Best approach:</b> Use both! Keep 60-70% in mutual funds/ETFs for stability, 30-40% in direct stocks for alpha.<br><br>'
        + '<b>Top fund categories for beginners:</b><br>'
        + '1. Nifty 50 Index Fund (lowest cost)<br>'
        + '2. Large-cap fund<br>'
        + '3. Balanced Advantage Fund (auto equity-debt mix)';
    }
  ],
  tax: [
    function() {
      return '<b>Tax on Stock Market Gains in India:</b><br><br>'
        + '<b>Short-Term Capital Gains (STCG):</b><br>'
        + 'Sold within 1 year → Taxed at <b>15%</b><br><br>'
        + '<b>Long-Term Capital Gains (LTCG):</b><br>'
        + 'Sold after 1 year → <b>10% on gains above ₹1 lakh</b> (no indexation)<br><br>'
        + '<b>Dividends:</b> Taxed at your income tax slab rate<br><br>'
        + '<b>Tax-saving tips:</b><ul>'
        + '<li>Hold quality stocks for 1+ year to get LTCG benefit</li>'
        + '<li>Harvest tax losses — sell losers to offset gains</li>'
        + '<li>ELSS mutual funds give Section 80C deduction (up to ₹1.5L)</li></ul>'
        + '<hr><b>Important:</b> Always consult a CA for personalized tax advice.';
    }
  ],
  ipo: [
    function() {
      return '<b>IPO Investing Guide:</b><br><br>'
        + '<b>What is an IPO?</b> When a private company lists on the stock exchange for the first time (Initial Public Offering).<br><br>'
        + '<b>Should you invest in IPOs?</b><br>'
        + '✅ Yes if: Strong company with proven profits, reasonable valuation<br>'
        + '❌ No if: Loss-making, hyped-up, overvalued, or you\'re just following the crowd<br><br>'
        + '<b>How to apply:</b><ul>'
        + '<li>Through your broker\'s app (Zerodha, Groww, etc.)</li>'
        + '<li>Using UPI — block funds via ASBA</li>'
        + '<li>Retail category: Up to ₹2 lakh application</li></ul>'
        + '<b>IPO allotment is a lottery</b> — don\'t count on getting shares. Never borrow money to apply.';
    }
  ],
  greeting: [
    function(p) {
      return 'Hey! 👋 I\'m Fin, your AI portfolio advisor.<br><br>'
        + (p.stocks > 0
          ? 'I see you have <b>' + p.stocks + ' stocks</b> worth <b>' + fINR(p.value) + '</b> across ' + p.sectors + ' sectors. '
            + (p.gain >= 0 ? '<span class="g">Your portfolio is up ' + p.gainPct.toFixed(1) + '%!</span>' : 'Your portfolio is currently down — but stay focused on long-term fundamentals.')
          : 'Looks like you haven\'t started trading yet. Head to the <b>Market</b> tab to build your first portfolio!')
        + '<br><br>Ask me about diversification, stock picks, risk analysis, SIP, taxes, IPOs, or anything investing!';
    }
  ],
  thanks: [
    function() { return 'You\'re welcome! 😊 Always here to help. Ask me anything else about your portfolio or investing!'; },
    function() { return 'Happy to help! Remember — consistent learning is the key to great investing. Keep going! 💪'; },
    function() { return 'Anytime! Don\'t forget to complete the Learn modules too — they give you XP and real knowledge! 🎯'; }
  ],
  joke: [
    function() { return '😄 Here\'s an investing joke:<br><br><i>"The stock market is the only place where things go on sale and everyone runs out of the store screaming."</i> — Unknown<br><br>But seriously — buying quality stocks when they dip is one of the best strategies. Be greedy when others are fearful!'; },
    function() { return '😄 Investing humor:<br><br><i>"Rule No. 1: Never lose money. Rule No. 2: Never forget Rule No. 1."</i> — Warren Buffett<br><br>Translation: Protect your capital first. Only invest in companies you understand.'; }
  ],
  // ─── FINANCIAL CONCEPTS ──────────────────────────────────
  pe_ratio: [
    function() {
      return '<b>What is P/E Ratio?</b><br><br>'
        + '<b>Price-to-Earnings Ratio</b> = Current Stock Price / Earnings Per Share (EPS)<br><br>'
        + '<b>What it tells you:</b> How much investors are willing to pay for each rupee of earnings.<br><br>'
        + '<b>Example:</b> If TCS stock is ₹3,800 and EPS is ₹120, P/E = 31.7x<br>'
        + 'This means investors pay ₹31.7 for every ₹1 TCS earns.<br><br>'
        + '<b>General guidelines:</b><ul>'
        + '<li>< 15: Potentially undervalued (or low growth)</li>'
        + '<li>15-25: Fairly valued</li>'
        + '<li>25-40: Growth stock / premium valuation</li>'
        + '<li>> 40: Expensive — needs strong growth to justify</li></ul>'
        + '<b>Sector matters:</b> IT stocks (25-35 P/E) are naturally higher than Banking (10-20 P/E). Always compare within the same sector.';
    }
  ],
  dividend: [
    function() {
      return '<b>What is a Dividend?</b><br><br>'
        + 'A <b>dividend</b> is a portion of a company\'s profits distributed to shareholders — like getting rent from your investments.<br><br>'
        + '<b>Dividend Yield</b> = Annual Dividend per Share / Stock Price × 100<br><br>'
        + '<b>Top dividend stocks in India:</b><ul>'
        + '<li><b>ITC:</b> ~3.5% yield — consistent for decades</li>'
        + '<li><b>Coal India:</b> ~7% yield — high but cyclical</li>'
        + '<li><b>Power Grid:</b> ~4.5% yield — stable utility</li>'
        + '<li><b>ONGC:</b> ~4% yield — energy sector</li></ul>'
        + '<b>Key dates:</b><ul>'
        + '<li><b>Record Date:</b> You must own shares before this date to receive dividend</li>'
        + '<li><b>Ex-Dividend Date:</b> Share price adjusts down by dividend amount on this date</li></ul>'
        + '<b>Tax:</b> Dividends are taxed at your income tax slab rate. TDS of 10% if annual dividend exceeds ₹5,000.';
    }
  ],
  market_cap: [
    function() {
      return '<b>What is Market Capitalization?</b><br><br>'
        + '<b>Market Cap</b> = Current Stock Price × Total Outstanding Shares<br><br>'
        + 'It represents the total market value of a company.<br><br>'
        + '<b>SEBI Classification:</b><ul>'
        + '<li><b>Large Cap:</b> Top 100 companies (Reliance, TCS, HDFC Bank) — safest, most liquid</li>'
        + '<li><b>Mid Cap:</b> 101st to 250th (AU Bank, Persistent, Coforge) — growth + moderate risk</li>'
        + '<li><b>Small Cap:</b> 251st onwards — highest growth potential but also highest risk</li></ul>'
        + '<b>India\'s top 5 by market cap:</b><br>'
        + '1. Reliance Industries (~₹18L Cr)<br>'
        + '2. TCS (~₹14L Cr)<br>'
        + '3. HDFC Bank (~₹12L Cr)<br>'
        + '4. Infosys (~₹6L Cr)<br>'
        + '5. Bharti Airtel (~₹5L Cr)';
    }
  ],
  nifty: [
    function() {
      return '<b>What is NIFTY 50?</b><br><br>'
        + 'NIFTY 50 is an index of the <b>50 largest companies</b> listed on the National Stock Exchange (NSE).<br><br>'
        + '<b>Why it matters:</b> It\'s the benchmark of the Indian stock market — when people say "the market went up," they usually mean NIFTY went up.<br><br>'
        + '<b>Key facts:</b><ul>'
        + '<li>Managed by NSE Indices (formerly India Index Services)</li>'
        + '<li>Represents ~65% of free-float market cap of NSE stocks</li>'
        + '<li>Reviewed every 6 months — underperformers are replaced</li>'
        + '<li>Base date: Nov 3, 1995 with a base value of 1,000</li></ul>'
        + '<b>Other important indices:</b><br>'
        + '• SENSEX (BSE, 30 stocks) • BANK NIFTY (12 banking stocks)<br>'
        + '• NIFTY IT • NIFTY Midcap 100 • NIFTY Smallcap 250';
    }
  ],
  intraday: [
    function() {
      return '<b>Intraday vs Delivery Trading</b><br><br>'
        + '<b>Intraday:</b> Buy and sell the same stock on the same day. Position is squared off before market close (3:30 PM).<ul>'
        + '<li>Requires less capital (margin trading)</li>'
        + '<li>Higher risk — no time to recover from drops</li>'
        + '<li>Taxed as business income (your slab rate)</li>'
        + '<li>Brokerage is typically lower</li></ul>'
        + '<b>Delivery:</b> Buy and hold — shares are delivered to your Demat account.<ul>'
        + '<li>Lower risk — you can wait for recovery</li>'
        + '<li>STCG (15%) if sold within 1 year, LTCG (10% above ₹1L) if held longer</li>'
        + '<li>Better for beginners</li></ul>'
        + '<hr><b>Recommendation for beginners:</b> Avoid intraday completely. Focus on delivery trades with quality stocks for long-term wealth building.';
    }
  ],
  demat: [
    function() {
      return '<b>What is a Demat Account?</b><br><br>'
        + 'A <b>Demat (Dematerialized) Account</b> holds your shares in electronic form — like a digital locker for your investments.<br><br>'
        + '<b>How it works:</b><ul>'
        + '<li>Physical share certificates → Converted to electronic records</li>'
        + '<li>Managed by depositories: <b>NSDL</b> and <b>CDSL</b></li>'
        + '<li>You access it through a Depository Participant (DP) — your broker</li></ul>'
        + '<b>What you need to open one:</b><ul>'
        + '<li>PAN Card (mandatory)</li>'
        + '<li>Aadhaar Card (for e-KYC)</li>'
        + '<li>Bank account details</li>'
        + '<li>Address proof</li></ul>'
        + '<b>Popular brokers:</b> Zerodha, Groww, Angel One, Upstox, ICICI Direct<br><br>'
        + '<b>Tip:</b> Most brokers now offer free Demat account opening with zero AMC for the first year.';
    }
  ],
  bluechip: [
    function() {
      return '<b>What are Blue-Chip Stocks?</b><br><br>'
        + 'Blue-chip stocks are shares of <b>large, well-established, financially stable companies</b> with a history of consistent performance.<br><br>'
        + '<b>Characteristics:</b><ul>'
        + '<li>Large market cap (usually top 50-100 companies)</li>'
        + '<li>Strong brand recognition</li>'
        + '<li>Consistent dividend payments</li>'
        + '<li>Lower volatility compared to small/mid caps</li></ul>'
        + '<b>Indian Blue-Chips:</b><br>'
        + 'Reliance, TCS, Infosys, HDFC Bank, HUL, ITC, Bharti Airtel, L&T, Asian Paints, Titan<br><br>'
        + '<b>Why beginners should start here:</b> Blue-chips are less volatile, more liquid, and have proven track records. They\'re the safest entry point into direct stock investing.'
        + '<hr><b>Strategy:</b> Build a core portfolio of 5-7 blue-chips, then gradually add mid-caps for growth.';
    }
  ],
  stop_loss: [
    function() {
      return '<b>What is a Stop Loss?</b><br><br>'
        + 'A <b>stop loss</b> is a pre-set order to sell a stock if it falls below a certain price — it protects you from heavy losses.<br><br>'
        + '<b>Example:</b> You buy TCS at ₹3,800. You set a stop loss at ₹3,600.<br>'
        + 'If TCS drops to ₹3,600, your shares are automatically sold — limiting your loss to ₹200/share (5.3%).<br><br>'
        + '<b>How to set a good stop loss:</b><ul>'
        + '<li><b>Percentage-based:</b> 5-10% below buy price for delivery trades</li>'
        + '<li><b>Support-based:</b> Just below a key technical support level</li>'
        + '<li><b>ATR-based:</b> 2× Average True Range for volatility-adjusted stops</li></ul>'
        + '<b>Trailing Stop Loss:</b> Moves up as stock price rises, locking in profits while limiting downside.<br><br>'
        + '<b>Golden rule:</b> Always use a stop loss. The biggest mistake beginners make is holding onto losing stocks hoping they\'ll recover.';
    }
  ],

  specific_stock: function(sym) {
    var stk = ST.find(function(s) { return s.s === sym; });
    if (!stk) return null;
    var p = prices[sym] || stk.p;
    var hold = HOLDS.find(function(h) { return h.sym === sym; });
    return '<b>' + stk.n + ' (' + sym + ')</b><br>'
      + '<b>Sector:</b> ' + stk.sec + '<br>'
      + '<b>Current Price:</b> ' + fINR(p) + '<br>'
      + (hold
        ? '<b>You own:</b> ' + hold.qty + ' shares (Avg: ' + fINR(hold.avgPrice) + ')<br>'
          + '<b>Your P&L:</b> <span class="' + (p >= hold.avgPrice ? 'g' : 'r') + '">'
          + (p >= hold.avgPrice ? '+' : '') + fINR((p - hold.avgPrice) * hold.qty) + '</span><br>'
        : '<b>You don\'t own this stock yet.</b><br>')
      + '<br>Click on the stock in the <b>Market</b> tab to see its live TradingView chart and detailed stats!';
  }
};

// ─── SMART REPLY ENGINE ─────────────────────────────────
function getReply(msg) {
  var q = msg.toLowerCase();
  var p = getPortfolioSummary();

  // Check for specific stock names
  var stockMatch = null;
  ST.forEach(function(s) {
    if (q.includes(s.s.toLowerCase()) || q.includes(s.n.toLowerCase())) {
      stockMatch = s.s;
    }
  });
  if (stockMatch && AI_BANK.specific_stock) {
    var resp = AI_BANK.specific_stock(stockMatch);
    if (resp) return resp;
  }

  // Topic detection with priority
  var topic = null;
  if (q.match(/^(hi|hey|hello|sup|yo|hola|namaste)/)) topic = 'greeting';
  else if (q.match(/thank|thanks|thx|ty|appreciated/)) topic = 'thanks';
  else if (q.match(/joke|funny|humor|laugh/)) topic = 'joke';
  else if (q.match(/diversif|concentrated|spread|sector.*mix|balanced/)) topic = 'diversification';
  else if (q.match(/missing|sector.*add|which.*sector|what.*sector|gap/)) topic = 'missing';
  else if (q.match(/risk|dangerous|volatile|worst|safe|unsafe/)) topic = 'risk';
  else if (q.match(/suggest|recommend|which stock.*buy|add.*portfolio|pick|best stock/)) topic = 'suggestions';
  else if (q.match(/beginner|start.*invest|how.*invest|first.*invest|new.*invest|newbie/)) topic = 'beginner';
  else if (q.match(/sip|systematic|monthly.*invest|recurring/)) topic = 'sip';
  else if (q.match(/portfolio|holding|my stock|my invest|how.*doing|performance/)) topic = 'portfolio';
  else if (q.match(/market|nifty|sensex|bull|bear|crash|rally/)) topic = 'market';
  else if (q.match(/mutual fund|mf|etf|index fund|fund/)) topic = 'mutual_funds';
  else if (q.match(/tax|stcg|ltcg|capital gain|80c|elss/)) topic = 'tax';
  else if (q.match(/ipo|list|initial public/)) topic = 'ipo';
  else if (q.match(/p[\/ ]?e|price.*(to|\/)\s*earn|earning.*ratio|valuation/)) topic = 'pe_ratio';
  else if (q.match(/dividend|yield|payout|dps/)) topic = 'dividend';
  else if (q.match(/market\s*cap|capitali[sz]ation|large.?cap|mid.?cap|small.?cap/)) topic = 'market_cap';
  else if (q.match(/nifty|sensex|index|benchmark/)) topic = 'nifty';
  else if (q.match(/intraday|day.*trad|swing.*trad|delivery.*trad|short.*term.*trad/)) topic = 'intraday';
  else if (q.match(/demat|account|kyc|broker|open.*account/)) topic = 'demat';
  else if (q.match(/blue.?chip|safe.*stock|stable.*stock|reliable/)) topic = 'bluechip';
  else if (q.match(/stop.?loss|trailing|protect.*loss|limit.*loss/)) topic = 'stop_loss';

  if (!topic) {
    // Fallback — cycle through helpful topics based on chat count
    var fallbacks = ['portfolio', 'diversification', 'suggestions', 'beginner'];
    topic = fallbacks[chatHistory.length % fallbacks.length];
  }

  var bank = AI_BANK[topic];
  if (!bank) bank = AI_BANK.portfolio;

  // Pick a variant — avoid repeating the last used variant for this topic
  var variants = Array.isArray(bank) ? bank : [bank];
  var lastUsed = -1;
  for (var i = chatHistory.length - 1; i >= 0; i--) {
    if (chatHistory[i].topic === topic) {
      lastUsed = chatHistory[i].variant;
      break;
    }
  }
  var varIdx = 0;
  if (variants.length > 1) {
    varIdx = (lastUsed + 1) % variants.length;
  }

  chatHistory.push({ topic: topic, variant: varIdx, time: Date.now() });
  // Keep only last 50 entries and persist
  if (chatHistory.length > 50) chatHistory = chatHistory.slice(-50);
  Store.set('chatHistory', chatHistory);

  var fn = variants[varIdx];
  return typeof fn === 'function' ? fn(p) : fn;
}

// ─── CHAT UI ─────────────────────────────────────────────
function openAI() {
  document.getElementById('aipanel').classList.add('on');
  document.getElementById('aiov').classList.add('on');
  document.body.style.overflow = 'hidden';
  closeSB();

  // Hide FAB bubble when panel opens
  var bubble = document.getElementById('fabBubble');
  if (bubble) bubble.classList.remove('on');

  if (!aiStarted) {
    aiStarted = true;
    // Welcome message is already in HTML, no need to add another
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
  d.className = 'aimsg ai';
  d.innerHTML = '<div class="aimav">💡</div><div class="aiml"><div class="aimb">' + html + '</div><div class="aimt">Just now</div></div>';
  a.appendChild(d);
  a.scrollTop = a.scrollHeight;
}

function addUser(text) {
  var a = document.getElementById('aichat');
  var d = document.createElement('div');
  d.className = 'aimsg user';
  var avatar = userProfile ? userProfile.avatar : '👤';
  d.innerHTML = '<div class="aiml user-ml"><div class="aimb user-b">' + text + '</div><div class="aimt">Just now</div></div><div class="aimav user-av">' + avatar + '</div>';
  a.appendChild(d);
  a.scrollTop = a.scrollHeight;
}

function showTyping() {
  var a = document.getElementById('aichat');
  var d = document.createElement('div');
  d.className = 'aimsg ai';
  d.id = 'typbub';
  d.innerHTML = '<div class="aimav">💡</div><div class="aiml"><div class="aimb"><div class="typic"><div class="td"></div><div class="td"></div><div class="td"></div></div></div></div>';
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
