'use strict';
/* ============ giao diện: các màn hình, bảng, thống kê ============ */
const ui = {
  view: 'today', tag: null, tagMode: 'list', tagPeriod: '7', statPeriod: 'today',
  libQ: '', libTag: '', libType: '', taskTab: 'stats', taskId: null, edit: null, co: null, pick: null,
  rand: { min: 5, tags: [], res: null, skipDone: true, msg: '' }, delArm: 0
};
const NAV = [['today', 'Hôm nay', '☀'], ['lib', 'Việc', '☰'], ['tags', 'Tag', '#'], ['stats', 'Thống kê', '▮'], ['more', 'Thêm', '⋯']];
const COLORS = { fast: '#FFD400', slow: '#FFFFFF' };

function render() {
  $('#nav').innerHTML = NAV.map(([k, l, i]) => `<button class="${ui.view === k ? 'on' : ''}" data-a="nav" data-v="${k}"><span class="ic">${i}</span>${l}</button>`).join('');
  const m = $('#main'), st = m.scrollTop;
  const f = { today: vToday, lib: vLib, tags: vTags, stats: vStats, more: vMore }[ui.view];
  m.innerHTML = f(); m.scrollTop = st;
}
A.nav = d => { ui.view = d.v; render(); $('#main').scrollTop = 0; };

/* ---------- thành phần dùng chung ---------- */
function trow(t, o) {
  o = o || {};
  return `<div class="trow ${o.cls || ''}" data-a="openTask" data-id="${t.id}"><span class="ico ${t.type === 'fixed' ? 'y' : ''}">${t.type === 'fixed' ? '↻' : '⚡'}</span><div class="grow"><div class="nm">${esc(t.name)}</div><div class="meta">#${esc(t.tag)}${o.meta ? ' · ' + o.meta : ''}</div></div><span class="est">${t.est}'</span>${o.add ? `<button class="btn sm" data-a="addCartBtn" data-id="${t.id}">+ Giỏ</button>` : ''}</div>`;
}
A.addCartBtn = d => { addCart(d.id); refresh(); };
A.openTask = d => { ui.taskId = d.id; ui.taskTab = 'stats'; openSheet('task', drawTask); };
const seg = (items, cur, act) => `<div class="seg">${items.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-a="${act}" data-k="${k}">${l}</button>`).join('')}</div>`;

/* ---------- HÔM NAY (giỏ hàng) ---------- */
function vToday() {
  const items = S.cart.filter(c => T(c.id));
  const todo = items.filter(c => !c.done), done = items.filter(c => c.done);
  const sel = todo.filter(c => c.on), total = sum(sel.map(c => T(c.id).est));
  const today = S.runs.filter(r => r.end >= startOfDay(Date.now()));
  const dstr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
  return `<div class="top"><div><h1>Giỏ hôm nay</h1><div class="sub">${esc(dstr)}${today.length ? ` · đã xong ${today.length} việc` : ''}</div></div><button class="btn sm" data-a="randOpen">🎲 Chọn giùm</button></div>
  <div class="row" style="margin-bottom:12px"><input id="qa" placeholder="Ghi nhanh việc hôm nay…" data-a="noop"><button class="btn y" data-a="qaAdd">+</button></div>
  ${todo.length ? todo.map(c => { const t = T(c.id); return `<div class="trow"><input type="checkbox" data-a="cartTick" data-id="${c.id}" ${c.on ? 'checked' : ''}><div class="grow" data-a="openTask" data-id="${t.id}"><div class="nm">${esc(t.name)}</div><div class="meta">#${esc(t.tag)}${c.carried ? ' · từ hôm trước' : ''}</div></div><span class="est">${t.est}'</span><button class="x" data-a="cartDel" data-id="${c.id}">✕</button></div>`; }).join('') :
    '<div class="empty">Giỏ trống.<br>Ghi nhanh một việc ở trên, thêm từ thư viện, hoặc bấm 🎲 để app chọn giùm.</div>'}
  <button class="btn full" data-a="pickFromLib" style="margin:6px 0 14px">＋ Thêm từ thư viện</button>
  ${todo.length ? `<div class="sumbar"><div><div class="sub">Đã chọn ${sel.length} việc</div><b>${fmLong(total)}</b></div><button class="btn y" data-a="checkout" ${sel.length ? '' : 'disabled'}>Đồng ý →</button></div>` : ''}
  ${done.length ? `<div class="h3">Đã xong hôm nay (${done.length})</div>${done.map(c => trow(T(c.id), { cls: 'done' })).join('')}` : ''}`;
}
A.cartTick = d => { const c = S.cart.find(x => x.id === d.id && !x.done); if (c) { c.on = !c.on; save(); render(); } };
A.cartDel = d => { S.cart = S.cart.filter(c => !(c.id === d.id && !c.done)); save(); render(); };
A.qaAdd = () => {
  const i = $('#qa'), v = i && i.value.trim(); if (!v) return;
  const t = { id: uid(), name: v, tag: S.lastTag || S.tags[0], type: 'quick', est: 10, actionSec: 30, leadIn: '', steps: [], created: Date.now() };
  S.tasks.push(t); addCart(t.id); save(); render(); toast('Đã ghi. Chạm vào việc để chỉnh ước lượng.');
};
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'qa') A.qaAdd();
  if (e.target.id === 'ideain') A.ideaAdd();
  if (e.target.id === 'libq') { const v = e.target.value.trim(); if (v && !S.tasks.some(t => !t.done && t.name.toLowerCase() === v.toLowerCase())) A.libCreate(); }
});

/* ---------- THƯ VIỆN VIỆC ---------- */
function libList() {
  const q = ui.libQ.trim().toLowerCase();
  let ts = S.tasks.filter(t => !t.done);
  if (ui.libTag) ts = ts.filter(t => t.tag === ui.libTag);
  if (ui.libType) ts = ts.filter(t => t.type === ui.libType);
  if (q) ts = ts.filter(t => t.name.toLowerCase().includes(q));
  const last = id => { const r = runsOfTask(id)[0]; return r ? r.end : 0; };
  ts.sort((a, b) => (last(b.id) - last(a.id)) || (b.created - a.created));
  const exact = q && S.tasks.some(t => !t.done && t.name.toLowerCase() === q);
  return `${q && !exact ? `<div class="trow" data-a="libCreate" style="border-color:#FFD400"><span class="ico y">+</span><div class="grow nm">Tạo mới “${esc(ui.libQ.trim())}”</div></div>` : ''}
  ${ts.length ? ts.map(t => { const r = runsOfTask(t.id)[0]; return trow(t, { add: true, meta: (t.type === 'fixed' ? 'cố định' : 'nhanh') + (r ? ' · lần cuối ' + fm(r.total) : '') }); }).join('') : (q ? '' : '<div class="empty">Chưa có việc nào.</div>')}`;
}
function vLib() {
  return `<div class="top"><h1>Thư viện việc</h1></div>
  <input id="libq" placeholder="Tìm việc, hoặc gõ tên việc mới rồi Enter" value="${esc(ui.libQ)}" data-a="noop" style="margin-bottom:10px">
  <div class="chips scroll"><span class="chip ${!ui.libTag ? 'on' : ''}" data-a="libTag" data-k="">Tất cả</span>${S.tags.map(g => `<span class="chip ${ui.libTag === g ? 'on' : ''}" data-a="libTag" data-k="${esc(g)}">#${esc(g)}</span>`).join('')}</div>
  <div class="chips scroll"><span class="chip ${!ui.libType ? 'on' : ''}" data-a="libType" data-k="">Mọi loại</span><span class="chip ${ui.libType === 'fixed' ? 'on' : ''}" data-a="libType" data-k="fixed">↻ Cố định</span><span class="chip ${ui.libType === 'quick' ? 'on' : ''}" data-a="libType" data-k="quick">⚡ Nhanh</span></div>
  <div id="liblist">${libList()}</div>
  <button class="fab" data-a="newTask">+</button>`;
}
document.addEventListener('input', e => { if (e.target.id === 'libq') { ui.libQ = e.target.value; const l = $('#liblist'); if (l) l.innerHTML = libList(); } });
A.libTag = d => { ui.libTag = d.k; render(); };
A.libType = d => { ui.libType = d.k; render(); };
A.libCreate = () => {
  const v = ui.libQ.trim(); if (!v) return;
  const t = { id: uid(), name: v, tag: ui.libTag || S.lastTag || S.tags[0], type: 'quick', est: 10, actionSec: 30, leadIn: '', steps: [], created: Date.now() };
  S.tasks.push(t); ui.libQ = ''; save(); render(); A.openTask({ id: t.id }); toast('Đã tạo. Chỉnh ước lượng nếu cần.');
};
A.newTask = () => openEdit(null);

/* ---------- BẢNG THÔNG TIN MỘT VIỆC ---------- */
function drawTask() {
  const t = T(ui.taskId); if (!t) { setTimeout(() => closeSheet('task'), 0); return ''; }
  const tab = ui.taskTab;
  return `<div class="hd"><div><div class="tg">#${esc(t.tag)} · ${t.type === 'fixed' ? 'Việc cố định' : 'Việc nhanh'}${t.done ? ' · đã xong' : ''}</div><h2>${esc(t.name)}</h2></div><button class="x" data-a="close" data-n="task">✕</button></div>
  <div class="info">
    <div class="kv"><span>Ước lượng</span><b>${t.est} phút</b></div>
    <div class="kv"><span>Hành động</span><b>${t.actionSec} giây</b></div>
    <div class="kv"><span>Việc dẫn đến</span><b>${esc(t.leadIn || '—')}</b></div>
    ${(t.steps || []).length ? `<div class="kv" style="display:block"><span>Việc nhỏ</span><ul class="steps" style="margin-top:6px">${t.steps.map(s => `<li><span>${esc(s.t)}</span><b>${s.m}'</b></li>`).join('')}</ul></div>` : ''}
  </div>
  ${t.done ? `<div class="row" style="margin-bottom:12px"><button class="btn full" data-a="redo" data-id="${t.id}">↻ Làm lại</button><button class="btn full" data-a="toFixed" data-id="${t.id}">→ Việc cố định</button></div>` :
    holdBtn('startTask', 'Giữ 5 giây để bắt đầu', `data-id="${t.id}"`) + `<div class="row" style="margin-bottom:6px"><button class="btn full" data-a="addCartBtn" data-id="${t.id}">+ Giỏ hôm nay</button><button class="btn full" data-a="editTask" data-id="${t.id}">✎ Sửa</button></div>`}
  <div class="seg" style="margin-top:14px"><button class="${tab === 'stats' ? 'on' : ''}" data-a="taskTab" data-k="stats">Thống kê</button><button class="${tab === 'log' ? 'on' : ''}" data-a="taskTab" data-k="log">Nhật ký</button></div>
  ${tab === 'stats' ? taskStats(t) : taskLog(t)}`;
}
HOLD.startTask = d => { const id = d.id; closeSheet('task'); setTimeout(() => startFlow(id, [id]), 60); };
A.taskTab = d => { ui.taskTab = d.k; if (sheets.task) sheets.task._draw(); };
A.editTask = d => openEdit(d.id);
A.redo = d => { const o = T(d.id); const t = Object.assign({}, JSON.parse(JSON.stringify(o)), { id: uid(), done: false, doneAt: 0, created: Date.now() }); S.tasks.push(t); save(); closeSheet('task'); refresh(); toast('Đã tạo bản mới để làm lại'); };
A.toFixed = d => { const t = T(d.id); t.type = 'fixed'; t.done = false; t.doneAt = 0; save(); refresh(); toast('Đã đổi thành việc cố định'); };

function taskLog(t) {
  const rs = runsOfTask(t.id);
  if (!rs.length) return '<div class="empty">Chưa có lần làm nào.</div>';
  return rs.map(r => {
    const d = new Date(r.start), ds = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${clock(r.start)}`;
    const im = sum(r.ints.map(i => i.ms));
    return `<div class="logrow"><div class="row sp"><b>${ds}</b><span class="est">${fm(r.pure)} thuần</span></div>
    <div class="sub">Tổng ${fm(r.total)}${im ? ` · gián đoạn ${fm(im)} (${r.ints.length} lần)` : ''} · ước lượng ${r.est}'</div>
    <textarea data-ch="runNote" data-id="${r.id}" placeholder="Ghi chú cho lần này…">${esc(r.note || '')}</textarea></div>`;
  }).join('');
}
CH.runNote = (el, d) => { const r = S.runs.find(x => x.id === d.id); if (r) { r.note = el.value; save(); } };

