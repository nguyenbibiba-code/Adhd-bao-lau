'use strict';
/* ============ ADHD · Bao Lâu — lõi: dữ liệu, âm thanh, luồng làm việc ============ */
const MIN = 60000, DAY = 86400000;
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clock = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : null;
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// 8'39  |  45"  |  1h05'
function fm(ms) {
  if (ms == null || isNaN(ms)) return '–';
  let s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s = s % 60;
  if (h) return h + 'h' + pad(m) + "'";
  if (m === 0) return s + '"';
  return s ? m + "'" + pad(s) : m + "'";
}
function mmss(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
}
function fmLong(min) {
  min = Math.round(min); const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} giờ ${m} phút` : `${h} giờ`) : `${m} phút`;
}

/* ---------- dữ liệu ---------- */
const KEY = 'adhd-baolau-v1';
function defaults() {
  const now = Date.now();
  return {
    tasks: [
      { id: uid(), name: 'Đi tắm', tag: 'Daily', type: 'fixed', est: 15, actionSec: 30, leadIn: 'Lấy quần áo', created: now,
        steps: [{ t: 'Lấy quần áo + khăn', m: 1 }, { t: 'Xuống nhà tắm', m: 1 }, { t: 'Tắm gội', m: 8 }, { t: 'Lau người, mặc đồ', m: 4 }] },
      { id: uid(), name: 'Uống một ly nước', tag: 'Daily', type: 'fixed', est: 1, actionSec: 10, leadIn: 'Cầm ly lên', created: now, steps: [] },
      { id: uid(), name: 'Rửa vài cái chén', tag: 'Daily', type: 'fixed', est: 5, actionSec: 20, leadIn: 'Mở nước', created: now, steps: [] }
    ],
    runs: [], tags: ['Daily'], cart: [], ideas: [], dumps: [], bingo: {}, active: null, lastTag: 'Daily',
    proc: null, procs: [], reasons: ['Xem điện thoại', 'Suy nghĩ chưa xong', 'Thấy quá nhiều bước / quá sức', 'Đang phấn khích chuyện khác', 'Mệt / buồn ngủ', 'Lo lắng'],
    settings: { ring: false, sound: true, vib: true, hold: 'A', todayGroup: 'tag' }
  };
}
function loadState() {
  try {
    const r = localStorage.getItem(KEY);
    if (r) { const d = JSON.parse(r), b = defaults(); return Object.assign(b, d, { settings: Object.assign(b.settings, d.settings || {}) }); }
  } catch (e) { }
  return defaults();
}
let S = loadState(), saveT = 0;
function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 60); }
const T = id => S.tasks.find(t => t.id === id);
const runsOfTask = id => S.runs.filter(r => r.taskId === id).sort((a, b) => b.end - a.end);

/* ---------- âm thanh / rung / toast ---------- */
let AC = null;
function audio() {
  if (!S.settings.sound) return null;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; }
}
function tone(f, t0, d, type, v) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type || 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.05);
}
function burstNoise() {
  const a = audio(); if (!a) return;
  const len = a.sampleRate * 0.35, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 1200; g.gain.value = 0.25;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(a.destination); s.start();
}
const sfx = {
  tick: () => tone(660, 0, 0.08, 'triangle', 0.15),
  beep: () => tone(880, 0, 0.14, 'square', 0.08),
  win: () => { burstNoise(); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.06 + i * 0.08, 0.3, 'triangle', 0.2)); },
  bingo: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.1, 0.35, 'square', 0.1)); }
};
function vib(p) { if (S.settings.vib && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { } } }
let toastT = 0;
function toast(msg) {
  $$('.toast').forEach(e => e.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
  clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 2200);
}
function confetti(canvas) {
  const ctx = canvas.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  const w = canvas.width = canvas.clientWidth * dpr, h = canvas.height = canvas.clientHeight * dpr;
  const cols = ['#FFD400', '#FFFFFF', '#FFB800', '#FFE766'];
  const ps = Array.from({ length: 110 }, () => {
    const a = Math.random() * Math.PI * 2, sp = (6 + Math.random() * 12) * dpr;
    return { x: w / 2, y: h * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6 * dpr, s: (5 + Math.random() * 8) * dpr, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6, vr: Math.random() * 0.4 - 0.2 };
  });
  let f = 0;
  (function step() {
    ctx.clearRect(0, 0, w, h);
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.35 * dpr; p.vx *= 0.99; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++f < 130 && canvas.isConnected) requestAnimationFrame(step);
  })();
}

/* ---------- hành động, ngăn xếp lớp phủ (cử chỉ Back) ---------- */
const A = {}, CH = {}, HOLD = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  try { fn(el.dataset, el, e); } catch (err) { console.error(err); toast('Lỗi: ' + err.message); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-ch]'); if (!el) return;
  const fn = CH[el.dataset.ch]; if (!fn) return;
  try { fn(el, el.dataset); } catch (err) { console.error(err); toast('Lỗi: ' + err.message); }
});
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-hold]')) e.preventDefault(); });

const stack = [];
function pushEntry(el, onclose, extra) {
  let pushed = false;
  try { history.pushState({ ov: 1 }, ''); pushed = true; } catch (e) { }
  const s = Object.assign({ el, onclose, pushed }, extra || {}); stack.push(s); return s;
}
function closeEntry(s) {
  const i = stack.indexOf(s); if (i < 0) return;
  if (s.pushed && i === stack.length - 1) { history.back(); return; }
  stack.splice(i, 1); if (s.el) s.el.remove(); if (s.onclose) s.onclose();
}
window.addEventListener('popstate', () => {
  const s = stack.pop();
  if (s) { if (s.el) s.el.remove(); if (s.onclose) s.onclose(); return; }
  if (S.active && S.active.start) { try { history.pushState({ ov: 1 }, ''); } catch (e) { } toast('Đang làm dở. Bấm Hoàn thành hoặc Hủy.'); }
});

const sheets = {};
function openSheet(name, draw, opts) {
  opts = opts || {};
  if (sheets[name]) { sheets[name]._draw(); return sheets[name]; }
  const ov = document.createElement('div'); ov.className = 'ov'; ov.innerHTML = '<div class="sh"></div>';
  const sh = ov.firstChild;
  ov._draw = () => { const st = sh.scrollTop; sh.innerHTML = draw(); sh.scrollTop = st; };
  document.body.appendChild(ov); sheets[name] = ov;
  ov._entry = pushEntry(ov, () => { delete sheets[name]; if (opts.onclose) opts.onclose(); });
  ov.addEventListener('click', e => { if (e.target === ov) closeEntry(ov._entry); });
  ov._draw(); return ov;
}
function closeSheet(name) { const el = sheets[name]; if (el) closeEntry(el._entry); }
A.close = d => closeSheet(d.n);
function refresh() { render(); Object.values(sheets).forEach(el => el._draw()); }

/* nút giữ 5 giây */
let holdSt = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-hold]'); if (!b) return;
  e.preventDefault(); audio();
  const t0 = performance.now(); holdSt = { b, raf: 0 };
  const step = () => {
    if (!holdSt || holdSt.b !== b) return;
    const p = Math.min(1, (performance.now() - t0) / 5000); b.style.setProperty('--p', p);
    if (p >= 1) { const d = Object.assign({}, b.dataset); holdSt = null; b.style.setProperty('--p', 0); vib([30, 40, 60]); sfx.beep(); if (HOLD[d.hold]) { try { HOLD[d.hold](d); } catch (err) { console.error(err); toast('Lỗi: ' + err.message); } } return; }
    holdSt.raf = requestAnimationFrame(step);
  };
  step();
});
function cancelHold() { if (holdSt) { cancelAnimationFrame(holdSt.raf); holdSt.b.style.setProperty('--p', 0); holdSt = null; } }
document.addEventListener('pointerup', cancelHold);
document.addEventListener('pointercancel', cancelHold);
document.addEventListener('pointermove', e => { if (holdSt && e.pointerType !== 'touch') { const r = holdSt.b.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cancelHold(); } });
const holdBtn = (kind, label, attrs, cls) => `<button class="hold ${cls || ''}" data-hold="${kind}" ${attrs || ''}><span>${label}</span></button>`;

/* ---------- giỏ hôm nay ---------- */
function addCart(id) {
  if (S.cart.some(c => c.id === id && !c.done)) { toast('Đã có trong Làm hôm nay'); return false; }
  S.cart.push({ id, on: true, done: false, day: dayKey(Date.now()), addedAt: Date.now() }); save(); toast('Đã thêm vào Làm hôm nay'); return true;
}
function rollCart() {
  const today = dayKey(Date.now());
  S.cart = S.cart.filter(c => T(c.id) && !(c.done && c.day < today));
  S.cart.forEach(c => { if (!c.done && c.day < today) { c.day = today; c.carried = (c.carried || 0) + 1; const t = T(c.id); if (t) t.carried = (t.carried || 0) + 1; } });
}

/* ---------- bingo ---------- */
function bingoLines(b) {
  const n = b.n, L = [];
  for (let r = 0; r < n; r++) L.push([...Array(n)].map((_, i) => r * n + i));
  for (let c = 0; c < n; c++) L.push([...Array(n)].map((_, i) => i * n + c));
  L.push([...Array(n)].map((_, i) => i * n + i)); L.push([...Array(n)].map((_, i) => i * n + (n - 1 - i)));
  return L.filter(l => l.every(i => b.marks[i]));
}
function bingoSet(tag, idx, val) {
  const b = S.bingo[tag]; if (!b) return 0;
  const before = bingoLines(b).length; b.marks[idx] = val; const after = bingoLines(b).length;
  save(); return Math.max(0, after - before);
}
function bingoOnDone(t) {
  const b = S.bingo[t.tag]; if (!b) return 0; let add = 0;
  b.cells.forEach((id, i) => { if (id === t.id && !b.marks[i]) add += bingoSet(t.tag, i, true); });
  return add;
}
function bingoNew(tag, n) {
  const pool = S.tasks.filter(t => t.tag === tag && !t.done).sort(() => Math.random() - 0.5);
  const total = n * n, free = n % 2 ? (total - 1) / 2 : -1, cells = [], marks = [];
  let k = 0;
  for (let i = 0; i < total; i++) {
    if (i === free) { cells.push('FREE'); marks.push(true); } else { cells.push(pool[k] ? pool[k++].id : null); marks.push(false); }
  }
  S.bingo[tag] = { n, cells, marks }; save();
}

/* ---------- luồng làm việc ---------- */
let runEl = null, tickT = 0, wake = null, cdState = null, actState = null;

function startFlow(taskId, queue) {
  const t = T(taskId); if (!t) return;
  if (S.active) { toast('Đang có một việc đang làm'); showRun(); return; }
  queue = queue && queue.length ? queue : [taskId];
  const ci = S.cart.find(c => c.id === taskId && !c.done);
  S.active = { taskId, queue, qi: Math.max(0, queue.indexOf(taskId)), start: 0, ints: [], pause: null, ticks: [], fired: {}, addedAt: ci ? ci.addedAt : null };
  save();
  countdown(() => { if (S.settings.hold === 'A' && t.leadIn) actionPhase(t); else beginRun(); });
}
function countdown(cb) {
  const el = document.createElement('div'); el.className = 'cd'; document.body.appendChild(el);
  let n = 3;
  const draw = () => { el.innerHTML = `<div class="n">${n}</div><div class="t">Chuẩn bị…</div><button class="lnk" data-a="cdCancel">Hủy</button>`; };
  draw(); sfx.tick(); vib(15);
  const iv = setInterval(() => {
    n--; if (n <= 0) { clearInterval(iv); el.remove(); cdState = null; cb(); return; }
    draw(); sfx.tick(); vib(15);
  }, 1000);
  cdState = { iv, el };
}
A.cdCancel = () => { if (cdState) { clearInterval(cdState.iv); cdState.el.remove(); cdState = null; } if (S.active && !S.active.start) { S.active = null; save(); } };
function actionPhase(t) {
  const el = document.createElement('div'); el.className = 'cd'; document.body.appendChild(el);
  let left = Math.max(5, t.actionSec || 30);
  el.innerHTML = `<div class="sub">Việc dẫn đến</div><div class="t" style="font-size:30px;margin:8px 0 14px">${esc(t.leadIn)}</div><div class="n" id="actn" style="font-size:min(40vw,150px)">${left}</div><div class="t">giây</div><div style="margin-top:24px;width:100%;max-width:420px"><button class="btn y big" data-a="actDone">Xong rồi → bắt đầu</button><br><button class="lnk" data-a="actCancel">Hủy</button></div>`;
  const iv = setInterval(() => { left--; if (left <= 0) { finish(); return; } const n = $('#actn', el); if (n) n.textContent = left; if (left <= 3) { sfx.tick(); vib(10); } }, 1000);
  function finish() { clearInterval(iv); el.remove(); actState = null; vib([40, 60, 40]); sfx.beep(); beginRun(); }
  actState = { iv, el, finish };
}
A.actDone = () => { if (actState) actState.finish(); };
A.actCancel = () => { if (actState) { clearInterval(actState.iv); actState.el.remove(); actState = null; } S.active = null; save(); };

function beginRun() {
  if (!S.active) return;
  S.active.start = Date.now(); save(); showRun();
}
const pureMs = (a, now) => {
  now = now || Date.now();
  let i = sum(a.ints.map(x => x.end - x.start)); if (a.pause) i += now - a.pause.start;
  return Math.max(0, now - a.start - i);
};
const REASONS = ['Điện thoại', 'Có người gọi / nhắn', 'Nghĩ ra việc khác', 'Vệ sinh / đói / khát', 'Mất tập trung', 'Khác'];

function showRun() {
  if (!S.active || !S.active.start) return;
  if (!runEl) {
    runEl = document.createElement('div'); runEl.className = 'runfull'; document.body.appendChild(runEl);
    try { history.pushState({ ov: 1 }, ''); } catch (e) { }
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(w => { wake = w; }).catch(() => { }); } catch (e) { }
  }
  renderRun(); clearInterval(tickT); tickT = setInterval(tickRun, 250); tickRun();
}
const RC = 2 * Math.PI * 100;
function renderRun() {
  const a = S.active, t = T(a.taskId); if (!runEl || !a || !t) return;
  const ring = S.settings.ring;
  const lead = (S.settings.hold === 'B' && t.leadIn) ? `<ul class="rsteps"><li class="lead"><span class="ico y">▶</span><div class="grow"><div class="sub">Việc dẫn đến</div><div class="nm">${esc(t.leadIn)}</div></div></li></ul>` : '';
  const steps = (t.steps || []).length ? `<ul class="rsteps">${t.steps.map((s, i) => { const on = a.ticks.some(k => k.i === i); return `<li class="${on ? 'on' : ''}" data-a="stepTick" data-i="${i}"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1" style="pointer-events:none"><div class="grow nm">${esc(s.t)}</div><span class="sub">${s.m}'</span></li>`; }).join('')}</ul>` : '';
  const paused = a.pause ? `<div class="paused"><div class="tg">ĐANG GIÁN ĐOẠN</div><h2 style="font-size:24px">Chuyện gì vậy?</h2><div class="chips" style="justify-content:center">${REASONS.map(r => `<span class="chip ${a.pause.reason === r ? 'on' : ''}" data-a="pauseReason" data-r="${esc(r)}">${esc(r)}</span>`).join('')}</div><button class="btn y big" data-a="runResume">Quay lại làm</button></div>` : '';
  runEl.innerHTML = `${paused}
  <div class="rtop"><span class="tg">#${esc(t.tag)}${a.queue.length > 1 ? ` · việc ${a.qi + 1}/${a.queue.length}` : ''}</span><button class="btn sm" data-a="runMode">${ring ? '12:34 Hiện số' : '◔ Ẩn số'}</button></div>
  <div class="rname">${esc(t.name)}</div>
  <div class="clockwrap"><svg viewBox="0 0 220 220"><circle class="ring-bg" cx="110" cy="110" r="100" fill="none" stroke-width="14"/><circle id="rfg" class="ring-fg" cx="110" cy="110" r="100" fill="none" stroke-width="14" stroke-dasharray="${RC}" stroke-dashoffset="0"/></svg>
  <div class="ctr">${ring ? '<div class="sub" id="rt">Đang làm…</div>' : '<div class="big" id="rt">0:00</div><div class="over" id="ro"></div>'}</div></div>
  <div class="rsub" id="rsub"></div>
  ${lead}${steps}
  <div class="rbtns"><button class="btn" data-a="runPause">⏸ Gián đoạn</button><button class="btn" data-a="ideaOpen">💡 Bãi ý tưởng</button><button class="btn" data-a="dumpOpen">🧠 Xả não</button></div>
  <button class="btn y big" data-a="runDone">HOÀN THÀNH</button>
  <button class="lnk" data-a="runCancel" style="align-self:center;width:auto">Hủy lần này</button>`;
}
function tickRun() {
  if (!S.active || !runEl) return;
  const a = S.active, t = T(a.taskId); if (!t) return;
  const now = Date.now(), p = pureMs(a, now), est = Math.max(1, t.est) * MIN;
  const fg = $('#rfg', runEl);
  if (fg) { const over = p > est; fg.classList.toggle('ring-over', over); fg.style.strokeDashoffset = over ? 0 : RC * (1 - Math.max(0, 1 - p / est)); }
  const rt = $('#rt', runEl); if (rt && !S.settings.ring) rt.textContent = mmss(p);
  const ro = $('#ro', runEl); if (ro) ro.textContent = p > est ? '+' + mmss(p - est) + ' quá ước lượng' : '';
  const rs = $('#rsub', runEl);
  if (rs) rs.textContent = a.pause ? 'Đang tạm dừng' : `Ước lượng ${t.est}' · dự kiến xong lúc ${clock(now + Math.max(0, est - p))}`;
  if (!a.pause) [0.5, 1, 1.5].forEach(m => { if (p / est >= m && !a.fired[m]) { a.fired[m] = 1; vib(m === 1 ? [80, 60, 80] : 60); sfx.tick(); save(); } });
}
A.runMode = () => { S.settings.ring = !S.settings.ring; save(); renderRun(); tickRun(); };
A.stepTick = d => {
  const a = S.active, i = +d.i, k = a.ticks.findIndex(x => x.i === i);
  if (k >= 0) a.ticks.splice(k, 1); else { a.ticks.push({ i, at: pureMs(a) }); sfx.tick(); vib(20); }
  save(); renderRun(); tickRun();
};
A.runPause = () => { const a = S.active; if (a.pause) return; a.pause = { start: Date.now(), reason: null }; save(); renderRun(); tickRun(); };
A.pauseReason = d => { const a = S.active; if (a && a.pause) { a.pause.reason = d.r; save(); renderRun(); } };
A.runResume = () => { const a = S.active; if (!a || !a.pause) return; const now = Date.now(); a.ints.push({ reason: a.pause.reason || 'Khác', start: a.pause.start, end: now }); a.pause = null; save(); renderRun(); tickRun(); };
let cancelArm = 0;
A.runCancel = (d, el) => {
  if (!cancelArm || Date.now() - cancelArm > 3500) { cancelArm = Date.now(); el.textContent = 'Bấm lần nữa để hủy (không lưu lần này)'; return; }
  cancelArm = 0; endRunUI(); S.active = null; save(); toast('Đã hủy lần này'); refresh();
};
function endRunUI() { clearInterval(tickT); if (runEl) { runEl.remove(); runEl = null; } if (wake) { try { wake.release(); } catch (e) { } wake = null; } }

