(function () {
  "use strict";

  // ---------- element refs ----------
  const screenSelect = document.getElementById('screen-select');
  const screenQuiz = document.getElementById('screen-quiz');
  const screenResults = document.getElementById('screen-results');

  const pickMcBtn = document.getElementById('pick-mc');
  const pickFitbBtn = document.getElementById('pick-fitb');
  const pickEocBtn = document.getElementById('pick-eoc');
  const mcCountInput = document.getElementById('mc-count-input');
  const fitbCountInput = document.getElementById('fitb-count-input');
  const optShuffle = document.getElementById('opt-shuffle');
  const optShuffleChoices = document.getElementById('opt-shuffle-choices');

  const takerName = document.getElementById('takerName');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsPanel = document.getElementById('settingsPanel');
  const sheetsUrlInput = document.getElementById('sheetsUrlInput');
  const saveSheetsUrl = document.getElementById('saveSheetsUrl');
  const settingsStatus = document.getElementById('settingsStatus');
  const submitStatus = document.getElementById('submitStatus');

  const scoreChip = document.getElementById('scoreChip');
  const quitBtn = document.getElementById('quitBtn');
  const flagBtn = document.getElementById('flagBtn');
  const timerChip = document.getElementById('timerChip');
  const progressFill = document.getElementById('progressFill');
  const qMeta = document.getElementById('qMeta');
  const qText = document.getElementById('qText');
  const optList = document.getElementById('optList');
  const fitbBlock = document.getElementById('fitbBlock');
  const fitbInput = document.getElementById('fitbInput');
  const revealBtn = document.getElementById('revealBtn');
  const answerKey = document.getElementById('answerKey');
  const answerKeyList = document.getElementById('answerKeyList');
  const selfGrade = document.getElementById('selfGrade');
  const gradeWrong = document.getElementById('gradeWrong');
  const gradeRight = document.getElementById('gradeRight');
  const fbBanner = document.getElementById('fbBanner');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  const resultsMode = document.getElementById('resultsMode');
  const resultsScore = document.getElementById('resultsScore');
  const resultsPct = document.getElementById('resultsPct');
  const reviewList = document.getElementById('reviewList');
  const retakeAllBtn = document.getElementById('retakeAllBtn');
  const retakeMissedBtn = document.getElementById('retakeMissedBtn');
  const menuBtn = document.getElementById('menuBtn');

  document.getElementById('mc-count-tag').textContent = QUIZ_DATA.mc.length + ' available';
  document.getElementById('fitb-count-tag').textContent = QUIZ_DATA.fitb.length + ' available';
  mcCountInput.max = QUIZ_DATA.mc.length;
  mcCountInput.value = QUIZ_DATA.mc.length;
  fitbCountInput.max = QUIZ_DATA.fitb.length;
  fitbCountInput.value = QUIZ_DATA.fitb.length;

  const EOC_QUESTION_COUNT = 130;
  const EOC_TIME_MS = 90 * 60 * 1000;

  const MODE_LABELS = { mc: 'Multiple Choice', fitb: 'Fill in the Blank', eoc: 'EOC Pretest' };

  // ---------- name + Google Sheet settings (persisted locally in this browser) ----------
  const LS_NAME_KEY = 'cdc_taker_name';
  const LS_SHEETS_URL_KEY = 'cdc_sheets_webapp_url';

  try {
    const savedName = localStorage.getItem(LS_NAME_KEY);
    if (savedName) takerName.value = savedName;
    const savedUrl = localStorage.getItem(LS_SHEETS_URL_KEY);
    if (savedUrl) sheetsUrlInput.value = savedUrl;
  } catch (e) { /* localStorage unavailable — reporting just won't persist between visits */ }

  takerName.addEventListener('change', () => {
    try { localStorage.setItem(LS_NAME_KEY, takerName.value.trim()); } catch (e) {}
  });

  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  saveSheetsUrl.addEventListener('click', () => {
    const url = sheetsUrlInput.value.trim();
    try {
      localStorage.setItem(LS_SHEETS_URL_KEY, url);
      settingsStatus.textContent = url ? 'Saved. Results will be sent to your Google Sheet.' : 'Cleared — results will not be sent anywhere.';
      settingsStatus.className = 'settings-status ok';
    } catch (e) {
      settingsStatus.textContent = 'Could not save (browser storage unavailable).';
      settingsStatus.className = 'settings-status err';
    }
  });

  function requireName() {
    const n = takerName.value.trim();
    if (!n) {
      alert('Please enter your name before starting the test.');
      takerName.focus();
      return null;
    }
    try { localStorage.setItem(LS_NAME_KEY, n); } catch (e) {}
    return n;
  }

  function submitResultsToSheet(payload) {
    let url = '';
    try { url = localStorage.getItem(LS_SHEETS_URL_KEY) || ''; } catch (e) {}
    if (!url) {
      submitStatus.textContent = '';
      submitStatus.className = 'submit-status';
      return;
    }
    submitStatus.textContent = 'Sending results to Google Sheet\u2026';
    submitStatus.className = 'submit-status pending';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json().catch(() => ({})))
      .then(data => {
        if (data && data.status === 'error') {
          submitStatus.textContent = 'Sheet reported an error: ' + (data.message || 'unknown');
          submitStatus.className = 'submit-status err';
        } else {
          submitStatus.textContent = '\u2713 Results sent to Google Sheet.';
          submitStatus.className = 'submit-status ok';
        }
      })
      .catch(() => {
        submitStatus.textContent = '\u26a0 Could not reach the Google Sheet (check the Web App URL in Sheet settings).';
        submitStatus.className = 'submit-status err';
      });
  }

  // ---------- state ----------
  // state.pool is an array of "entries": {type:'mc'|'fitb', idx: <index into QUIZ_DATA[type]>}
  let state = null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function sourceFor(type) {
    return type === 'mc' ? QUIZ_DATA.mc : QUIZ_DATA.fitb;
  }

  function itemFor(entry) {
    return sourceFor(entry.type)[entry.idx];
  }

  function entryKey(entry) {
    return entry.type + '_' + entry.idx;
  }

  function buildFullPool(type) {
    return sourceFor(type).map((_, i) => ({ type: type, idx: i }));
  }

  function buildEocPool() {
    const all = buildFullPool('mc').concat(buildFullPool('fitb'));
    const shuffled = shuffle(all);
    return shuffled.slice(0, Math.min(EOC_QUESTION_COUNT, shuffled.length));
  }

  function clampCount(input, max) {
    let n = parseInt(input.value, 10);
    if (isNaN(n)) n = max;
    n = Math.max(5, Math.min(max, n));
    input.value = n;
    return n;
  }

  function startQuiz(mode, presetPool, count, name) {
    let pool;
    if (presetPool) {
      pool = presetPool.slice();
      if (optShuffle.checked || mode === 'eoc') pool = shuffle(pool);
    } else if (mode === 'eoc') {
      pool = buildEocPool(); // always a fresh random draw
    } else {
      let full = buildFullPool(mode);
      const max = full.length;
      const n = count ? Math.min(Math.max(1, count), max) : max;
      if (n < max) {
        // random sample: shuffling then slicing gives both a random subset and a random order
        pool = shuffle(full).slice(0, n);
      } else {
        pool = optShuffle.checked ? shuffle(full) : full;
      }
    }

    stopTimer();

    state = {
      mode,
      pool,
      count: pool.length,
      name: name || (state && state.name) || takerName.value.trim(),
      cur: 0,
      records: {},
      flags: new Set(),
      shuffleChoices: optShuffleChoices.checked,
      deadline: null,
      timeExpired: false
    };
    pool.forEach(e => { state.records[entryKey(e)] = { status: 'unanswered' }; });

    if (mode === 'eoc') {
      state.deadline = Date.now() + EOC_TIME_MS;
      startTimer();
    } else {
      timerChip.classList.add('hidden');
    }

    showScreen('quiz');
    renderQuestion();
  }

  function showScreen(name) {
    screenSelect.classList.toggle('hidden', name !== 'select');
    screenQuiz.classList.toggle('hidden', name !== 'quiz');
    screenResults.classList.toggle('hidden', name !== 'results');
    if (name === 'select') {
      scoreChip.textContent = 'Not started';
      stopTimer();
    }
  }

  // ---------- timer (EOC only) ----------
  let timerInterval = null;

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      updateTimerDisplay();
      if (state && state.deadline && Date.now() >= state.deadline) {
        stopTimer();
        state.timeExpired = true;
        finishQuiz();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerDisplay() {
    if (!state || !state.deadline) { timerChip.classList.add('hidden'); return; }
    timerChip.classList.remove('hidden');
    const remaining = Math.max(0, state.deadline - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const secsStr = secs < 10 ? '0' + secs : '' + secs;
    timerChip.textContent = 'Time left: ' + mins + ':' + secsStr;
    timerChip.classList.toggle('urgent', remaining <= 5 * 60 * 1000);
  }

  function updateScoreChip() {
    const answered = state.pool.filter(e => state.records[entryKey(e)].status !== 'unanswered').length;
    const correct = state.pool.filter(e => state.records[entryKey(e)].status === 'correct').length;
    scoreChip.innerHTML = 'Score: <b>' + correct + '</b> / ' + answered + ' answered &middot; ' + state.pool.length + ' total';
  }

  function currentEntry() {
    return state.pool[state.cur];
  }

  function renderQuestion() {
    const entry = currentEntry();
    const item = itemFor(entry);
    const record = state.records[entryKey(entry)];

    const typeLabel = state.mode === 'eoc' ? ('  ·  ' + MODE_LABELS[entry.type]) : '';
    qMeta.textContent = 'Question ' + (state.cur + 1) + ' of ' + state.pool.length + typeLabel + '  ·  Item #' + item.num;
    qText.textContent = item.q;
    progressFill.style.width = Math.round((state.cur / state.pool.length) * 100) + '%';

    flagBtn.classList.toggle('on', state.flags.has(entryKey(entry)));
    fbBanner.className = 'fb-banner';
    fbBanner.textContent = '';

    prevBtn.disabled = state.cur === 0;
    nextBtn.textContent = state.cur === state.pool.length - 1 ? 'Finish \u2192' : 'Next \u2192';

    if (entry.type === 'mc') {
      renderMC(item, record);
    } else {
      renderFITB(item, record);
    }

    updateScoreChip();
  }

  // ---------- Multiple choice ----------
  function renderMC(item, record) {
    optList.classList.remove('hidden');
    fitbBlock.classList.add('hidden');
    optList.innerHTML = '';

    let order = record.optionOrder;
    if (!order) {
      order = item.options.map((_, i) => i);
      if (state.shuffleChoices) order = shuffle(order);
      record.optionOrder = order;
    }

    const letters = ['A', 'B', 'C', 'D'];
    order.forEach((optIdx, pos) => {
      const btn = document.createElement('button');
      btn.className = 'opt';
      btn.type = 'button';
      const letterSpan = document.createElement('span');
      letterSpan.className = 'letter';
      letterSpan.textContent = letters[pos];
      const textSpan = document.createElement('span');
      textSpan.textContent = item.options[optIdx];
      btn.appendChild(letterSpan);
      btn.appendChild(textSpan);

      if (record.status !== 'unanswered') {
        btn.disabled = true;
        if (optIdx === item.correctIndex) {
          btn.classList.add('correct');
        } else if (optIdx === record.selected) {
          btn.classList.add('incorrect');
        } else {
          btn.classList.add('dim');
        }
      }

      btn.addEventListener('click', () => {
        if (record.status !== 'unanswered') return;
        record.selected = optIdx;
        record.status = (optIdx === item.correctIndex) ? 'correct' : 'incorrect';
        renderQuestion();
      });

      optList.appendChild(btn);
    });

    if (record.status === 'correct') {
      fbBanner.classList.add('show', 'go');
      fbBanner.textContent = 'Correct.';
    } else if (record.status === 'incorrect') {
      fbBanner.classList.add('show', 'nogo');
      fbBanner.textContent = 'Incorrect — correct answer is highlighted above.';
    }
  }

  // ---------- Fill in the blank ----------
  function renderFITB(item, record) {
    optList.classList.add('hidden');
    fitbBlock.classList.remove('hidden');

    fitbInput.value = record.userText || '';
    fitbInput.oninput = () => { record.userText = fitbInput.value; };

    const revealed = !!record.revealed;
    answerKey.classList.toggle('show', revealed);
    selfGrade.classList.toggle('hidden', !revealed);
    revealBtn.disabled = revealed;
    revealBtn.textContent = revealed ? 'Answer revealed' : 'Reveal answer';

    if (revealed) {
      answerKeyList.innerHTML = '';
      item.a.forEach(pair => {
        const level = pair[0], text = pair[1];
        const li = document.createElement('li');
        if (level > 0) li.classList.add('sub');
        li.textContent = text;
        answerKeyList.appendChild(li);
      });
    }

    gradeRight.classList.toggle('active', record.status === 'correct');
    gradeWrong.classList.toggle('active', record.status === 'incorrect');

    revealBtn.onclick = () => {
      record.revealed = true;
      renderQuestion();
    };
    gradeRight.onclick = () => {
      record.status = 'correct';
      renderQuestion();
    };
    gradeWrong.onclick = () => {
      record.status = 'incorrect';
      renderQuestion();
    };
  }

  // ---------- navigation ----------
  prevBtn.addEventListener('click', () => {
    if (state.cur > 0) { state.cur--; renderQuestion(); }
  });

  nextBtn.addEventListener('click', () => {
    const entry = currentEntry();
    const record = state.records[entryKey(entry)];
    if (record.status === 'unanswered') {
      record.status = 'skipped';
    }
    if (state.cur < state.pool.length - 1) {
      state.cur++;
      renderQuestion();
    } else {
      finishQuiz();
    }
  });

  flagBtn.addEventListener('click', () => {
    const key = entryKey(currentEntry());
    if (state.flags.has(key)) state.flags.delete(key); else state.flags.add(key);
    flagBtn.classList.toggle('on', state.flags.has(key));
  });

  quitBtn.addEventListener('click', () => {
    if (confirm('Exit this test? Your progress on this attempt will be lost.')) {
      stopTimer();
      showScreen('select');
    }
  });

  // ---------- results ----------
  function finishQuiz() {
    stopTimer();

    // anything never touched counts as skipped
    state.pool.forEach(e => {
      const r = state.records[entryKey(e)];
      if (r.status === 'unanswered') r.status = 'skipped';
    });

    const correct = state.pool.filter(e => state.records[entryKey(e)].status === 'correct').length;
    const total = state.pool.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;

    resultsMode.textContent = MODE_LABELS[state.mode] + ' \u2014 Results' + (state.timeExpired ? ' (time expired)' : '');
    resultsScore.textContent = correct + ' / ' + total;
    resultsPct.textContent = pct + '% correct';

    reviewList.innerHTML = '';
    const missed = state.pool.filter(e => {
      const s = state.records[entryKey(e)].status;
      return s === 'incorrect' || s === 'skipped';
    });

    if (missed.length) {
      const heading = document.createElement('h3');
      heading.style.fontFamily = "'Oswald', sans-serif";
      heading.style.textTransform = 'uppercase';
      heading.style.fontSize = '14px';
      heading.style.letterSpacing = '.06em';
      heading.style.color = '#5b5638';
      heading.textContent = 'Review — ' + missed.length + ' to revisit';
      reviewList.appendChild(heading);

      missed.forEach(e => {
        const item = itemFor(e);
        const rec = state.records[entryKey(e)];
        const div = document.createElement('div');
        div.className = 'review-item';
        const rq = document.createElement('div');
        rq.className = 'rq';
        const typePrefix = state.mode === 'eoc' ? ('[' + (e.type === 'mc' ? 'MC' : 'FITB') + '] ') : '';
        rq.textContent = typePrefix + '#' + item.num + '. ' + item.q + (rec.status === 'skipped' ? '  (skipped)' : '');
        div.appendChild(rq);
        const ra = document.createElement('div');
        ra.className = 'ra';
        if (e.type === 'mc') {
          ra.innerHTML = 'Correct answer: <b>' + item.options[item.correctIndex] + '</b>';
        } else {
          ra.innerHTML = 'Answer key: <b>' + item.a.map(p => p[1]).join(' \u2014 ') + '</b>';
        }
        div.appendChild(ra);
        reviewList.appendChild(div);
      });
    }

    state.lastMissed = missed;
    const fullSize = state.mode === 'eoc' ? EOC_QUESTION_COUNT : QUIZ_DATA[state.mode].length;
    retakeAllBtn.textContent = (state.mode === 'eoc' || state.count < fullSize)
      ? 'New random set (' + state.count + ')'
      : 'Retake full set';
    showScreen('results');
    scoreChip.textContent = 'Finished: ' + correct + '/' + total;

    submitResultsToSheet({
      timestamp: new Date().toISOString(),
      name: state.name || '(no name entered)',
      testType: MODE_LABELS[state.mode],
      questionCount: total,
      correct: correct,
      percent: pct,
      timeExpired: !!state.timeExpired,
      flagged: state.flags.size
    });
  }

  retakeAllBtn.addEventListener('click', () => {
    startQuiz(state.mode, null, state.count, state.name);
  });
  retakeMissedBtn.addEventListener('click', () => {
    if (state.lastMissed && state.lastMissed.length) {
      startQuiz(state.mode, state.lastMissed, null, state.name);
    } else {
      alert('Nothing missed — nice work.');
    }
  });
  menuBtn.addEventListener('click', () => {
    showScreen('select');
  });

  // ---------- entry points ----------
  pickMcBtn.addEventListener('click', () => {
    const name = requireName();
    if (!name) return;
    const n = clampCount(mcCountInput, QUIZ_DATA.mc.length);
    startQuiz('mc', null, n, name);
  });
  pickFitbBtn.addEventListener('click', () => {
    const name = requireName();
    if (!name) return;
    const n = clampCount(fitbCountInput, QUIZ_DATA.fitb.length);
    startQuiz('fitb', null, n, name);
  });
  pickEocBtn.addEventListener('click', () => {
    const name = requireName();
    if (!name) return;
    startQuiz('eoc', null, null, name);
  });

  showScreen('select');
})();