/* ---------- THỐNG KÊ MỘT VIỆC ---------- */
function barChart(rs, estMin) {
  const W = 320, H = 150, pl = 28, pb = 20, pt = 12;
  const vals = rs.map(r => r.total / MIN), mx = Math.max(estMin, ...vals) * 1.18 || 1;
  const bw = (W - pl) / rs.length, y = v => pt + (H - pt - pb) * (1 - v / mx);
  const bars = rs.map((r, i) => {
    const v = vals[i], x = pl + i * bw + bw * 0.16, w = bw * 0.68, d = new Date(r.start);
    return `<rect x="${x}" y="${y(v)}" width="${w}" height="${Math.max(1, H - pb - y(v))}" rx="3" fill="${v <= estMin ? COLORS.fast : COLORS.slow}"/>` +
      (rs.length <= 9 ? `<text x="${x + w / 2}" y="${y(v) - 3}" text-anchor="middle">${v < 10 ? v.toFixed(1).replace('.0', '') : Math.round(v)}</text>` : '') +
      (rs.length <= 9 || i % 2 === 0 ? `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${d.getDate()}/${d.getMonth() + 1}</text>` : '');
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${bars}<line x1="${pl}" x2="${W}" y1="${y(estMin)}" y2="${y(estMin)}" stroke="#fff" stroke-dasharray="4 4" opacity=".7"/><text x="0" y="${y(estMin) + 3}">${estMin}'</text></svg>
  <div class="legend"><span><i style="background:#FFD400"></i>Nhanh hơn / đúng ước lượng</span><span><i style="background:#fff"></i>Chậm hơn</span><span>- - Ước lượng của bạn</span></div>`;
}
function taskStats(t) {
  const rs = runsOfTask(t.id);
  if (!rs.length) return '<div class="empty">Chưa có lần làm nào.<br>Làm xong lần đầu, số liệu sẽ hiện ở đây.</div>';
  const est = t.est * MIN, tot = rs.map(r => r.total), pur = rs.map(r => r.pure);
  const l5 = rs.slice(0, 5), diff = avg(l5.map(r => r.total - est));
  let say = diff <= 0 ? `${l5.length} lần gần nhất, bạn nhanh hơn ước lượng trung bình ${fm(-diff)}.` : `${l5.length} lần gần nhất, bạn chậm hơn ước lượng trung bình ${fm(diff)}.`;
  if (rs.length >= 6) {
    const a = med(rs.slice(0, 3).map(r => r.total)), b = med(rs.slice(3, 6).map(r => r.total));
    say += a < b * 0.9 ? ' Xu hướng: đang nhanh dần.' : a > b * 1.1 ? ' Xu hướng: đang chậm lại một chút.' : ' Xu hướng: khá ổn định.';
  }
  const ints = rs.flatMap(r => r.ints), im = sum(ints.map(i => i.ms)), by = {};
  ints.forEach(i => { by[i.reason] = (by[i.reason] || 0) + 1; });
  const topI = Object.entries(by).sort((a, b) => b[1] - a[1]);
  // bước trong checklist
  const sm = {}; rs.forEach(r => (r.steps || []).forEach(s => { (sm[s.t] = sm[s.t] || []).push(s.ms); }));
  const stepRows = Object.entries(sm).map(([k, v]) => [k, med(v)]).sort((a, b) => b[1] - a[1]);
  // khung giờ
  const bk = { 'Sáng (5–11h)': [], 'Chiều (11–17h)': [], 'Tối (17–22h)': [], 'Khuya (22–5h)': [] };
  rs.forEach(r => { const h = new Date(r.start).getHours(); bk[h >= 5 && h < 11 ? 'Sáng (5–11h)' : h >= 11 && h < 17 ? 'Chiều (11–17h)' : h >= 17 && h < 22 ? 'Tối (17–22h)' : 'Khuya (22–5h)'].push(r.total); });
  const bkr = Object.entries(bk).filter(([, v]) => v.length >= 2).map(([k, v]) => [k, med(v), v.length]).sort((a, b) => a[1] - b[1]);
  const lat = rs.filter(r => r.addedAt && r.start > r.addedAt).map(r => r.start - r.addedAt);
  const real = med(tot) / MIN, sugg = Math.round(real);
  return `<div class="say">${esc(say)}</div>
  <div class="big2"><div class="stat"><b>${rs.length}</b><span>lần đã làm</span></div><div class="stat"><b>${fm(med(tot))}</b><span>trung vị (tổng)</span></div>
  <div class="stat"><b>${fm(med(pur))}</b><span>trung vị (thuần)</span></div><div class="stat"><b>${fm(avg(tot))}</b><span>trung bình (tổng)</span></div>
  <div class="stat"><b>${fm(Math.min(...tot))}</b><span>nhanh nhất</span></div><div class="stat"><b>${fm(Math.max(...tot))}</b><span>chậm nhất</span></div></div>
  <div class="h3">Các lần gần nhất</div>${barChart(rs.slice(0, 12).reverse(), t.est)}
  <div class="sub" style="margin-top:6px">“Tổng” là từ lúc bắt đầu đến lúc xong. “Thuần” là đã trừ thời gian gián đoạn.</div>
  ${im ? `<div class="h3">Gián đoạn</div><div class="card"><div class="row sp"><span>Tổng thời gian bị gián đoạn</span><b>${fm(im)}</b></div>${topI.map(([k, n]) => `<div class="row sp sub" style="margin-top:6px"><span>${esc(k)}</span><span>${n} lần</span></div>`).join('')}</div>` : ''}
  ${stepRows.length ? `<div class="h3">Từng bước (trung vị)</div><div class="card">${stepRows.map(([k, v]) => `<div class="row sp" style="padding:4px 0"><span>${esc(k)}</span><b>${fm(v)}</b></div>`).join('')}</div>` : ''}
  ${bkr.length ? `<div class="h3">Khung giờ làm nhanh nhất</div><div class="card">${bkr.map(([k, v, n], i) => `<div class="row sp" style="padding:4px 0"><span>${k}${i === 0 ? ' ★' : ''}</span><b>${fm(v)} <span class="sub">(${n} lần)</span></b></div>`).join('')}</div>` : ''}
  ${lat.length ? `<div class="h3">Độ trễ khởi động</div><div class="card sub">Từ lúc bỏ vào giỏ đến lúc thật sự bắt đầu, thường mất <b style="color:#FFD400">${fmLong(med(lat) / MIN)}</b>${t.carried ? `. Việc này từng bị đẩy sang hôm sau ${t.carried} lần.` : '.'} Trong khi làm chỉ mất khoảng <b style="color:#FFD400">${fm(med(tot))}</b>.</div>` : (t.carried ? `<div class="h3">Độ trễ khởi động</div><div class="card sub">Việc này từng bị đẩy sang hôm sau ${t.carried} lần.</div>` : '')}
  ${rs.length >= 3 && sugg >= 1 && Math.abs(sugg - t.est) / t.est > 0.25 ? `<div class="card" style="border-color:#FFD400"><div style="margin-bottom:8px">Thực tế thường khoảng <b>${sugg} phút</b>, ước lượng của bạn là ${t.est}. Muốn đổi ước lượng không?</div><button class="btn y sm" data-a="applyEst" data-id="${t.id}" data-v="${sugg}">Đổi thành ${sugg} phút</button></div>` : ''}`;
}
A.applyEst = d => { const t = T(d.id); t.est = Math.max(1, +d.v); save(); refresh(); toast('Đã đổi ước lượng'); };

/* ---------- THỐNG KÊ TỔNG HỢP (hôm nay / 7 ngày / 1 tháng / tag) ---------- */
function statsBlock(runs, prev, days, title) {
  if (!runs.length) return '<div class="empty">Chưa có lần làm nào trong khoảng này.</div>';
  const tot = sum(runs.map(r => r.total)), estT = sum(runs.map(r => r.est * MIN)), pureT = sum(runs.map(r => r.pure));
  const d = estT - tot;
  const say = d >= 0 ? `Tổng cộng bạn nhanh hơn ước lượng ${fm(d)}.` : `Tổng cộng bạn chậm hơn ước lượng ${fm(-d)}.`;
  const ints = runs.flatMap(r => r.ints), im = sum(ints.map(i => i.ms)), by = {};
  ints.forEach(i => { by[i.reason] = (by[i.reason] || { n: 0, ms: 0 }); by[i.reason].n++; by[i.reason].ms += i.ms; });
  const topI = Object.entries(by).sort((a, b) => b[1].ms - a[1].ms);
  const ok = runs.filter(r => r.est > 0 && Math.abs(r.total - r.est * MIN) <= r.est * MIN * 0.2).length;
  const faster = runs.filter(r => r.total <= r.est * MIN).length;
  const lat = runs.filter(r => r.addedAt && r.start > r.addedAt).map(r => r.start - r.addedAt);
  const byTask = {}; runs.forEach(r => { const k = r.taskId; (byTask[k] = byTask[k] || { name: r.name, est: r.est, tot: [], n: 0, ms: 0 }); byTask[k].n++; byTask[k].ms += r.total; byTask[k].tot.push(r.total); });
  const top = Object.values(byTask).sort((a, b) => b.ms - a.ms).slice(0, 5);
  const dev = Object.values(byTask).map(x => ({ n: x.name, d: med(x.tot) - x.est * MIN })).filter(x => Math.abs(x.d) >= 60000).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  let cmp = '';
  if (prev && prev.length) { const pt = sum(prev.map(r => r.total)), pc = Math.round((tot - pt) / pt * 100); cmp = `<div class="sub" style="margin-top:2px">${pc >= 0 ? '+' : ''}${pc}% thời gian làm so với kỳ trước (${fm(pt)})</div>`; }
  let chart = '';
  if (days === 1) chart = timeline(runs);
  else if (days === 7) chart = dayBars(runs, 7);
  else if (days === 30) chart = dayBars(runs, 30) + heat(runs);
  return `<div class="say">${esc(say)}${cmp}</div>
  <div class="big2"><div class="stat"><b>${runs.length}</b><span>việc đã xong</span></div><div class="stat"><b>${fm(tot)}</b><span>tổng thời gian làm</span></div>
  <div class="stat"><b>${fm(estT)}</b><span>tổng ước lượng</span></div><div class="stat"><b>${fm(pureT)}</b><span>thời gian thuần</span></div>
  <div class="stat"><b>${Math.round(faster / runs.length * 100)}%</b><span>việc xong trong ước lượng</span></div><div class="stat"><b>${Math.round(ok / runs.length * 100)}%</b><span>ước lượng chuẩn (lệch ≤20%)</span></div></div>
  ${chart}
  ${topI.length ? `<div class="h3">Gián đoạn · ${fm(im)}</div><div class="card">${topI.map(([k, v]) => `<div class="row sp" style="padding:4px 0"><span>${esc(k)}</span><span class="sub">${v.n} lần · ${fm(v.ms)}</span></div>`).join('')}</div>` : ''}
  <div class="h3">Việc tốn nhiều thời gian nhất</div><div class="card">${top.map(x => `<div class="row sp" style="padding:4px 0"><span>${esc(x.name)} <span class="sub">×${x.n}</span></span><b>${fm(x.ms)}</b></div>`).join('')}</div>
  ${dev.length ? `<div class="h3">Ước lượng lệch nhiều nhất</div><div class="card">${dev.map(x => `<div class="row sp" style="padding:4px 0"><span>${esc(x.n)}</span><span class="sub">${x.d > 0 ? 'thường chậm hơn' : 'thường nhanh hơn'} <b style="color:#FFD400">${fm(Math.abs(x.d))}</b></span></div>`).join('')}</div>` : ''}
  ${lat.length ? `<div class="h3">Độ trễ khởi động</div><div class="card sub">Từ lúc bỏ vào giỏ đến lúc bắt đầu, thường mất <b style="color:#FFD400">${fmLong(med(lat) / MIN)}</b>.</div>` : ''}`;
}
function timeline(runs) {
  const s0 = startOfDay(Date.now()), seg = [];
  runs.forEach(r => {
    const x = (r.start - s0) / DAY * 100, w = Math.max(0.6, (r.end - r.start) / DAY * 100);
    seg.push(`<i style="left:${x}%;width:${w}%;background:#FFD400" title="${esc(r.name)}"></i>`);
    r.ints.forEach(i => seg.push(`<i style="left:${(i.start - s0) / DAY * 100}%;width:${Math.max(0.4, i.ms / DAY * 100)}%;background:#fff"></i>`));
  });
  return `<div class="h3">Ngày của bạn</div><div class="tl">${seg.join('')}</div><div class="row sp sub" style="margin-top:4px"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div><div class="legend"><span><i style="background:#FFD400"></i>Đang làm</span><span><i style="background:#fff"></i>Bị gián đoạn</span></div>`;
}
function dayBars(runs, n) {
  const s0 = startOfDay(Date.now()) - (n - 1) * DAY, W = 320, H = 150, pl = 4, pb = 20, pt = 10;
  const act = Array(n).fill(0), est = Array(n).fill(0);
  runs.forEach(r => { const i = Math.floor((startOfDay(r.end) - s0) / DAY); if (i >= 0 && i < n) { act[i] += r.total / MIN; est[i] += r.est; } });
  const mx = Math.max(1, ...act, ...est) * 1.15, bw = (W - pl) / n, y = v => pt + (H - pt - pb) * (1 - v / mx);
  const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const bars = act.map((v, i) => {
    const x = pl + i * bw, d = new Date(s0 + i * DAY), w = n === 7 ? bw * 0.36 : bw * 0.7;
    let s = '';
    if (n === 7) s += `<rect x="${x + bw * 0.08}" y="${y(est[i])}" width="${w}" height="${Math.max(0, H - pb - y(est[i]))}" rx="3" fill="none" stroke="#fff" stroke-width="1.5"/><rect x="${x + bw * 0.08 + w + 2}" y="${y(v)}" width="${w}" height="${Math.max(0, H - pb - y(v))}" rx="3" fill="#FFD400"/>`;
    else s += `<rect x="${x + bw * 0.15}" y="${y(v)}" width="${w}" height="${Math.max(0, H - pb - y(v))}" rx="2" fill="#FFD400"/>`;
    if (n === 7) s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${wd[d.getDay()]}</text>`;
    else if (i % 5 === 0 || i === n - 1) s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${d.getDate()}/${d.getMonth() + 1}</text>`;
    return s;
  }).join('');
  return `<div class="h3">Phút làm mỗi ngày</div><svg viewBox="0 0 ${W} ${H}" width="100%">${bars}</svg><div class="legend">${n === 7 ? '<span><i style="background:none;border:1.5px solid #fff"></i>Ước lượng</span>' : ''}<span><i style="background:#FFD400"></i>Thực tế</span></div>`;
}
function heat(runs) {
  const n = 35, s0 = startOfDay(Date.now()) - (n - 1) * DAY, act = Array(n).fill(0);
  runs.forEach(r => { const i = Math.floor((startOfDay(r.end) - s0) / DAY); if (i >= 0 && i < n) act[i] += r.total / MIN; });
  const mx = Math.max(1, ...act);
  return `<div class="h3">Lịch hoạt động</div><div class="hm">${act.map((v, i) => `<div style="${v ? `background:rgba(255,212,0,${0.2 + 0.8 * v / mx});color:#000` : ''}">${new Date(s0 + i * DAY).getDate()}</div>`).join('')}</div>`;
}
function runsBetween(from, to, pred) { return S.runs.filter(r => r.end >= from && r.end < to && (!pred || pred(r))); }
function periodRuns(p, pred) {
  const now = Date.now(), t0 = startOfDay(now), end = now + 1;
  if (p === 'today') return [runsBetween(t0, end, pred), runsBetween(t0 - DAY, t0, pred), 1];
  if (p === '7') return [runsBetween(t0 - 6 * DAY, end, pred), runsBetween(t0 - 13 * DAY, t0 - 6 * DAY, pred), 7];
  if (p === '30') return [runsBetween(t0 - 29 * DAY, end, pred), runsBetween(t0 - 59 * DAY, t0 - 29 * DAY, pred), 30];
  return [S.runs.filter(r => !pred || pred(r)), [], 0];
}
function vStats() {
  const [r, p, d] = periodRuns(ui.statPeriod);
  return `<div class="top"><h1>Thống kê</h1></div>${seg([['today', 'Hôm nay'], ['7', '7 ngày'], ['30', '1 tháng']], ui.statPeriod, 'statP')}${statsBlock(r, p, d)}`;
}
A.statP = d => { ui.statPeriod = d.k; render(); };

/* ---------- THẺ (TAG) ---------- */
function vTags() { return ui.tag ? vTagDetail() : vTagList(); }
function vTagList() {
  return `<div class="top"><h1>Tag</h1></div>
  ${S.tags.map(g => { const ts = S.tasks.filter(t => t.tag === g && !t.done), dn = S.tasks.filter(t => t.tag === g && t.done).length; return `<div class="trow" data-a="tagOpen" data-g="${esc(g)}"><span class="ico y">#</span><div class="grow"><div class="nm">${esc(g)}</div><div class="meta">${ts.length} việc${dn ? ` · ${dn} đã xong` : ''}</div></div><span style="color:#9b9b9b">›</span></div>`; }).join('')}
  <div class="row" style="margin-top:12px"><input id="newtag" placeholder="Tên tag mới" data-a="noop"><button class="btn y" data-a="tagAdd">Thêm</button></div>`;
}
A.tagAdd = () => { const i = $('#newtag'), v = i && i.value.trim().replace(/^#/, ''); if (!v) return; if (S.tags.some(g => g.toLowerCase() === v.toLowerCase())) { toast('Tag này đã có'); return; } S.tags.push(v); save(); render(); };
let tagEntry = null;
A.tagOpen = d => {
  ui.tag = d.g; ui.tagMode = 'list'; render(); $('#main').scrollTop = 0;
  tagEntry = pushEntry(null, () => { ui.tag = null; tagEntry = null; render(); });
};
A.tagBack = () => { if (tagEntry) closeEntry(tagEntry); else { ui.tag = null; render(); } };
A.tagMode = d => { ui.tagMode = d.k; render(); };
A.tagPeriod = d => { ui.tagPeriod = d.k; render(); };
A.tagDel = () => { if (S.tasks.some(t => t.tag === ui.tag)) { toast('Tag còn việc, chuyển hoặc xóa việc trước'); return; } S.tags = S.tags.filter(g => g !== ui.tag); save(); A.tagBack(); };

function vTagDetail() {
  const g = ui.tag, m = ui.tagMode;
  const head = `<div class="top"><div class="row"><button class="x" data-a="tagBack">‹</button><h1>#${esc(g)}</h1></div></div>
  <div class="seg">${[['list', 'Việc'], ['bins', 'Phút'], ['bingo', 'Bingo'], ['done', 'Đã xong'], ['stats', 'Số liệu']].map(([k, l]) => `<button class="${m === k ? 'on' : ''}" data-a="tagMode" data-k="${k}" style="font-size:13px">${l}</button>`).join('')}</div>`;
  const open = S.tasks.filter(t => t.tag === g && !t.done);
  let body = '';
  if (m === 'list') body = (open.length ? open.sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(t => trow(t, { add: true, meta: t.type === 'fixed' ? 'cố định' : 'nhanh' })).join('') : '<div class="empty">Tag này chưa có việc.</div>') + `<button class="btn full" data-a="newInTag" style="margin-top:6px">＋ Thêm việc vào #${esc(g)}</button>` + (!S.tasks.some(t => t.tag === g) ? `<button class="lnk" data-a="tagDel">Xóa tag này</button>` : '');
  if (m === 'bins') {
    const bins = [1, 2, 5, 10, 15, 30, 60, 9999], groups = bins.map(() => []);
    open.forEach(t => { const i = bins.findIndex(b => t.est <= b); groups[i].push(t); });
    body = bins.map((b, i) => groups[i].length ? `<div class="h3">${b === 9999 ? 'Hơn 1 tiếng' : `Trong ${b} phút`} <span class="sub">(${groups[i].length})</span></div>${groups[i].map(t => trow(t, { add: true })).join('')}` : '').join('') || '<div class="empty">Chưa có việc để chia ngăn.</div>';
  }
  if (m === 'bingo') body = bingoView(g);
  if (m === 'done') { const dn = S.tasks.filter(t => t.tag === g && t.done).sort((a, b) => b.doneAt - a.doneAt); body = (dn.length ? `<div class="sub" style="margin-bottom:10px">Hộp lưu các việc nhanh đã xong, để bạn kiểm tra lại.</div>` + dn.map(t => { const r = runsOfTask(t.id)[0]; return trow(t, { cls: 'done', meta: new Date(t.doneAt).toLocaleDateString('vi-VN') + (r ? ' · mất ' + fm(r.total) : '') }); }).join('') : '<div class="empty">Chưa có việc nhanh nào hoàn thành trong tag này.</div>'); }
  if (m === 'stats') { const [r, p, d] = periodRuns(ui.tagPeriod, x => x.tag === g); body = seg([['7', '7 ngày'], ['30', '1 tháng'], ['all', 'Tất cả']], ui.tagPeriod, 'tagPeriod') + statsBlock(r, p, d); }
  return head + body;
}
A.newInTag = () => openEdit(null, ui.tag);

/* ---------- BINGO ---------- */
function bingoView(g) {
  const b = S.bingo[g];
  const sizes = `<div class="row" style="margin-bottom:10px">${[3, 4, 5].map(n => `<button class="btn sm ${b && b.n === n ? 'y' : ''}" data-a="bingoNew" data-n="${n}">Bàn ${n}×${n}</button>`).join('')}</div>`;
  if (!b) return `<div class="sub" style="margin-bottom:10px">Mỗi ô là một việc trong #${esc(g)}. Xong việc nào thì đánh dấu ô đó, đủ một hàng ngang, dọc hoặc chéo là BINGO.</div>${sizes}`;
  const lines = bingoLines(b), inLine = new Set(lines.flat());
  const cells = b.cells.map((id, i) => {
    const on = b.marks[i], cls = ['cell', on ? 'on' : '', id === 'FREE' ? 'free' : '', !id ? 'empty' : '', inLine.has(i) ? 'line' : ''].join(' ');
    if (id === 'FREE') return `<div class="${cls}" data-a="bingoCell" data-i="${i}"><b>FREE</b><small>ô tặng</small></div>`;
    const t = id && T(id);
    if (!t) return `<div class="${cls}" data-a="bingoPick" data-i="${i}">+</div>`;
    return `<div class="${cls}" data-a="bingoCell" data-i="${i}"><span>${esc(t.name)}</span><small>${t.est}'</small><span class="go" data-a="bingoGo" data-id="${t.id}">▶</span></div>`;
  }).join('');
  return `${sizes}<div class="bingo" style="grid-template-columns:repeat(${b.n},1fr)">${cells}</div>
  <div class="row sp"><b style="color:#FFD400">${lines.length} dòng BINGO</b><span class="sub">${b.marks.filter(Boolean).length - (b.n % 2 ? 1 : 0)} ô đã xong</span></div>
  <div class="sub" style="margin-top:8px">Chạm ô để đánh dấu hoặc bỏ đánh dấu. Chạm ▶ để mở việc đó. Ô “+” để chọn việc.</div>`;
}
A.bingoNew = d => { bingoNew(ui.tag, +d.n); render(); };
A.bingoCell = d => {
  const b = S.bingo[ui.tag], i = +d.i; if (b.cells[i] === 'FREE') return;
  const add = bingoSet(ui.tag, i, !b.marks[i]); render();
  if (b.marks[i]) { sfx.tick(); vib(20); }
  if (add) { sfx.bingo(); vib([60, 40, 60, 40, 120]); toast('🎉 BINGO!'); }
};
A.bingoGo = (d, el, e) => { e.stopPropagation(); A.openTask({ id: d.id }); };
A.bingoPick = d => {
  const b = S.bingo[ui.tag], i = +d.i;
  ui.pick = { q: '', title: 'Chọn việc cho ô này', filter: t => !t.done && t.tag === ui.tag && !b.cells.includes(t.id), onPick: id => { b.cells[i] = id; save(); closeSheet('pick'); render(); } };
  openSheet('pick', drawPick);
};

/* ---------- CHỌN VIỆC TỪ THƯ VIỆN ---------- */
function drawPick() {
  const p = ui.pick, q = (p.q || '').toLowerCase();
  const ts = S.tasks.filter(t => p.filter(t) && (!q || t.name.toLowerCase().includes(q)));
  return `<div class="hd"><h2>${esc(p.title)}</h2><button class="x" data-a="close" data-n="pick">✕</button></div>
  <input id="pickq" placeholder="Tìm…" value="${esc(p.q || '')}" data-a="noop" style="margin-bottom:10px">
  <div id="picklist">${pickList(ts)}</div>`;
}
const pickList = ts => ts.length ? ts.map(t => `<div class="trow" data-a="pickDo" data-id="${t.id}"><span class="ico ${t.type === 'fixed' ? 'y' : ''}">${t.type === 'fixed' ? '↻' : '⚡'}</span><div class="grow"><div class="nm">${esc(t.name)}</div><div class="meta">#${esc(t.tag)}</div></div><span class="est">${t.est}'</span></div>`).join('') : '<div class="empty">Không có việc phù hợp.</div>';
document.addEventListener('input', e => { if (e.target.id === 'pickq' && ui.pick) { ui.pick.q = e.target.value; const q = e.target.value.toLowerCase(); $('#picklist').innerHTML = pickList(S.tasks.filter(t => ui.pick.filter(t) && (!q || t.name.toLowerCase().includes(q)))); } });
A.pickDo = d => ui.pick.onPick(d.id);
A.pickFromLib = () => { ui.pick = { q: '', title: 'Thêm vào giỏ hôm nay', filter: t => !t.done, onPick: id => { addCart(id); refresh(); } }; openSheet('pick', drawPick); };

/* ---------- GIỎ HÀNG → THANH TOÁN ---------- */
function openCheckout() {
  const ids = S.cart.filter(c => !c.done && c.on && T(c.id)).map(c => c.id);
  if (!ids.length) { toast('Chưa tick việc nào'); return; }
  ui.co = { order: ids, mode: 'now', time: clock(Date.now() + 60 * MIN), brk: 0, basis: 'est' };
  openSheet('co', drawCo);
}
A.checkout = openCheckout;
const coVal = id => { const t = T(id); if (ui.co.basis === 'real') { const rs = runsOfTask(id).slice(0, 5); if (rs.length) return Math.round(med(rs.map(r => r.total)) / MIN * 10) / 10; } return t.est; };
function coCalc() {
  const c = ui.co, n = c.order.length, total = sum(c.order.map(coVal)) + c.brk * Math.max(0, n - 1), now = Date.now();
  const [h, m] = (c.time || '00:00').split(':').map(Number), d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
  let start = now, end;
  if (c.mode === 'start') start = d.getTime();
  if (c.mode === 'end') { end = d.getTime(); start = end - total * MIN; } else end = start + total * MIN;
  return { total, start, end, n };
}
function drawCo() {
  const c = ui.co, k = coCalc(), late = c.mode === 'end' && k.start < Date.now();
  return `<div class="hd"><div><div class="tg">THANH TOÁN</div><h2>${k.n} việc · ${fmLong(k.total)}</h2></div><button class="x" data-a="close" data-n="co">✕</button></div>
  ${c.order.map((id, i) => `<div class="trow"><div class="grow"><div class="nm">${i + 1}. ${esc(T(id).name)}</div></div><span class="est">${coVal(id)}'</span><button class="x" data-a="coUp" data-i="${i}" ${i ? '' : 'disabled style="opacity:.3"'}>↑</button><button class="x" data-a="coDown" data-i="${i}" ${i < c.order.length - 1 ? '' : 'disabled style="opacity:.3"'}>↓</button></div>`).join('')}
  <div class="lbl">Khi nào làm?</div>
  <div class="chips"><span class="chip ${c.mode === 'now' ? 'on' : ''}" data-a="coMode" data-k="now">Làm ngay bây giờ</span><span class="chip ${c.mode === 'start' ? 'on' : ''}" data-a="coMode" data-k="start">Bắt đầu lúc…</span><span class="chip ${c.mode === 'end' ? 'on' : ''}" data-a="coMode" data-k="end">Phải xong trước…</span></div>
  ${c.mode !== 'now' ? `<input type="time" value="${c.time}" data-ch="coTime" style="margin-bottom:10px">` : ''}
  <div class="lbl">Nghỉ giữa các việc</div><div class="chips">${[0, 5, 10].map(b => `<span class="chip ${c.brk === b ? 'on' : ''}" data-a="coBrk" data-k="${b}">${b ? b + ' phút' : 'Không nghỉ'}</span>`).join('')}</div>
  <div class="lbl">Tính thời gian theo</div><div class="chips"><span class="chip ${c.basis === 'est' ? 'on' : ''}" data-a="coBasis" data-k="est">Ước lượng của tôi</span><span class="chip ${c.basis === 'real' ? 'on' : ''}" data-a="coBasis" data-k="real">Thực tế gần đây</span></div>
  <div class="card" style="border-color:#FFD400;margin-top:12px"><div class="row sp"><span>Bắt đầu</span><b style="font-size:20px">${clock(k.start)}</b></div><div class="row sp" style="margin-top:6px"><span>Dự kiến xong</span><b style="font-size:20px;color:#FFD400">${clock(k.end)}</b></div>${late ? '<div class="sub" style="margin-top:8px">Giờ bắt đầu muộn nhất đã qua rồi. Bắt đầu ngay là cách tốt nhất.</div>' : (c.mode === 'end' ? `<div class="sub" style="margin-top:8px">Bắt đầu muộn nhất lúc ${clock(k.start)}</div>` : '')}</div>
  ${holdBtn('coStart', 'Giữ 5 giây để BẮT ĐẦU')}`;
}
A.coUp = d => { const o = ui.co.order, i = +d.i; if (i > 0) { [o[i - 1], o[i]] = [o[i], o[i - 1]]; sheets.co._draw(); } };
A.coDown = d => { const o = ui.co.order, i = +d.i; if (i < o.length - 1) { [o[i + 1], o[i]] = [o[i], o[i + 1]]; sheets.co._draw(); } };
A.coMode = d => { ui.co.mode = d.k; sheets.co._draw(); };
A.coBrk = d => { ui.co.brk = +d.k; sheets.co._draw(); };
A.coBasis = d => { ui.co.basis = d.k; sheets.co._draw(); };
CH.coTime = el => { ui.co.time = el.value; sheets.co._draw(); };
HOLD.coStart = () => { const q = ui.co.order.slice(); closeSheet('co'); setTimeout(() => startFlow(q[0], q), 60); };

/* ---------- VÒNG QUAY CHỌN GIÙM ---------- */
A.randOpen = () => openSheet('rand', drawRand);
function randPool() {
  const r = ui.rand, t0 = startOfDay(Date.now());
  return S.tasks.filter(t => !t.done && r.tags.includes(t.tag) && t.est <= r.min && !(r.skipDone && S.runs.some(x => x.taskId === t.id && x.end >= t0)));
}
function drawRand() {
  const r = ui.rand, n = randPool().length;
  return `<div class="hd"><h2>🎲 Chọn giùm tôi</h2><button class="x" data-a="close" data-n="rand">✕</button></div>
  <div class="lbl">Tôi có bao nhiêu phút?</div><div class="chips">${[1, 2, 5, 10, 15, 30, 60].map(m => `<span class="chip ${r.min === m ? 'on' : ''}" data-a="randMin" data-m="${m}">${m}'</span>`).join('')}</div>
  <div class="lbl">Bốc trong tag nào?</div><div class="chips">${S.tags.map(g => `<span class="chip ${r.tags.includes(g) ? 'on' : ''}" data-a="randTag" data-g="${esc(g)}">#${esc(g)}</span>`).join('')}</div>
  <label class="row" style="margin:6px 0"><input type="checkbox" data-ch="randSkip" ${r.skipDone ? 'checked' : ''}><span class="sub">Bỏ qua việc đã làm hôm nay</span></label>
  <div class="wheel" id="wheel">${r.res ? esc(r.res.name) : '?'}</div>
  ${r.res ? `<div class="sub" style="text-align:center;margin-bottom:10px">#${esc(r.res.tag)} · ước lượng ${r.res.est}'</div>` : ''}
  ${r.msg ? `<div class="sub" style="text-align:center;margin-bottom:10px">${esc(r.msg)}</div>` : (r.tags.length ? `<div class="sub" style="text-align:center;margin-bottom:10px">${n} việc phù hợp</div>` : '<div class="sub" style="text-align:center;margin-bottom:10px">Chọn ít nhất một tag</div>')}
  <button class="btn y full" data-a="randSpin" ${r.tags.length ? '' : 'disabled'}>${r.res ? 'Quay lại' : 'QUAY'}</button>
  ${r.res ? `<div class="row" style="margin-top:8px"><button class="btn full" data-a="randGo">Làm ngay</button><button class="btn full" data-a="randCart">+ Giỏ hôm nay</button></div>` : ''}`;
}
A.randMin = d => { ui.rand.min = +d.m; ui.rand.res = null; ui.rand.msg = ''; sheets.rand._draw(); };
A.randTag = d => { const t = ui.rand.tags, i = t.indexOf(d.g); if (i >= 0) t.splice(i, 1); else t.push(d.g); ui.rand.res = null; ui.rand.msg = ''; sheets.rand._draw(); };
CH.randSkip = el => { ui.rand.skipDone = el.checked; ui.rand.res = null; sheets.rand._draw(); };
A.randSpin = () => {
  const r = ui.rand, pool = randPool();
  if (!pool.length) { r.res = null; r.msg = `Không có việc nào ≤ ${r.min} phút trong các tag này.`; sheets.rand._draw(); return; }
  r.msg = ''; let i = 0, delay = 60; const win = pool[Math.floor(Math.random() * pool.length)], steps = 18 + Math.floor(Math.random() * 6);
  const w = $('#wheel'); if (w) w.style.opacity = '.7';
  (function go() {
    const wh = $('#wheel'); if (!wh) return;
    if (i >= steps) { r.res = win; wh.style.opacity = '1'; sfx.win(); vib([40, 30, 80]); sheets.rand._draw(); return; }
    wh.textContent = pool[i % pool.length].name; sfx.tick(); i++; delay *= 1.1; setTimeout(go, delay);
  })();
};
A.randGo = () => { const id = ui.rand.res.id; closeSheet('rand'); setTimeout(() => startFlow(id, [id]), 60); };
A.randCart = () => { addCart(ui.rand.res.id); refresh(); };

/* ---------- THÊM / SỬA VIỆC ---------- */
function openEdit(id, tag) {
  const t = id ? T(id) : null;
  ui.edit = t ? JSON.parse(JSON.stringify(t)) : { id: null, name: '', tag: tag || ui.libTag || S.lastTag || S.tags[0], type: 'quick', est: 10, actionSec: 30, leadIn: '', steps: [] };
  ui.delArm = 0; openSheet('edit', drawEdit);
}
function drawEdit() {
  const e = ui.edit;
  return `<div class="hd"><h2>${e.id ? 'Sửa việc' : 'Việc mới'}</h2><button class="x" data-a="close" data-n="edit">✕</button></div>
  <div class="lbl">Tên việc</div><input name="name" value="${esc(e.name)}" placeholder="Ví dụ: Đi tắm" data-a="noop">
  <div class="lbl">Loại việc</div>
  <div class="seg"><button class="${e.type === 'fixed' ? 'on' : ''}" data-a="editType" data-k="fixed">↻ Cố định (lặp lại)</button><button class="${e.type === 'quick' ? 'on' : ''}" data-a="editType" data-k="quick">⚡ Nhanh (việc lẻ)</button></div>
  <div class="lbl">Tag</div><select name="tag">${S.tags.map(g => `<option ${g === e.tag ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
  <input name="newtag" placeholder="Hoặc tạo tag mới" style="margin-top:8px" data-a="noop">
  <div class="two"><div><div class="lbl">Ước lượng (phút)</div><input name="est" type="number" min="1" inputmode="numeric" value="${e.est}"></div><div><div class="lbl">Hành động (giây)</div><input name="act" type="number" min="5" inputmode="numeric" value="${e.actionSec}"></div></div>
  <div class="lbl">Việc dẫn đến (việc nhỏ nhất để kích hoạt)</div><input name="lead" value="${esc(e.leadIn)}" placeholder="Ví dụ: Lấy quần áo" data-a="noop">
  <div class="lbl">Việc nhỏ trong checklist</div>
  ${e.steps.map((s, i) => `<div class="row stp" style="margin-bottom:8px"><input name="st" value="${esc(s.t)}" placeholder="Bước ${i + 1}"><input name="sm" type="number" min="0" inputmode="numeric" value="${s.m}" style="width:76px"><button class="x" data-a="stepDel" data-i="${i}">✕</button></div>`).join('')}
  <button class="btn sm" data-a="stepAdd">+ Thêm việc nhỏ</button>
  <button class="btn y big" style="margin-top:16px" data-a="editSave">Lưu</button>
  ${e.id ? `<button class="lnk" data-a="editDel" style="display:block;margin:8px auto 0">${ui.delArm ? 'Bấm lần nữa để xóa hẳn' : 'Xóa việc này'}</button>` : ''}`;
}
function readEdit() {
  const sh = sheets.edit; if (!sh) return; const e = ui.edit, g = n => $(`[name=${n}]`, sh);
  e.name = g('name').value; e.est = Math.max(1, Math.round(+g('est').value) || 1); e.actionSec = Math.max(5, Math.round(+g('act').value) || 30);
  e.leadIn = g('lead').value; e.tag = g('tag').value; e._newtag = g('newtag').value.trim().replace(/^#/, '');
  e.steps = $$('.stp', sh).map(r => ({ t: $('[name=st]', r).value, m: Math.max(0, Math.round(+$('[name=sm]', r).value) || 0) }));
}
A.editType = d => { readEdit(); ui.edit.type = d.k; sheets.edit._draw(); };
A.stepAdd = () => { readEdit(); ui.edit.steps.push({ t: '', m: 1 }); sheets.edit._draw(); const r = $$('.stp [name=st]', sheets.edit); if (r.length) r[r.length - 1].focus(); };
A.stepDel = d => { readEdit(); ui.edit.steps.splice(+d.i, 1); sheets.edit._draw(); };
A.editSave = () => {
  readEdit(); const e = ui.edit;
  if (!e.name.trim()) { toast('Nhập tên việc trước nhé'); return; }
  if (e._newtag) { if (!S.tags.some(g => g.toLowerCase() === e._newtag.toLowerCase())) S.tags.push(e._newtag); e.tag = S.tags.find(g => g.toLowerCase() === e._newtag.toLowerCase()); }
  const data = { name: e.name.trim(), tag: e.tag, type: e.type, est: e.est, actionSec: e.actionSec, leadIn: e.leadIn.trim(), steps: e.steps.filter(s => s.t.trim()).map(s => ({ t: s.t.trim(), m: s.m })) };
  if (e.id) Object.assign(T(e.id), data); else { const t = Object.assign({ id: uid(), created: Date.now() }, data); S.tasks.push(t); }
  S.lastTag = data.tag; save(); closeSheet('edit'); refresh(); toast('Đã lưu');
};
A.editDel = () => {
  if (!ui.delArm) { ui.delArm = 1; sheets.edit._draw(); return; }
  const id = ui.edit.id; S.tasks = S.tasks.filter(t => t.id !== id); S.cart = S.cart.filter(c => c.id !== id);
  Object.values(S.bingo).forEach(b => b.cells.forEach((c, i) => { if (c === id) { b.cells[i] = null; b.marks[i] = false; } }));
  save(); closeSheet('edit'); closeSheet('task'); refresh(); toast('Đã xóa');
};

/* ---------- THÊM (cài đặt, dữ liệu) ---------- */
function vMore() {
  const s = S.settings;
  return `<div class="top"><h1>Thêm</h1></div>
  <div class="row" style="margin-bottom:12px"><button class="btn full" data-a="randOpen">🎲 Chọn giùm tôi</button><button class="btn full" data-a="ideaOpen">💡 Bãi ý tưởng${S.ideas.length ? ` (${S.ideas.length})` : ''}</button></div>
  <button class="btn full" data-a="dumpOpen" style="margin-bottom:16px">🧠 Xả não 2 phút</button>
  <div class="h3">Khi bắt đầu một việc (giữ 5 giây)</div>
  <div class="seg"><button class="${s.hold === 'A' ? 'on' : ''}" data-a="setHold" data-k="A">A · Có việc dẫn đến</button><button class="${s.hold === 'B' ? 'on' : ''}" data-a="setHold" data-k="B">B · Vào việc luôn</button></div>
  <div class="sub" style="margin-bottom:14px">${s.hold === 'A' ? 'Giữ 5 giây, đếm 3-2-1, hiện việc dẫn đến và đếm hành động (30 giây), rồi tự vào việc chính.' : 'Giữ 5 giây, đếm 3-2-1, bắt đầu bấm giờ việc chính ngay. Việc dẫn đến hiện ở đầu màn hình làm.'}</div>
  <div class="h3">Hiển thị đồng hồ</div>
  <div class="seg"><button class="${!s.ring ? 'on' : ''}" data-a="setRing" data-k="0">Hiện số</button><button class="${s.ring ? 'on' : ''}" data-a="setRing" data-k="1">Vòng tròn (ẩn số)</button></div>
  <label class="trow"><input type="checkbox" data-ch="setSound" ${s.sound ? 'checked' : ''}><span class="grow">Âm thanh</span></label>
  <label class="trow"><input type="checkbox" data-ch="setVib" ${s.vib ? 'checked' : ''}><span class="grow">Rung nhẹ (mốc 50%, 100%…)</span></label>
  <div class="h3">Dữ liệu</div>
  <div class="row"><button class="btn full" data-a="exportData">Xuất sao lưu</button><button class="btn full" data-a="importOpen">Nhập sao lưu</button></div>
  <div class="sub" style="margin-top:10px">Dữ liệu lưu ngay trên máy này, không cần mạng. Nên xuất sao lưu thỉnh thoảng.</div>
  <div class="sub" style="margin-top:6px">Đã ghi ${S.runs.length} lần làm · ${S.tasks.length} việc · ${S.tags.length} tag.</div>`;
}
A.setHold = d => { S.settings.hold = d.k; save(); render(); };
A.setRing = d => { S.settings.ring = d.k === '1'; save(); render(); };
CH.setSound = el => { S.settings.sound = el.checked; save(); if (el.checked) sfx.tick(); };
CH.setVib = el => { S.settings.vib = el.checked; save(); if (el.checked) vib(40); };
A.exportData = () => {
  const json = JSON.stringify(S);
  openSheet('exp', () => `<div class="hd"><h2>Sao lưu</h2><button class="x" data-a="close" data-n="exp">✕</button></div>
  <div class="sub" style="margin-bottom:8px">Bấm “Tải file” hoặc sao chép đoạn văn bản dưới đây cất đi.</div>
  <textarea id="expta" style="min-height:160px" readonly>${esc(json)}</textarea>
  <div class="row" style="margin-top:10px"><button class="btn y full" data-a="expDl">Tải file</button><button class="btn full" data-a="expCopy">Sao chép</button></div>`);
};
A.expDl = () => {
  try { const b = new Blob([JSON.stringify(S)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'adhd-bao-lau-' + dayKey(Date.now()) + '.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Đã tải file'); } catch (e) { toast('Không tải được, hãy dùng Sao chép'); }
};
A.expCopy = () => { const t = $('#expta'); t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast('Đã sao chép'), () => { document.execCommand('copy'); toast('Đã sao chép'); }); } catch (e) { try { document.execCommand('copy'); toast('Đã sao chép'); } catch (x) { toast('Hãy tự chọn và sao chép'); } } };
A.importOpen = () => openSheet('imp', () => `<div class="hd"><h2>Nhập sao lưu</h2><button class="x" data-a="close" data-n="imp">✕</button></div>
  <div class="sub" style="margin-bottom:8px">Dán nội dung sao lưu vào đây. Dữ liệu hiện tại sẽ bị thay thế.</div>
  <textarea id="impta" style="min-height:160px"></textarea><button class="btn y full" style="margin-top:10px" data-a="impDo">Nhập</button>`);
A.impDo = () => {
  try { const d = JSON.parse($('#impta').value); if (!Array.isArray(d.tasks) || !Array.isArray(d.runs)) throw new Error('sai định dạng'); S = Object.assign(defaults(), d); S.active = null; saveNow(); closeSheet('imp'); refresh(); toast('Đã nhập xong'); } catch (e) { toast('Không đọc được: ' + e.message); }
};

/* ---------- khởi động ---------- */
function boot() {
  rollCart();
  if (S.active && !S.active.start) S.active = null;
  save(); render();
  if (S.active) showRun();
  try { if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { const d0 = S.cart.length; rollCart(); if (S.cart.length !== d0 || true) render(); } });
}
boot();