const OK_MSG = ['Chúc mừng bạn đã hoàn thành!', 'Làm tốt lắm, xong rồi!', 'Bạn đã làm được rồi!'];
const LATE_MSG = ['Chúc mừng, dù sao bạn cũng đã hoàn thành!', 'Trễ một chút cũng không sao, bạn đã xong!'];
A.runDone = () => {
  const a = S.active, t = T(a.taskId); if (!a || !t) return;
  const now = Date.now();
  if (a.pause) { a.ints.push({ reason: a.pause.reason || 'Khác', start: a.pause.start, end: now }); a.pause = null; }
  const total = now - a.start, ints = a.ints.map(i => ({ reason: i.reason, start: i.start, end: i.end, ms: i.end - i.start }));
  const pure = Math.max(0, total - sum(ints.map(i => i.ms)));
  let last = 0;
  const steps = [...a.ticks].sort((x, y) => x.at - y.at).map(k => { const r = { i: k.i, t: (t.steps[k.i] || {}).t || '', ms: Math.max(0, k.at - last) }; last = k.at; return r; });
  const run = { id: uid(), taskId: t.id, name: t.name, tag: t.tag, type: t.type, est: t.est, start: a.start, end: now, pure, total, ints, steps, note: '', addedAt: a.addedAt || null };
  S.runs.push(run);
  if (t.type === 'quick') { t.done = true; t.doneAt = now; }
  S.cart.forEach(c => { if (c.id === t.id && !c.done) c.done = true; });
  const lines = bingoOnDone(t);
  const queue = a.queue, qi = a.qi;
  S.active = null; saveNow(); cancelArm = 0; endRunUI();
  celebrate(run, t, { queue, qi, lines });
  refresh();
};
function celebrate(run, t, o) {
  const late = run.total > t.est * MIN;
  const msg = (late ? LATE_MSG : OK_MSG)[Math.floor(Math.random() * (late ? LATE_MSG : OK_MSG).length)];
  const faster = t.est * MIN - run.total;
  const sub = (!late && faster >= 60000) ? `Nhanh hơn dự kiến ${fm(faster)}` : '';
  const nextId = o.queue[o.qi + 1], nx = nextId && T(nextId) && !T(nextId).done ? T(nextId) : null;
  const el = document.createElement('div'); el.className = 'cel';
  el.innerHTML = `<canvas></canvas><div class="em">${late ? '💥' : '🎉'}</div><h2>${esc(msg)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}${o.lines ? `<p style="color:#FFD400;font-weight:800;font-size:20px">BINGO! +${o.lines} dòng</p>` : ''}<p class="sub">${esc(t.name)} · ${fm(run.total)}</p>
  ${nx ? `<button class="btn y" data-a="celNext" data-id="${nx.id}" data-qi="${o.qi + 1}">Việc tiếp theo: ${esc(nx.name)}</button>` : ''}
  <button class="btn ${nx ? '' : 'y'}" data-a="celClose">${nx ? 'Nghỉ chút' : 'Xong'}</button>`;
  el._q = o.queue; document.body.appendChild(el); celEl = el;
  sfx.win(); vib([60, 40, 60, 40, 120]); if (o.lines) setTimeout(sfx.bingo, 500);
  confetti($('canvas', el));
}
let celEl = null;
A.celClose = () => { if (celEl) { celEl.remove(); celEl = null; } };
A.celNext = d => { const q = celEl ? celEl._q : [d.id]; A.celClose(); startFlow(d.id, q); };

