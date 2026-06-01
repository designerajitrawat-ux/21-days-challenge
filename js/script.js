/* ============================================================
 * JS21 — 21 Day JavaScript Challenge Tracker
 * Vanilla JS · localStorage (with in-memory fallback)
 * Strict 24-hour streak mechanics
 * ============================================================ */
(() => {
  'use strict';

  // 1. CONSTANTS
  const TOTAL_DAYS = 21;
  const HOUR = 60 * 60 * 1000;
  const COOLDOWN_MS = 24 * HOUR;
  const WINDOW_MS = 24 * HOUR;
  const DEADLINE_MS = COOLDOWN_MS + WINDOW_MS;
  const XP_PER_DAY = 100;
  const XP_BONUS_FINISH = 500;
  const STORAGE_KEY = 'js21_challenge_state_v1';
  const API_URL = "https://two1-days-challenge.onrender.com";
 
  function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId");

  if (!deviceId) {
    deviceId =
      "js21_" + Math.random().toString(36).substring(2, 12);

    localStorage.setItem("deviceId", deviceId);
  }

  return deviceId;
}

  // 2. STORAGE — localStorage with graceful in-memory fallback
  let memFallback = null;
  let storageAvailable = false;
  try {
    const testKey = '__js21_probe__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    storageAvailable = true;
  } catch (e) {
    storageAvailable = false;
  }
  function readStorage() {
    if (storageAvailable) {
      try { return localStorage.getItem(STORAGE_KEY); } catch { storageAvailable = false; }
    }
    return memFallback;
  }
  function writeStorage(value) {
    if (storageAvailable) {
      try { localStorage.setItem(STORAGE_KEY, value); return; } catch { storageAvailable = false; }
    }
    memFallback = value;
  }
  function clearStorage() {
    if (storageAvailable) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    memFallback = null;
  }

  // 3. MESSAGES
  const QUOTES = [
    '"The expert in anything was once a beginner."',
    '"Discipline equals freedom." — Jocko Willink',
    '"Small daily improvements are the key to staggering long-term results."',
    '"You do not rise to the level of your goals. You fall to the level of your systems." — James Clear',
    '"The chains of habit are too light to be felt until they are too heavy to be broken."',
    '"Compound interest is the eighth wonder of the world." — Einstein',
    '"Consistency is the mother of mastery."',
    '"The pain of discipline weighs ounces. The pain of regret weighs tons."',
    '"What we do every day matters more than what we do once in a while."',
    '"Don\'t count the days. Make the days count." — Muhammad Ali',
    '"Halfway is not a stopping point. It\'s a checkpoint."',
    '"You are what you repeatedly do. Excellence is a habit." — Aristotle',
    '"Suffer the pain of discipline or suffer the pain of regret."',
    '"Progress, not perfection."',
    '"The man on top of the mountain didn\'t fall there."',
    '"Habits are the compound interest of self-improvement."',
    '"Show up. Especially when you don\'t feel like it."',
    '"You\'ve come too far to only come this far."',
    '"Almost there. Don\'t blink."',
    '"One day. One node. Finish strong."',
    '"This is the final stretch. Make it count."',
  ];
  const STATUS_MESSAGES = {
    idle: 'Day 1 awaits. Click the first node to start your streak.',
    cooldown: 'Cooldown active. The next node unlocks soon.',
    active: 'A new day is live. Log your learning before the timer runs out.',
    urgent: 'Time is running out. Complete today\'s node now.',
    done: '21 days. No misses. You did the work.',
  };

  // 4. STATE
  function freshState() {
    return {
      version: 1,
      entries: [],
      currentDay: 1,
      totalXP: 0,
      resetCount: 0,
      lastResetAt: null,
      firstStartedAt: null,
      challengeDone: false
    };
  }
  function loadState() {
    const raw = readStorage();
    if (!raw) return freshState();
    try { return Object.assign(freshState(), JSON.parse(raw)); }
    catch { return freshState(); }
  }
  function saveState() {
    try { writeStorage(JSON.stringify(state)); }
    catch (e) { toast('Could not save progress', 'err'); }
  }
  let state = loadState();

  // 5. LOGIC
  function computeDayStatus(day, now = Date.now()) {
    if (day <= state.entries.length) return { status: 'done' };
    if (day > state.currentDay) return { status: 'locked' };
    if (day === 1 && state.entries.length === 0) return { status: 'active' };
    const prev = state.entries[day - 2];
    if (!prev) return { status: 'active' };
    const unlockAt = prev.completedAt + COOLDOWN_MS;
    const deadlineAt = prev.completedAt + DEADLINE_MS;
    if (now < unlockAt) return { status: 'cooldown', unlockAt, deadlineAt };
    if (now <= deadlineAt) {
      const urgentThreshold = deadlineAt - 4 * HOUR;
      return { status: now >= urgentThreshold ? 'urgent' : 'active', unlockAt, deadlineAt };
    }
    return { status: 'expired', unlockAt, deadlineAt };
  }

  function checkAndApplyReset() {
    if (state.challengeDone) return false;
    if (state.entries.length === 0) return false;
    if (state.currentDay > TOTAL_DAYS) return false;
    const lastEntry = state.entries[state.entries.length - 1];
    if (Date.now() > lastEntry.completedAt + DEADLINE_MS) {
      doReset({ automatic: true });
      return true;
    }
    return false;
  }

  function doReset({ automatic } = { automatic: false }) {
    const prevResetCount = state.resetCount;
    const firstStartedAt = state.firstStartedAt;
    state = freshState();
    state.resetCount = prevResetCount + 1;
    state.lastResetAt = Date.now();
    state.firstStartedAt = firstStartedAt;
    saveState();
    fetch(
  `${API_URL}/api/challenges/${getDeviceId()}`,
  {
    method: "DELETE"
  }
)
.then(res => res.json())
.then(data => {
  console.log("MongoDB Auto Reset:", data);
})
.catch(err => {
  console.error(err);
});
    if (automatic) showResetAlert();
  }

  function completeCurrentDay({ topic, hours, notes }) {
    if (state.challengeDone) return false;
    if (state.currentDay > TOTAL_DAYS) return false;
    const cur = computeDayStatus(state.currentDay);
    if (!['active', 'urgent'].includes(cur.status)) {
      if (cur.status === 'expired') doReset({ automatic: true });
      return false;
    }
    const now = Date.now();
    state.entries.push({
      day: state.currentDay,
      topic: topic.trim(),
      hours: parseFloat(hours) || 0,
      notes: notes.trim(),
      completedAt: now
    });
    state.totalXP += XP_PER_DAY;
    if (!state.firstStartedAt) state.firstStartedAt = now;
    if (state.currentDay === TOTAL_DAYS) {
      state.challengeDone = true;
      state.totalXP += XP_BONUS_FINISH;
    }
    state.currentDay += 1;
    saveState();
    return true;
  }

  // 6. DOM
  const $ = sel => document.querySelector(sel);
  const els = {
    grid: $('#challenge-grid'), streak: $('#stat-streak'), xp: $('#stat-xp'), resets: $('#stat-resets'),
    statusDot: $('#status-dot'), statusLabel: $('#status-label'), statusMessage: $('#status-message'), statusQuote: $('#status-quote'),
    countdownWrap: $('#countdown-wrap'), countdownLabel: $('#countdown-label'),
    cdH: $('#cd-h'), cdM: $('#cd-m'), cdS: $('#cd-s'),
    progressFill: $('#progress-fill'), progressPct: $('#progress-pct'), progressFrac: $('#progress-frac'),
    footTime: $('#foot-time'),
    entryModal: $('#entry-modal'), entryEyebrow: $('#entry-eyebrow'), entryTitle: $('#entry-title'),
    entryTopic: $('#entry-topic'), entryHours: $('#entry-hours'), entryNotes: $('#entry-notes'), entrySubmit: $('#entry-submit'),
    viewModal: $('#view-modal'), viewEyebrow: $('#view-eyebrow'), viewTitle: $('#view-title'),
    viewHours: $('#view-hours'), viewWhen: $('#view-when'), viewNotes: $('#view-notes'),
    resetAlert: $('#reset-alert'), alertBody: $('#alert-body'), alertAck: $('#alert-ack'),
    victory: $('#victory'), confettiCanvas: $('#confetti-canvas'),
    victoryClose: $('#victory-close'), victoryExport: $('#victory-export'),
    btnReset: $('#btn-reset'), btnExport: $('#btn-export'),
    toast: $('#toast'), demoBanner: $('#demo-banner'),
  };

  // 7. RENDER
  function renderGrid() {
    els.grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const s = computeDayStatus(day);
      const node = document.createElement('button');
      node.className = `node node--${s.status === 'cooldown' || s.status === 'locked' ? 'locked' : s.status}`;
      node.dataset.day = day;
      node.style.animationDelay = `${(day - 1) * 20}ms`;
      node.setAttribute('role', 'listitem');
      node.disabled = ['locked', 'cooldown'].includes(s.status);

      let statusText = 'LOCKED';
      if (s.status === 'done') statusText = 'COMPLETE';
      else if (s.status === 'active') statusText = 'LIVE';
      else if (s.status === 'urgent') statusText = 'URGENT';
      else if (s.status === 'cooldown') statusText = 'COOLDOWN';

      node.innerHTML = `
        <span class="node__corner node__corner--tl"></span>
        <span class="node__corner node__corner--tr"></span>
        <span class="node__corner node__corner--bl"></span>
        <span class="node__corner node__corner--br"></span>
        <span class="node__num">DAY ${String(day).padStart(2, '0')}</span>
        <span class="node__day">${day}</span>
        <span class="node__status">${statusText}</span>
        <svg class="node__icon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
          <path class="node__check" d="M9 16.5l5 5 9-11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      node.addEventListener('click', () => onNodeClick(day));
      frag.appendChild(node);
    }
    els.grid.appendChild(frag);
  }

  function renderStats() {
    const completed = state.entries.length;
    els.streak.innerHTML = `${completed}<span class="stat__unit">/21</span>`;
    els.xp.textContent = state.totalXP.toLocaleString();
    els.resets.textContent = state.resetCount;
    const pct = Math.round((completed / TOTAL_DAYS) * 100);
    els.progressFill.style.width = `${pct}%`;
    els.progressPct.textContent = `${pct}%`;
    els.progressFrac.textContent = `${completed} of ${TOTAL_DAYS}`;
  }

  function renderStatus() {
    if (state.challengeDone) {
      setStatus('done', '✦ Challenge Complete', STATUS_MESSAGES.done, '"You did the impossible: you didn\'t quit."');
      return;
    }
    if (state.entries.length === 0) {
      setStatus('active', 'Awaiting Day 1', STATUS_MESSAGES.idle, QUOTES[0]);
      return;
    }
    const cur = computeDayStatus(state.currentDay);
    const quote = QUOTES[Math.min(state.entries.length, QUOTES.length - 1)];
    if (cur.status === 'cooldown') {
      setStatus('locked', `Cooldown · Day ${state.currentDay} locked`, STATUS_MESSAGES.cooldown, quote);
    } else if (cur.status === 'urgent') {
      setStatus('urgent', `Urgent · Day ${state.currentDay} closing`, STATUS_MESSAGES.urgent, quote);
    } else if (cur.status === 'active') {
      setStatus('active', `Live · Day ${state.currentDay} active`, STATUS_MESSAGES.active, quote);
    }
  }
  function setStatus(stateName, label, message, quote) {
    els.statusDot.dataset.state = stateName;
    els.statusLabel.textContent = label;
    els.statusMessage.textContent = message;
    els.statusQuote.textContent = quote;
  }

  function renderCountdown() {
    if (state.challengeDone) {
      els.countdownLabel.textContent = 'Challenge Complete';
      setCountdown(0, 0, 0);
      els.countdownWrap.classList.remove('is-urgent');
      els.countdownWrap.classList.add('is-done');
      return;
    }
    els.countdownWrap.classList.remove('is-done');
    if (state.entries.length === 0) {
      els.countdownLabel.textContent = 'No active timer';
      setCountdown(0, 0, 0);
      els.countdownWrap.classList.remove('is-urgent');
      return;
    }
    const cur = computeDayStatus(state.currentDay);
    const now = Date.now();
    let target = 0, labelText = '';
    if (cur.status === 'cooldown') {
      target = cur.unlockAt - now;
      labelText = `Day ${state.currentDay} unlocks in`;
      els.countdownWrap.classList.remove('is-urgent');
    } else if (cur.status === 'active' || cur.status === 'urgent') {
      target = cur.deadlineAt - now;
      labelText = `Day ${state.currentDay} deadline`;
      if (cur.status === 'urgent') els.countdownWrap.classList.add('is-urgent');
      else els.countdownWrap.classList.remove('is-urgent');
    }
    if (target < 0) target = 0;
    els.countdownLabel.textContent = labelText;
    const { h, m, s } = msToHMS(target);
    setCountdown(h, m, s);
  }
  function setCountdown(h, m, s) {
    els.cdH.textContent = String(h).padStart(2, '0');
    els.cdM.textContent = String(m).padStart(2, '0');
    els.cdS.textContent = String(s).padStart(2, '0');
  }
  function msToHMS(ms) {
    if (ms < 0) ms = 0;
    const t = Math.floor(ms / 1000);
    return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
  }

  function renderAll() {
    renderGrid();
    renderStats();
    renderStatus();
    renderCountdown();
  }

  // 8. INTERACTIONS
  function onNodeClick(day) {
    const s = computeDayStatus(day);
    if (s.status === 'done') { openViewModal(day); return; }
    if (s.status === 'active' || s.status === 'urgent') { openEntryModal(day); return; }
    const node = els.grid.querySelector(`.node[data-day="${day}"]`);
    if (node) {
      node.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
        { duration: 240, easing: 'ease-out' }
      );
    }
  }

  function openEntryModal(day) {
    els.entryEyebrow.textContent = `DAY ${String(day).padStart(2, '0')} · NODE`;
    els.entryTitle.textContent = 'Log today\'s learning';
    els.entryTopic.value = '';
    els.entryHours.value = '';
    els.entryNotes.value = '';
    els.entryModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => els.entryTopic.focus(), 80);
  }
  function closeEntryModal() { els.entryModal.setAttribute('aria-hidden', 'true'); }

  function submitEntry() {
    const topic = els.entryTopic.value.trim();
    const hours = els.entryHours.value;
    const notes = els.entryNotes.value.trim();
    if (!topic) {
      els.entryTopic.focus();
      els.entryTopic.style.borderColor = 'var(--red)';
      setTimeout(() => { els.entryTopic.style.borderColor = ''; }, 1200);
      toast('Tell us what you learned today', 'err');
      return;
    }
    const ok = completeCurrentDay({ topic, hours, notes });
    fetch(`${API_URL}/api/challenges`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  deviceId: getDeviceId(),
  day: state.currentDay - 1,
  title: topic,
  hours: Number(hours),
  notes: notes,
}),
})
.then((res) => res.json())
.then((data) => {
  console.log("MongoDB Saved:", data);
})
.catch((err) => {
  console.error("MongoDB Error:", err);
});

    if (!ok) {
      toast('Could not save — time may have expired', 'err');
      closeEntryModal();
      renderAll();
      return;
    }
    closeEntryModal();
    const justDoneDay = state.currentDay - 1;
    renderAll();
    const node = els.grid.querySelector(`.node[data-day="${justDoneDay}"]`);
    if (node) {
      node.classList.add('node--just-done');
      setTimeout(() => node.classList.remove('node--just-done'), 700);
    }
    toast(`Day ${justDoneDay} locked in · +${XP_PER_DAY} XP`, 'ok');
    if (state.challengeDone) setTimeout(showVictory, 700);
  }

  function openViewModal(day) {
    const entry = state.entries[day - 1];
    if (!entry) return;
    els.viewEyebrow.textContent = `DAY ${String(day).padStart(2, '0')} · COMPLETED`;
    els.viewTitle.textContent = entry.topic || '(no topic)';
    els.viewHours.textContent = entry.hours ? `${entry.hours} h` : '—';
    els.viewWhen.textContent = formatDateTime(entry.completedAt);
    els.viewNotes.textContent = entry.notes || '— no notes —';
    els.viewModal.setAttribute('aria-hidden', 'false');
  }
  function closeViewModal() { els.viewModal.setAttribute('aria-hidden', 'true'); }

  function showResetAlert() {
    els.alertBody.textContent = `You missed your 24-hour window. The challenge resets to Day 1. Reset #${state.resetCount}.`;
    els.resetAlert.setAttribute('aria-hidden', 'false');
  }
  function closeResetAlert() { els.resetAlert.setAttribute('aria-hidden', 'true'); }

  function showVictory() { els.victory.setAttribute('aria-hidden', 'false'); startConfetti(); }
  function closeVictory() { els.victory.setAttribute('aria-hidden', 'true'); stopConfetti(); }

  // 9. CONFETTI
  let confettiParticles = [], confettiRaf = null, confettiCtx = null;
  function startConfetti() {
    const canvas = els.confettiCanvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    confettiCtx = canvas.getContext('2d');
    const colors = ['#00e5ff', '#00ff9d', '#ffb84d', '#b48aff', '#ffffff'];
    confettiParticles = [];
    for (let i = 0; i < 180; i++) {
      confettiParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: 4 + Math.random() * 6, h: 4 + Math.random() * 10,
        vx: -2 + Math.random() * 4, vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI, vRot: -0.2 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    animateConfetti();
  }
  function animateConfetti() {
    const canvas = els.confettiCanvas, ctx = confettiCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiParticles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vRot; p.vy += 0.04;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    confettiParticles = confettiParticles.filter(p => p.y < canvas.height + 40);
    if (confettiParticles.length > 0) confettiRaf = requestAnimationFrame(animateConfetti);
  }
  function stopConfetti() {
    if (confettiRaf) cancelAnimationFrame(confettiRaf);
    confettiRaf = null;
    if (confettiCtx) confettiCtx.clearRect(0, 0, els.confettiCanvas.width, els.confettiCanvas.height);
  }

  // 10. EXPORT
  function exportHistory() {
    const data = {
      app: 'JS21 Challenge Tracker',
      exportedAt: new Date().toISOString(),
      progress: {
        completedDays: state.entries.length, totalDays: TOTAL_DAYS,
        challengeComplete: state.challengeDone, totalXP: state.totalXP,
        resetCount: state.resetCount,
        firstStartedAt: state.firstStartedAt ? new Date(state.firstStartedAt).toISOString() : null
      },
      entries: state.entries.map(e => ({
        day: e.day, topic: e.topic, hours: e.hours, notes: e.notes,
        completedAt: new Date(e.completedAt).toISOString()
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `js21-journal-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Journal exported', 'ok');
  }

  // 11. UTIL
  function formatDateTime(ts) {
    const d = new Date(ts);
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  }
  function updateFootClock() {
    els.footTime.textContent = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  let toastTimer = null;
  function toast(text, type = 'ok') {
    els.toast.textContent = text;
    els.toast.className = `toast show toast--${type}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.className = 'toast'; }, 2800);
  }

  // 12. EVENTS
  function bindEvents() {
    document.addEventListener('click', e => {
      if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) {
        const modal = e.target.closest('.modal');
        if (modal) modal.setAttribute('aria-hidden', 'true');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeEntryModal(); closeViewModal(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (els.entryModal.getAttribute('aria-hidden') === 'false') submitEntry();
      }
    });
    els.entrySubmit.addEventListener('click', submitEntry);
    els.alertAck.addEventListener('click', () => { closeResetAlert(); renderAll(); });
    els.victoryClose.addEventListener('click', closeVictory);
    els.victoryExport.addEventListener('click', exportHistory);
    els.btnExport.addEventListener('click', exportHistory);
    els.btnReset.addEventListener('click', () => {
      const completed = state.entries.length;
      if (completed === 0 && !state.challengeDone) {
        toast('Nothing to reset — start with Day 1', 'ok');
        return;
      }
      const confirmMsg = state.challengeDone
        ? 'Reset the challenge and start over from Day 1? Your completed journal will be cleared.'
        : `Reset your ${completed}-day streak? This cannot be undone.`;
      if (confirm(confirmMsg)) {

  fetch(
    `${API_URL}/api/challenges/${getDeviceId()}`,
    {
      method: "DELETE"
    }
  )
  .then(res => res.json())
  .then(data => {

    console.log(data);

    doReset({ automatic: false });

    renderAll();

    toast(
      'Challenge reset · back to Day 1',
      'ok'
    );
  })
  .catch(err => {
    console.error(err);
  });

}
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndApplyReset();
        renderAll();
      }
    });
    window.addEventListener('resize', () => {
      if (els.victory.getAttribute('aria-hidden') === 'false') {
        els.confettiCanvas.width = els.confettiCanvas.clientWidth;
        els.confettiCanvas.height = els.confettiCanvas.clientHeight;
      }
    });
  }

  // 13. TICK
  function tick() {
    if (checkAndApplyReset()) { renderAll(); return; }
    const prev = window.__lastCurStatus;
    const cur = state.entries.length === 0 ? 'idle' : computeDayStatus(state.currentDay).status;
    if (cur !== prev) {
      window.__lastCurStatus = cur;
      renderGrid();
      renderStatus();
    }
    renderCountdown();
  }

async function loadChallengesFromMongoDB() {
  try {
    const response = await fetch(
  `${API_URL}/api/challenges/${getDeviceId()}`
);

    const data = await response.json();

    state.entries = data
      .sort((a, b) => a.day - b.day)
      .map(item => ({
        day: item.day,
        topic: item.title,
        hours: item.hours,
        notes: item.notes,
        completedAt: new Date(item.completedAt).getTime()
      }));

    state.currentDay = state.entries.length + 1;

    state.totalXP = state.entries.length * 100;

    console.log("MongoDB Loaded Into State", state);

  } catch (error) {
    console.error(error);
  }
}

  // 14. INIT
  async function init() {

  await loadChallengesFromMongoDB();

  if (!storageAvailable) els.demoBanner.style.display = 'block';

  const wasReset = checkAndApplyReset();

  bindEvents();

  renderAll();

  setInterval(tick, 1000);
  setInterval(updateFootClock, 1000);

  updateFootClock();

  if (!wasReset && state.entries.length === 0 && state.resetCount === 0) {
    setTimeout(() => toast('Welcome. 21 days. One node per day.', 'ok'), 400);
  }
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

const challengeInput = document.getElementById("challenge-name-input");
const saveButton = document.getElementById("save-challenge-name");
const challengeTitle = document.getElementById("challenge-title");
const editButton = document.getElementById("edit-challenge-btn");

const savedChallengeName = localStorage.getItem("challengeName");
if (savedChallengeName) {

    challengeTitle.textContent =
        savedChallengeName;

    challengeTitle.style.display =
        "block";

    editButton.style.display =
        "inline-block";

    challengeInput.style.display =
        "none";

    saveButton.style.display =
        "none";
}


editButton.addEventListener("click", function () {

    challengeTitle.style.display = "none";

    editButton.style.display = "none";

    challengeInput.style.display = "";

saveButton.style.display = "";

    challengeInput.value = challengeTitle.textContent;

    saveButton.textContent = "Update";

});

saveButton.addEventListener("click", function () {

    const challengeName = challengeInput.value;

    challengeTitle.textContent = challengeName;

    localStorage.setItem(
  "challengeName",
  challengeName
);

    challengeTitle.style.display = "block";

    editButton.style.display = "inline-block";
    
    challengeInput.style.display = "none";

    saveButton.style.display = "none";

});

})();
