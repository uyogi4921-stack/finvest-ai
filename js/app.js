/* ═══════════════════════════════════════════════════════════
   FINVEST AI — app.js
   Main entry point. Initialises everything.
═══════════════════════════════════════════════════════════ */

'use strict';

function initApp() {
  // Seed live prices from base prices in data.js
  ST.forEach(function(s) { prices[s.s] = s.p; });
  IDX.forEach(function(x) { idxP[x.n] = x.b; });

  // Check daily streak
  checkStreak();

  // Render all dynamic sections
  renderIdx();
  renderMkt('');
  initHoldings();
  renderLessons();
  renderLB();
  updXP();
  renderGlossary('');

  // SEBI booklet — load first chapter
  setTimeout(function() {
    showSC(0, document.querySelector('.stab'));
  }, 150);

  // Market search
  var mktInput = document.getElementById('mktQ');
  if (mktInput) {
    mktInput.addEventListener('input', function() {
      var clr = document.getElementById('mktClr');
      if (clr) clr.style.display = this.value ? 'inline' : 'none';
      renderMkt(this.value);
    });
  }

  // Glossary search
  var glossInput = document.getElementById('glossarySearch');
  if (glossInput) {
    glossInput.addEventListener('input', function() {
      renderGlossary(this.value);
    });
  }

  // SIP calculator default
  calcSIP();

  // Show profile prompt if no profile exists
  if (!userProfile) {
    setTimeout(function() {
      showProfilePrompt();
    }, 500);
  } else {
    updateProfileUI();
  }

  // Update challenge button states
  updateChallengeButtons();

  // Price simulation — tick every 8 seconds
  setInterval(tickPrices, 8000);

  // Leaderboard timer update every minute
  setInterval(function() {
    if (curPage === 'leaderboard') renderLB();
  }, 60000);
}

function updateChallengeButtons() {
  Object.keys(completedChallenges).forEach(function(id) {
    if (completedChallenges[id]) {
      var btn = document.querySelector('[data-challenge="' + id + '"]');
      if (btn) {
        btn.textContent = 'Done \u2713';
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
    }
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