/* Bãi ý tưởng + Xả não (dùng được ở mọi nơi) */
A.ideaOpen = () => openSheet('ideas', drawIdeas);
function drawIdeas() {
  return `<div class="hd"><h2>💡 Bãi ý tưởng</h2><button class="x" data-a="close" data-n="ideas">✕</button></div>
  <div class="row" style="margin-bottom:12px"><input id="ideain" placeholder="Ghi nhanh một ý, xong quay lại việc đang làm" data-a="noop"><button class="btn y" data-a="ideaAdd">Ghi</button></div>
  ${S.ideas.length ? S.ideas.map(i => `<div class="trow"><div class="grow">${esc(i.text)}</div><button class="btn sm" data-a="ideaTask" data-id="${i.id}">→ Việc</button><button class="x" data-a="ideaDel" data-id="${i.id}">✕</button></div>`).join('') : '<div class="empty">Chưa có ý nào. Có gì chợt nảy ra thì ghi vào đây, đừng bỏ việc đang làm.</div>'}
  ${S.dumps.length ? `<div class="lbl">Xả não gần đây</div>${S.dumps.slice(-3).reverse().map(d => `<div class="card sub" style="white-space:pre-wrap">${esc(d.text)}</div>`).join('')}` : ''}`;
}
A.noop = () => { };
A.ideaAdd = () => { const i = $('#ideain'); const v = i && i.value.trim(); if (!v) return; S.ideas.unshift({ id: uid(), text: v, at: Date.now() }); save(); refresh(); setTimeout(() => { const n = $('#ideain'); if (n) n.focus(); }, 30); };
A.ideaDel = d => { S.ideas = S.ideas.filter(i => i.id !== d.id); save(); refresh(); };
A.ideaTask = d => {
  const i = S.ideas.find(x => x.id === d.id); if (!i) return;
  const t = { id: uid(), name: i.text.slice(0, 80), tag: S.lastTag || S.tags[0], type: 'quick', est: 10, actionSec: 30, leadIn: '', steps: [], created: Date.now() };
  S.tasks.push(t); S.ideas = S.ideas.filter(x => x.id !== i.id); save(); refresh(); toast('Đã tạo việc nhanh: ' + t.name);
};
let dumpIv = 0;
A.dumpOpen = () => {
  let left = 120;
  openSheet('dump', () => `<div class="hd"><h2>🧠 Xả não 2 phút</h2><button class="x" data-a="dumpClose">✕</button></div>
  <div class="sub" style="margin-bottom:10px">Gõ mọi thứ đang rối trong đầu, không cần đúng hay đủ. Hết giờ tự khép lại.</div>
  <div class="est" id="dumpt" style="font-size:30px;text-align:center;margin-bottom:8px">${mmss(left * 1000)}</div>
  <textarea id="dumptx" style="min-height:200px" placeholder="Cứ gõ đi…"></textarea>
  <button class="btn y full" style="margin-top:10px" data-a="dumpClose">Xong, đầu nhẹ hơn rồi</button>`, { onclose: () => clearInterval(dumpIv) });
  setTimeout(() => { const x = $('#dumptx'); if (x) x.focus(); }, 50);
  clearInterval(dumpIv);
  dumpIv = setInterval(() => { left--; const e = $('#dumpt'); if (e) e.textContent = mmss(left * 1000); if (left <= 0) { vib([80, 60, 80]); A.dumpClose(); } }, 1000);
};
A.dumpClose = () => {
  clearInterval(dumpIv); const x = $('#dumptx'); const v = x && x.value.trim();
  if (v) { S.dumps.push({ at: Date.now(), text: v }); S.dumps = S.dumps.slice(-20); save(); }
  closeSheet('dump'); toast('Đã xả xong. Giờ làm một việc nhỏ nhé.');
};



/* ================= v2: vuốt, nhập tay, trì hoãn ================= */
let undoFn = null;
function toastAct(msg, label, fn) {
  $$('.toast').forEach(e => e.remove());
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `${esc(msg)} <button class="lnk" data-a="toastAct" style="color:#000;padding:0 0 0 8px;font-weight:800;text-decoration:none">${esc(label)}</button>`;
  document.body.appendChild(el); undoFn = fn; clearTimeout(toastT);
  toastT = setTimeout(() => { el.remove(); undoFn = null; }, 6000);
}
A.toastAct = () => { if (undoFn) { const f = undoFn; undoFn = null; f(); $$('.toast').forEach(e => e.remove()); } };

/* vuốt: phải→trái = xong, trái→phải = xóa */
let sw = null, swBlock = 0;
document.addEventListener('pointerdown', e => {
  const r = e.target.closest('[data-sw]'); if (!r || e.target.closest('input,button,select,textarea')) return;
  sw = { r, x: e.clientX, y: e.clientY, dx: 0, on: false, pid: e.pointerId };
});
document.addEventListener('pointermove', e => {
  if (!sw) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.on) {
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) { sw.on = true; try { sw.r.setPointerCapture(sw.pid); } catch (x) { } }
    else if (Math.abs(dy) > 12) { sw = null; return; } else return;
  }
  sw.dx = dx; const c = $('.swc', sw.r); if (!c) return;
  c.style.transition = 'none'; c.style.transform = `translateX(${dx}px)`;
  $('.swbg.l', sw.r).style.opacity = dx < 0 ? 1 : 0; $('.swbg.r', sw.r).style.opacity = dx > 0 ? 1 : 0;
});
function swEnd() {
  if (!sw) return; const s = sw; sw = null; if (!s.on) return;
  swBlock = Date.now() + 400;
  const c = $('.swc', s.r), th = Math.min(110, s.r.offsetWidth * 0.3), ds = Object.assign({}, s.r.dataset);
  c.style.transition = 'transform .2s';
  if (s.dx <= -th) { c.style.transform = 'translateX(-110%)'; setTimeout(() => swAct('done', ds), 190); }
  else if (s.dx >= th) { c.style.transform = 'translateX(110%)'; setTimeout(() => swAct('del', ds), 190); }
  else { c.style.transform = 'translateX(0)'; $$('.swbg', s.r).forEach(b => { b.style.opacity = 0; }); }
}
document.addEventListener('pointerup', swEnd);
document.addEventListener('pointercancel', swEnd);
document.addEventListener('click', e => { if (Date.now() < swBlock) { e.stopPropagation(); e.preventDefault(); } }, true);
function swAct(kind, ds) {
  const id = ds.sw; if (!T(id)) { render(); return; }
  if (kind === 'done') { render(); openManual(id); return; }
  if (ds.swk === 'cart') removeFromToday(id); else deleteTaskUndo(id);
}
function removeFromToday(id) {
  const items = S.cart.filter(c => c.id === id && !c.done); if (!items.length) { render(); return; }
  S.cart = S.cart.filter(c => !(c.id === id && !c.done)); save(); render();
  toastAct('Đã bỏ khỏi Làm hôm nay', 'Hoàn tác', () => { S.cart.push(...items); save(); refresh(); });
}
function deleteTaskUndo(id) {
  const t = T(id); if (!t) return; const idx = S.tasks.indexOf(t), cart = S.cart.filter(c => c.id === id), cells = [];
  Object.entries(S.bingo).forEach(([g, b]) => b.cells.forEach((c, i) => { if (c === id) cells.push([g, i, b.marks[i]]); }));
  S.tasks.splice(idx, 1); S.cart = S.cart.filter(c => c.id !== id);
  cells.forEach(([g, i]) => { S.bingo[g].cells[i] = null; S.bingo[g].marks[i] = false; });
  save(); refresh();
  toastAct('Đã xóa “' + t.name + '”', 'Hoàn tác', () => {
    S.tasks.splice(idx, 0, t); S.cart.push(...cart);
    cells.forEach(([g, i, m]) => { if (S.bingo[g]) { S.bingo[g].cells[i] = id; S.bingo[g].marks[i] = m; } });
    save(); refresh();
  });
}
/* hoàn thành bằng nhập tay số phút */
function finishManual(id, min) {
  const t = T(id); if (!t) return;
  const now = Date.now(), ms = Math.round(min * MIN);
  const run = { id: uid(), taskId: t.id, name: t.name, tag: t.tag, type: t.type, est: t.est, start: now - ms, end: now, pure: ms, total: ms, ints: [], steps: [], note: '', addedAt: null, manual: true };
  S.runs.push(run);
  if (t.type === 'quick') { t.done = true; t.doneAt = now; }
  S.cart.forEach(c => { if (c.id === id && !c.done) c.done = true; });
  const lines = bingoOnDone(t); saveNow();
  celebrate(run, t, { queue: [id], qi: 0, lines }); refresh();
}

/* ---------- đo thời gian trì hoãn ---------- */
const PCOL = ['#FFD400', '#FFFFFF', '#B38F00', '#BDBDBD', '#FFE766', '#8a8a8a', '#FFB800', '#e0e0e0'];
function procLast(reason) { return S.procs.filter(p => p.reason === reason).sort((a, b) => b.end - a.end)[0] || null; }
function procStart(reason, mode, targetMs) {
  if (S.proc) procEnd();
  S.proc = { reason, start: Date.now(), mode, target: targetMs || 0, fired: false }; save();
}
function procEnd() {
  const p = S.proc; if (!p) return null;
  const now = Date.now(), rec = { id: uid(), reason: p.reason, start: p.start, end: now, ms: now - p.start, mode: p.mode, target: p.target };
  S.procs.push(rec); S.proc = null; save(); return rec;
}
function procText(p) {
  const now = Date.now(), el = now - p.start;
  if (p.mode === 'down') {
    const rem = p.target - el;
    return rem > 0 ? { main: mmss(rem), sub: `Hết giờ lúc ${clock(p.start + p.target)}, rồi bắt đầu làm nhé`, over: false } : { main: '+' + mmss(-rem), sub: 'Đã quá giờ trì hoãn bạn đặt. Bắt đầu làm thôi!', over: true };
  }
  return { main: mmss(el), sub: `Đã trì hoãn từ ${clock(p.start)}`, over: false };
}
function syncPbar() {
  const bar = $('#pbar'), app = $('#app'); if (!bar) return;
  const p = S.proc;
  bar.style.display = p ? 'flex' : 'none'; app.classList.toggle('hasp', !!p);
  if (p) { const t = procText(p); $('#pbr').textContent = p.reason; $('#pbt').textContent = t.main; }
}
setInterval(() => {
  const p = S.proc;
  if (p) {
    const el = Date.now() - p.start;
    if (p.mode === 'down' && !p.fired && el >= p.target) { p.fired = true; save(); vib([200, 100, 200, 100, 300]); sfx.win(); toast('Hết giờ trì hoãn! Bắt đầu việc đầu tiên thôi.'); if (sheets.proc) sheets.proc._draw(); }
    const t = procText(p), a = $('#proct'), b = $('#procs');
    if (a) a.textContent = t.main; if (b) b.textContent = t.sub;
  }
  syncPbar();
}, 1000);

document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); else if (S.active) tickRun(); });
window.addEventListener('pagehide', saveNow);
