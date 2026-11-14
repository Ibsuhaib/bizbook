'use strict';

/* =========================================================
   BizBook: promises, clients, measurements, quotes & bills
   Plain JavaScript. All data is kept in localStorage on the phone.
   ========================================================= */

const KEY = 'bizbook-v1';
const DEFAULTS = {
  settings: {
    bizName: 'My Business', owner: '', phone: '', address: '', taxId: '',
    currency: '₹', taxName: 'GST', taxPct: '18', cc: '91',
    terms: '50% advance to start work. Balance on completion.\nQuotation valid for 15 days.',
    qNo: 0, bNo: 0,
  },
  clients: [], promises: [], measures: [], docs: [],
};

let db = load();
let saveTimer = null;

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') {
      return { ...structuredClone(DEFAULTS), ...d, settings: { ...DEFAULTS.settings, ...d.settings } };
    }
  } catch (e) { /* fall through to defaults */ }
  return structuredClone(DEFAULTS);
}
function save() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Could not save. Phone storage may be full.'); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

/* ---------- small helpers ---------- */
const $ = (s) => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => r2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const money = (n) => db.settings.currency + ' ' + fmt(n);
const go = (h) => { location.hash = h; };

function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function parseDate(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
const today = () => ymd(new Date());
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
function nextWeekday(dow) { const d = new Date(); let diff = (dow - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); return ymd(d); }
function dayLabel(s) {
  if (!s) return '';
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, 1)) return 'Tomorrow';
  if (s === addDays(t, -1)) return 'Yesterday';
  return parseDate(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
const longDate = (s) => parseDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
function fmtTime(t) { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200);
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const slug = (s) => String(s || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';

/* ---------- motion: tap sparks, spotlight glow, count-up (react-bits-style feedback) ---------- */
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPARK_SEL = '.btn, .fab, .check, .chip, .quick button, .keys button, .icon-btn, .tabbar a, .stat, .seg button';
function spark(x, y, el) {
  if (reduceMotion()) return;
  let layer = document.querySelector('.spark-layer');
  if (!layer) { layer = document.createElement('div'); layer.className = 'spark-layer'; document.body.appendChild(layer); }
  const warm = el.classList.contains('danger') || el.classList.contains('late');
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--rot', (60 * i + Math.random() * 24 - 12) + 'deg');
    s.style.setProperty('--dist', (16 + Math.random() * 12) + 'px');
    if (warm) s.style.setProperty('--spk', 'var(--warn)');
    layer.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }
}
const SPOT_SEL = '.card, .stat, .quick button';
function litAt(el, x, y) {
  if (reduceMotion()) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', (x - r.left) + 'px');
  el.style.setProperty('--my', (y - r.top) + 'px');
  el.classList.add('lit');
  clearTimeout(el._litT);
  el._litT = setTimeout(() => el.classList.remove('lit'), 550);
}
/* Animates a number's text from 0 up to its target; formatter defaults to a plain integer. */
function animateNumber(el, to, formatter = (v) => String(Math.round(v))) {
  if (reduceMotion() || !(to > 0)) { el.textContent = formatter(to); return; }
  const dur = 650, start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatter(to * eased);
    if (p < 1) requestAnimationFrame(step); else el.textContent = formatter(to);
  }
  requestAnimationFrame(step);
}
function countUpIn(root) {
  root.querySelectorAll('[data-num]').forEach((el) => animateNumber(el, Number(el.dataset.num) || 0));
  root.querySelectorAll('[data-money]').forEach((el) => animateNumber(el, Number(el.dataset.money) || 0, money));
}
/* Stagger entrance: give each card/item/stat/quick-button a rising index so riseIn's delay fans out. */
function staggerIn(root) {
  root.querySelectorAll('.card, .item, .stat, .quick button').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 16)));
}

const ICON = {
  bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  tick: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  promise: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
  client: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/></svg>',
  ruler: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1"/><path d="M6 7v4M10 7v3M14 7v4M18 7v3"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  calc: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
};

/* ---------- clients ---------- */
const getClient = (id) => db.clients.find((c) => c.id === id);
const clientName = (id) => getClient(id)?.name || '';
function findOrCreateClient(name) {
  const n = String(name).trim();
  let c = db.clients.find((x) => x.name.trim().toLowerCase() === n.toLowerCase());
  if (!c) { c = { id: uid(), name: n, phone: '', address: '', notes: '', created: Date.now() }; db.clients.push(c); }
  return c;
}
const clientDatalist = () => `<datalist id="clientList">${db.clients.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>`;
function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = String(db.settings.cc || '').replace(/\D/g, '') + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/* ---------- promises ---------- */
const byDue = (a, b) => (a.due || '').localeCompare(b.due || '') || (a.time || '99').localeCompare(b.time || '99');
function promiseItem(p) {
  const late = !p.done && p.due && p.due < today();
  const sub = [p.clientId ? esc(clientName(p.clientId)) : '', dayLabel(p.due) + (p.time ? ' · ' + fmtTime(p.time) : '')].filter(Boolean).join(' · ');
  return `<div class="item ${p.done ? 'done' : ''} ${late ? 'late' : ''}">
    <button class="check" data-act="togglePromise" data-id="${p.id}" aria-label="Mark done">${ICON.tick}</button>
    <div class="grow" data-act="editPromise" data-id="${p.id}"><div class="t">${esc(p.title)}</div><div class="s">${sub}</div></div>
    ${p.done ? '' : `<button class="icon-btn" style="color:var(--brand)" data-act="remind" data-id="${p.id}" aria-label="Set alarm">${ICON.bell}</button>`}
  </div>`;
}
const promiseList = (list) => `<div class="card flush">${list.map(promiseItem).join('')}</div>`;

function promiseForm(id, preset = {}) {
  const p = db.promises.find((x) => x.id === id) || { due: today(), ...preset };
  const t = today();
  const chips = [['Today', t], ['Tomorrow', addDays(t, 1)], ['Next Mon', nextWeekday(1)], ['In 1 week', addDays(t, 7)], ['In 2 weeks', addDays(t, 14)]];
  openSheet(`<h2>${id ? 'Edit promise' : 'New promise'}</h2>
    <form id="f" autocomplete="off">
      <label>What did you promise?<input name="title" required value="${esc(p.title)}" placeholder="e.g. Send kitchen design"></label>
      <label>To which client?<input name="client" list="clientList" value="${esc(clientName(p.clientId))}" placeholder="Type a name (new names are saved)"></label>
      <label>By when?<input type="date" name="due" required value="${esc(p.due)}"></label>
      <div class="chips">${chips.map(([l, d]) => `<button type="button" class="chip ${d === p.due ? 'on' : ''}" data-act="setDue" data-d="${d}">${l}</button>`).join('')}</div>
      <label>Time (optional)<input type="time" name="time" value="${esc(p.time)}"></label>
      <label>Notes<textarea name="notes" rows="2">${esc(p.notes)}</textarea></label>
      ${clientDatalist()}
      <div class="row"><button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn primary">Save</button></div>
      ${id ? `<div class="row" style="margin-top:10px"><button type="button" class="btn danger" data-act="delPromise" data-id="${id}">${ICON.trash} Delete</button></div>` : ''}
    </form>`, (data) => {
    const rec = {
      title: data.title.trim(), due: data.due, time: data.time, notes: data.notes.trim(),
      clientId: data.client.trim() ? findOrCreateClient(data.client).id : null,
    };
    if (id) Object.assign(db.promises.find((x) => x.id === id), rec);
    else db.promises.push({ id: uid(), done: false, created: Date.now(), ...rec });
    save(); toast(id ? 'Saved' : 'Promise added. Tap 🔔 to set an alarm');
  }, !id);
}

/* Calendar reminders: the phone's own calendar rings the alarm */
function eventTimes(p) {
  if (p.time) {
    const [h, m] = p.time.split(':').map(Number);
    const s = parseDate(p.due); s.setHours(h, m, 0, 0);
    const e = new Date(s.getTime() + 3600e3);
    const f = (x) => ymd(x).replace(/-/g, '') + 'T' + String(x.getHours()).padStart(2, '0') + String(x.getMinutes()).padStart(2, '0') + '00';
    return { allDay: false, start: f(s), end: f(e) };
  }
  return { allDay: true, start: p.due.replace(/-/g, ''), end: addDays(p.due, 1).replace(/-/g, '') };
}
function promiseDetails(p) {
  const c = getClient(p.clientId);
  return [c ? 'Client: ' + c.name + (c.phone ? ' (' + c.phone + ')' : '') : '', p.notes || '', 'From BizBook'].filter(Boolean).join('\n');
}
function gcalUrl(p) {
  const t = eventTimes(p);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: p.title, dates: t.start + '/' + t.end, details: promiseDetails(p) });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/[;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');

/* ---------- measurements ---------- */
const UNITS = { ft: { area: 'sq ft', length: 'rft', count: 'nos' }, m: { area: 'sq m', length: 'rmt', count: 'nos' } };
const KIND_LABEL = { area: 'Area', length: 'Running length', count: 'Pieces' };

/* Feet+inches: "10'6", "10' 6\"", "10 6", "10-6" all mean 10 ft 6 in. Plain numbers are taken as is. */
function parseLen(v, unit) {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  if (unit === 'ft') {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|\s|-)\s*(\d+(?:\.\d+)?)?\s*(?:"|''|in)?$/i);
    if (m) return Number(m[1]) + Number(m[2] || 0) / 12;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function itemVal(it, unit) {
  const L = parseLen(it.l, unit), W = parseLen(it.w, unit);
  const q = String(it.qty ?? '').trim() === '' ? 1 : num(it.qty);
  if (it.type === 'length') return L * q;
  if (it.type === 'count') return q;
  return L * W * q;
}
function measureTotals(m) {
  const tot = { area: 0, length: 0, count: 0 };
  const rooms = m.rooms.map((r) => {
    const t = { area: 0, length: 0, count: 0 };
    r.items.forEach((it) => { t[it.type || 'area'] += itemVal(it, m.unit); });
    for (const k in t) tot[k] += t[k];
    return t;
  });
  return { rooms, tot };
}
function totalsHtml(t, unit) {
  const rows = ['area', 'length', 'count'].filter((k) => t[k]).map((k) => `<div><span>${KIND_LABEL[k]}</span><b>${fmt(t[k])} ${UNITS[unit][k]}</b></div>`);
  if (unit === 'ft' && t.area) rows.push(`<div class="mini"><span>= ${fmt(t.area * 0.092903)} sq m</span></div>`);
  return rows.join('') || '<div class="mini">Enter sizes to see totals</div>';
}
const blankItem = () => ({ name: '', l: '', w: '', qty: '', type: 'area' });
function newMeasure(clientId = null) {
  const m = { id: uid(), title: 'Site measurement', clientId, date: today(), unit: 'ft', rooms: [{ name: 'Living room', items: [blankItem()] }], created: Date.now() };
  db.measures.push(m); save(); go('#/measure/' + m.id);
}
function measureText(m) {
  const { rooms, tot } = measureTotals(m); const u = UNITS[m.unit];
  const lines = [`*${m.title}*`, [clientName(m.clientId), longDate(m.date)].filter(Boolean).join(' · '), ''];
  m.rooms.forEach((r, ri) => {
    lines.push(`*${r.name || 'Room ' + (ri + 1)}*`);
    r.items.forEach((it) => {
      const v = itemVal(it, m.unit); if (!v) return;
      const size = it.type === 'count' ? '' : it.type === 'length' ? it.l : `${it.l} × ${it.w}`;
      const q = String(it.qty ?? '').trim() && num(it.qty) !== 1 ? ` × ${it.qty}` : '';
      lines.push(`• ${it.name || 'Item'}: ${size}${q} = ${fmt(v)} ${u[it.type || 'area']}`);
    });
    lines.push('');
  });
  ['area', 'length', 'count'].forEach((k) => { if (tot[k]) lines.push(`Total ${KIND_LABEL[k].toLowerCase()}: *${fmt(tot[k])} ${u[k]}*`); });
  return lines.join('\n');
}

/* ---------- quotes & bills ---------- */
function nextNumber(kind) {
  const s = db.settings;
  if (kind === 'bill') { s.bNo = (s.bNo || 0) + 1; return 'INV-' + String(s.bNo).padStart(3, '0'); }
  s.qNo = (s.qNo || 0) + 1; return 'Q-' + String(s.qNo).padStart(3, '0');
}
function newDoc(kind = 'quote', clientId = null, items = null, extra = {}) {
  const d = {
    id: uid(), kind, number: nextNumber(kind), clientId, date: today(),
    items: items || [{ desc: '', qty: '1', unit: '', rate: '' }],
    discount: '', taxPct: String(db.settings.taxPct ?? ''), advance: '', notes: db.settings.terms, created: Date.now(), ...extra,
  };
  db.docs.push(d); save(); go('#/doc/' + d.id);
  return d;
}
function docTotals(d) {
  const lines = d.items.map((it) => num(it.qty) * num(it.rate));
  const sub = lines.reduce((a, b) => a + b, 0);
  const disc = num(d.discount);
  const taxable = sub - disc;
  const tax = taxable * num(d.taxPct) / 100;
  const total = taxable + tax;
  const adv = num(d.advance);
  return { lines, sub, disc, tax, total, adv, balance: total - adv };
}
function docText(d) {
  const s = db.settings, c = getClient(d.clientId), t = docTotals(d);
  const L = [`*${s.bizName}*`, `${d.kind === 'bill' ? 'INVOICE' : 'QUOTATION'} ${d.number} · ${longDate(d.date)}`];
  if (c) L.push('To: ' + c.name);
  L.push('');
  d.items.forEach((it, i) => {
    if (!it.desc && !t.lines[i]) return;
    L.push(`${i + 1}. ${it.desc || 'Item'}: ${fmt(num(it.qty))} ${it.unit || ''} × ${money(num(it.rate))} = ${money(t.lines[i])}`);
  });
  L.push('', 'Subtotal: ' + money(t.sub));
  if (t.disc) L.push('Discount: −' + money(t.disc));
  if (t.tax) L.push(`${s.taxName} ${fmt(num(d.taxPct))}%: ${money(t.tax)}`);
  L.push(`*Total: ${money(t.total)}*`);
  if (t.adv) L.push('Advance received: ' + money(t.adv), `*Balance due: ${money(t.balance)}*`);
  if (d.notes) L.push('', d.notes);
  if (s.phone) L.push('', s.owner ? `${s.owner} · ${s.phone}` : s.phone);
  return L.join('\n');
}
const docTitle = (d) => (d.kind === 'bill' ? 'Bill ' : 'Quote ') + d.number;

/* ---------- bottom sheet ---------- */
let sheetSubmit = null;
function openSheet(html, onSubmit, focusFirst = false) {
  const s = $('#sheet');
  s.innerHTML = html; s.hidden = false; $('#sheetBackdrop').hidden = false;
  sheetSubmit = onSubmit;
  const f = s.querySelector('form');
  if (f) {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (sheetSubmit && sheetSubmit(Object.fromEntries(new FormData(f))) !== false) { closeSheet(); render(); }
    });
    if (focusFirst) setTimeout(() => f.querySelector('input')?.focus(), 60);
  }
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; $('#sheet').innerHTML = ''; sheetSubmit = null; }

function clientForm(id) {
  const c = getClient(id) || {};
  openSheet(`<h2>${id ? 'Edit client' : 'New client'}</h2>
    <form id="f" autocomplete="off">
      <label>Name<input name="name" required value="${esc(c.name)}" placeholder="e.g. Mr. Mehta"></label>
      <label>Phone<input name="phone" type="tel" value="${esc(c.phone)}" placeholder="98765 43210"></label>
      <label>Site address<textarea name="address" rows="2">${esc(c.address)}</textarea></label>
      <label>Notes<textarea name="notes" rows="2" placeholder="Likes light colours, budget…">${esc(c.notes)}</textarea></label>
      <div class="row"><button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn primary">Save</button></div>
    </form>`, (data) => {
    const rec = { name: data.name.trim(), phone: data.phone.trim(), address: data.address.trim(), notes: data.notes.trim() };
    if (id) Object.assign(getClient(id), rec);
    else { const n = { id: uid(), created: Date.now(), ...rec }; db.clients.push(n); save(); toast('Client added'); go('#/client/' + n.id); return; }
    save(); toast('Saved');
  }, !id);
}

function quickMenu(clientId = null) {
  const c = clientId ? `data-client="${clientId}"` : '';
  openSheet(`<h2>Add new</h2><div class="menu-list">
    <button class="btn" data-act="newPromise" ${c}>${ICON.promise} Promise / reminder</button>
    ${clientId ? '' : `<button class="btn" data-act="newClient">${ICON.client} Client</button>`}
    <button class="btn" data-act="newMeasure" ${c}>${ICON.ruler} Site measurement</button>
    <button class="btn" data-act="newQuote" ${c}>${ICON.doc} Quotation</button>
    <button class="btn" data-act="newBill" ${c}>${ICON.doc} Bill / invoice</button>
  </div>`);
}

/* =========================================================
   Views. Each returns { title, html, tab, back, fab, after }
   ========================================================= */
let promiseTab = 'pending';
let docTab = 'quote';
let installEvt = null;

const VIEWS = {
  today() {
    const t = today(), wk = addDays(t, 7);
    const pend = db.promises.filter((p) => !p.done).sort(byDue);
    const late = pend.filter((p) => p.due < t), now = pend.filter((p) => p.due === t), soon = pend.filter((p) => p.due > t && p.due <= wk);
    const due = db.docs.filter((d) => d.kind === 'bill').reduce((s, d) => s + Math.max(0, docTotals(d).balance), 0);
    const h = new Date().getHours();
    const hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const who = db.settings.owner || (db.settings.bizName !== 'My Business' ? db.settings.bizName : '');
    const fresh = !db.clients.length && !db.promises.length && db.settings.bizName === 'My Business';
    let html = `<p class="hello">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}<b>${hi}${who ? ', ' + esc(who) : ''}</b></p>`;
    if (fresh) html += `<div class="card"><b>Welcome to BizBook 👋</b><p class="hint" style="margin:6px 0 12px">First, add your business name and phone. They go on every quote and bill.</p><a class="btn primary" href="#/settings">Set up my business</a></div>`;
    if (installEvt) html += `<div class="card row" style="align-items:center"><span>Put BizBook on your home screen</span><button class="btn primary" style="flex:none" data-act="install">Install</button></div>`;
    html += `<div class="stats">
      <a class="stat ${late.length ? 'red' : ''}" href="#/promises"><b data-num="${late.length}">0</b><span>Overdue</span></a>
      <a class="stat" href="#/promises"><b data-num="${now.length}">0</b><span>Due today</span></a>
      <a class="stat amber" href="#/docs" data-act="showBills"><b data-money="${due}">${money(0)}</b><span>To collect</span></a>
    </div>
    <h2 class="sec">Quick add</h2>
    <div class="quick">
      <button data-act="newPromise">${ICON.promise}Promise</button>
      <button data-act="newClient">${ICON.client}Client</button>
      <button data-act="newMeasure">${ICON.ruler}Measure</button>
      <button data-act="newQuote">${ICON.doc}Quote</button>
    </div>`;
    if (late.length) html += `<h2 class="sec red">Overdue (${late.length})</h2>` + promiseList(late);
    html += `<h2 class="sec">Today</h2>` + (now.length ? promiseList(now) : `<div class="card empty"><b>Nothing due today</b>Tap “Promise” above to add one.</div>`);
    if (soon.length) html += `<h2 class="sec">Next 7 days</h2>` + promiseList(soon);
    return { title: 'BizBook', html, fab: () => quickMenu(), fabAlert: late.length > 0, after: () => countUpIn($('#view')) };
  },

  promises() {
    const seg = `<div class="seg"><button class="${promiseTab === 'pending' ? 'on' : ''}" data-act="promiseTab" data-v="pending">To do</button><button class="${promiseTab === 'done' ? 'on' : ''}" data-act="promiseTab" data-v="done">Done</button></div>`;
    let html = seg;
    if (promiseTab === 'done') {
      const done = db.promises.filter((p) => p.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 200);
      html += done.length ? promiseList(done) : `<div class="card empty"><b>Nothing finished yet</b>Tick a promise when it's done.</div>`;
    } else {
      const t = today();
      const pend = db.promises.filter((p) => !p.done).sort(byDue);
      if (!pend.length) html += `<div class="card empty"><b>No pending promises</b>Tap + to note what you promised a client.</div>`;
      const late = pend.filter((p) => p.due < t);
      if (late.length) html += `<h2 class="sec red">Overdue</h2>` + promiseList(late);
      const groups = {};
      pend.filter((p) => p.due >= t).forEach((p) => { (groups[p.due] ||= []).push(p); });
      for (const d of Object.keys(groups)) html += `<h2 class="sec">${dayLabel(d)}</h2>` + promiseList(groups[d]);
    }
    return { title: 'Promises', html, fab: () => promiseForm() };
  },

  clients() {
    const list = [...db.clients].sort((a, b) => a.name.localeCompare(b.name));
    let html = `<input class="search" id="clientSearch" type="search" placeholder="Search clients" autocomplete="off">`;
    html += list.length ? `<div class="card flush">${list.map((c) => {
      const open = db.promises.filter((p) => p.clientId === c.id && !p.done).length;
      return `<a class="item" href="#/client/${c.id}" data-name="${esc(c.name.toLowerCase() + ' ' + c.phone)}">
        <div class="avatar">${esc(c.name.trim().charAt(0).toUpperCase() || '?')}</div>
        <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.phone || c.address || 'No phone')}</div></div>
        ${open ? `<span class="badge">${open} open</span>` : ''}</a>`;
    }).join('')}</div>` : `<div class="card empty"><b>No clients yet</b>Tap + to add your first client.</div>`;
    return { title: 'Clients', html, fab: () => clientForm() };
  },

  client(id) {
    const c = getClient(id);
    if (!c) return notFound();
    const ps = db.promises.filter((p) => p.clientId === id).sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b));
    const ms = db.measures.filter((m) => m.clientId === id).sort((a, b) => b.date.localeCompare(a.date));
    const ds = db.docs.filter((d) => d.clientId === id).sort((a, b) => b.date.localeCompare(a.date));
    const bills = ds.filter((d) => d.kind === 'bill').map(docTotals);
    const billed = bills.reduce((s, t) => s + t.total, 0), bal = bills.reduce((s, t) => s + Math.max(0, t.balance), 0);
    const html = `<div class="card">
      <div class="client-head"><div class="avatar">${esc(c.name.charAt(0).toUpperCase())}</div>
        <div><h2>${esc(c.name)}</h2><p>${esc(c.phone || 'No phone')}</p></div></div>
      ${c.address ? `<p class="hint" style="margin:0 0 12px">📍 ${nl2br(c.address)}</p>` : ''}
      ${c.notes ? `<p class="hint" style="margin:0 0 12px">📝 ${nl2br(c.notes)}</p>` : ''}
      <div class="row">
        ${c.phone ? `<a class="btn" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${ICON.phone} Call</a>
        <a class="btn wa" href="${esc(waLink(c.phone, 'Hello ' + c.name + ', '))}" target="_blank" rel="noopener">${ICON.chat} WhatsApp</a>` : ''}
        <button class="btn" data-act="editClient" data-id="${id}">${ICON.edit} Edit</button>
      </div></div>
    ${bills.length ? `<div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><b style="font-size:18px" data-money="${billed}">${money(0)}</b><span>Total billed</span></div><div class="stat ${bal > 0 ? 'red' : ''}"><b style="font-size:18px" data-money="${bal}">${money(0)}</b><span>Balance due</span></div></div>` : ''}
    <h2 class="sec">Promises <button class="link" data-act="newPromise" data-client="${id}">+ Add</button></h2>
    ${ps.length ? promiseList(ps) : '<div class="card empty">No promises yet</div>'}
    <h2 class="sec">Measurements <button class="link" data-act="newMeasure" data-client="${id}">+ Add</button></h2>
    ${ms.length ? `<div class="card flush">${ms.map(measureItem).join('')}</div>` : '<div class="card empty">No measurements yet</div>'}
    <h2 class="sec">Quotes & bills <button class="link" data-act="newQuote" data-client="${id}">+ Add</button></h2>
    ${ds.length ? `<div class="card flush">${ds.map(docItem).join('')}</div>` : '<div class="card empty">No quotes or bills yet</div>'}
    <div class="row" style="margin-top:24px"><button class="btn danger" data-act="delClient" data-id="${id}">${ICON.trash} Delete client</button></div>`;
    return { title: c.name, html, back: true, tab: 'clients', fab: () => quickMenu(id), after: () => countUpIn($('#view')) };
  },

  measures() {
    const list = [...db.measures].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    const html = list.length ? `<div class="card flush">${list.map(measureItem).join('')}</div>`
      : `<div class="card empty"><b>No measurements yet</b>Tap + at the site to note room sizes. Areas are worked out for you.</div>`;
    return { title: 'Measurements', html, fab: () => newMeasure() };
  },

  measure(id) {
    const m = db.measures.find((x) => x.id === id);
    if (!m) return notFound();
    const ft = m.unit === 'ft';
    const lenMode = ft ? 'text' : 'decimal';
    const rooms = m.rooms.map((r, ri) => `<div class="card room">
      <div class="room-head"><input data-bind="rooms.${ri}.name" value="${esc(r.name)}" placeholder="Room name">
        <button class="icon-btn" style="color:var(--muted)" data-act="delRoom" data-ri="${ri}" aria-label="Delete room">${ICON.trash}</button></div>
      ${r.items.map((it, ii) => {
        const p = `rooms.${ri}.items.${ii}`; const ty = it.type || 'area';
        return `<div class="mrow">
          <input class="name" data-bind="${p}.name" value="${esc(it.name)}" placeholder="Item: wall, ceiling, wardrobe…">
          <button class="x" data-act="delItem" data-ri="${ri}" data-ii="${ii}" aria-label="Remove item">${ICON.x}</button>
          <input inputmode="${lenMode}" data-bind="${p}.l" value="${esc(it.l)}" placeholder="${ty === 'count' ? '—' : 'Length'}" ${ty === 'count' ? 'disabled' : ''}>
          <input inputmode="${lenMode}" data-bind="${p}.w" value="${esc(it.w)}" placeholder="${ty === 'area' ? 'Width' : '—'}" ${ty === 'area' ? '' : 'disabled'}>
          <input inputmode="text" data-bind="${p}.qty" value="${esc(it.qty)}" placeholder="Qty 1">
          <span></span>
          <div class="out"><select data-bind="${p}.type" data-rerender aria-label="Measure type">
            <option value="area" ${ty === 'area' ? 'selected' : ''}>Area L×W</option>
            <option value="length" ${ty === 'length' ? 'selected' : ''}>Length only</option>
            <option value="count" ${ty === 'count' ? 'selected' : ''}>Count (nos)</option></select>
            <span id="iv-${ri}-${ii}"></span></div>
        </div>`;
      }).join('')}
      <button class="btn ghost" style="width:100%;margin:6px 0 10px" data-act="addItem" data-ri="${ri}">+ Add item</button>
      <div class="totals" id="rt-${ri}"></div>
    </div>`).join('');
    const html = `<div data-obj="measure" data-id="${m.id}">
      <div class="card">
        <label>Title<input data-bind="title" value="${esc(m.title)}"></label>
        <label>Client<input data-bind="client" list="clientList" value="${esc(clientName(m.clientId))}" placeholder="Type client name" autocomplete="off"></label>
        <div class="row"><label>Date<input type="date" data-bind="date" value="${esc(m.date)}"></label>
          <label>Unit<select data-bind="unit" data-rerender><option value="ft" ${ft ? 'selected' : ''}>Feet</option><option value="m" ${ft ? '' : 'selected'}>Metres</option></select></label></div>
        <p class="hint" style="margin:0">${ft ? 'Feet + inches: type <b>10 6</b> or <b>10\'6</b> for 10 ft 6 in. ' : ''}Use qty <b>-1</b> to subtract a door or window.</p>
      </div>
      ${rooms}
      <button class="btn" style="width:100%;margin-bottom:14px" data-act="addRoom">+ Add room</button>
      <div class="card"><b>Grand total</b><div class="totals" id="mt" style="margin-top:8px"></div></div>
      <div class="stack">
        <button class="btn primary" data-act="measureToQuote">${ICON.doc} Make quotation from this</button>
        <button class="btn" data-act="shareMeasure">${ICON.share} Share measurements</button>
        <button class="btn danger" data-act="delMeasure">${ICON.trash} Delete</button>
      </div>
      ${clientDatalist()}
    </div>`;
    return { title: m.title || 'Measurement', html, back: true, tab: 'measures', after: () => refreshMeasure(m) };
  },

  docs() {
    const list = db.docs.filter((d) => d.kind === docTab).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    const html = `<div class="seg"><button class="${docTab === 'quote' ? 'on' : ''}" data-act="docTab" data-v="quote">Quotations</button><button class="${docTab === 'bill' ? 'on' : ''}" data-act="docTab" data-v="bill">Bills</button></div>
      ${list.length ? `<div class="card flush">${list.map(docItem).join('')}</div>`
        : `<div class="card empty"><b>No ${docTab === 'bill' ? 'bills' : 'quotations'} yet</b>Tap + to make one. You can also make one from a measurement.</div>`}`;
    return { title: 'Quotes & Bills', html, tab: 'docs', fab: () => newDoc(docTab) };
  },

  doc(id) {
    const d = db.docs.find((x) => x.id === id);
    if (!d) return notFound();
    const s = db.settings;
    const rows = d.items.map((it, i) => `<div class="qrow">
      <input class="desc" data-bind="items.${i}.desc" value="${esc(it.desc)}" placeholder="Work / item description">
      <button class="x" data-act="delLine" data-i="${i}" aria-label="Remove line">${ICON.x}</button>
      <div><div class="mini">Qty</div><input inputmode="decimal" data-bind="items.${i}.qty" value="${esc(it.qty)}"></div>
      <div><div class="mini">Unit</div><input data-bind="items.${i}.unit" value="${esc(it.unit)}" list="unitList" placeholder="sq ft"></div>
      <div><div class="mini">Rate</div><input inputmode="decimal" data-bind="items.${i}.rate" value="${esc(it.rate)}"></div>
      <span></span>
      <div class="amt" id="da-${i}"></div>
    </div>`).join('');
    const html = `<div data-obj="doc" data-id="${d.id}">
      <div class="card">
        <div class="row"><label>${d.kind === 'bill' ? 'Bill no.' : 'Quote no.'}<input data-bind="number" value="${esc(d.number)}"></label>
          <label>Date<input type="date" data-bind="date" value="${esc(d.date)}"></label></div>
        <label style="margin:0">Client<input data-bind="client" list="clientList" value="${esc(clientName(d.clientId))}" placeholder="Type client name" autocomplete="off"></label>
      </div>
      <div class="card"><b>Items</b>${rows}
        <button class="btn ghost" style="width:100%;margin-top:6px" data-act="addLine">+ Add line</button></div>
      <div class="card">
        <div class="totals"><div><span>Subtotal</span><b id="dt-sub"></b></div></div>
        <div class="inline" style="margin-top:12px"><span>Discount (${esc(s.currency)})</span><input inputmode="decimal" data-bind="discount" value="${esc(d.discount)}" placeholder="0"></div>
        <div class="inline"><span>${esc(s.taxName || 'Tax')} %</span><input inputmode="decimal" data-bind="taxPct" value="${esc(d.taxPct)}" placeholder="0"></div>
        <div class="totals"><div><span>${esc(s.taxName || 'Tax')}</span><b id="dt-tax"></b></div><div class="big"><span>Total</span><span id="dt-total"></span></div></div>
        <div class="inline" style="margin-top:12px"><span>Advance received</span><input inputmode="decimal" data-bind="advance" value="${esc(d.advance)}" placeholder="0"></div>
        <div class="totals"><div class="big"><span>Balance due</span><span class="bal" id="dt-bal"></span></div></div>
      </div>
      <div class="card"><label style="margin:0">Terms & notes<textarea rows="3" data-bind="notes">${esc(d.notes)}</textarea></label></div>
      <div class="stack">
        <a class="btn primary" href="#/print/${d.id}">${ICON.share} Preview, share or print</a>
        ${d.kind === 'quote' ? `<button class="btn" data-act="toBill">${ICON.doc} Client agreed: turn into bill</button>` : ''}
        <button class="btn danger" data-act="delDoc">${ICON.trash} Delete</button>
      </div>
      ${clientDatalist()}
      <datalist id="unitList">${['sq ft', 'rft', 'nos', 'sq m', 'rmt', 'set', 'lump sum', 'job'].map((u) => `<option value="${u}">`).join('')}</datalist>
    </div>`;
    return { title: docTitle(d), html, back: true, tab: 'docs', after: () => refreshDoc(d) };
  },

  print(id) {
    const d = db.docs.find((x) => x.id === id);
    if (!d) return notFound();
    const s = db.settings, c = getClient(d.clientId), t = docTotals(d);
    const rows = d.items.map((it, i) => `<tr><td>${i + 1}</td><td>${nl2br(it.desc)}</td><td class="num">${fmt(num(it.qty))} ${esc(it.unit)}</td><td class="num">${fmt(num(it.rate))}</td><td class="num">${fmt(t.lines[i])}</td></tr>`).join('');
    const html = `<div class="doc">
      <div class="dh">
        <div><div class="biz">${esc(s.bizName)}</div><div class="muted">${[esc(s.owner), esc(s.phone), nl2br(s.address), s.taxId ? esc(s.taxName) + 'IN: ' + esc(s.taxId) : ''].filter(Boolean).join('<br>')}</div></div>
        <div><div class="kind">${d.kind === 'bill' ? 'INVOICE' : 'QUOTATION'}</div><div class="num muted">No. ${esc(d.number)}<br>${longDate(d.date)}</div></div>
      </div>
      <div><span class="muted">To</span><br><b>${esc(c?.name || '—')}</b>${c?.phone ? '<br>' + esc(c.phone) : ''}${c?.address ? '<br>' + nl2br(c.address) : ''}</div>
      <table><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum">
        <div><span>Subtotal</span><span>${money(t.sub)}</span></div>
        ${t.disc ? `<div><span>Discount</span><span>− ${money(t.disc)}</span></div>` : ''}
        ${t.tax ? `<div><span>${esc(s.taxName)} ${fmt(num(d.taxPct))}%</span><span>${money(t.tax)}</span></div>` : ''}
        <div class="big"><span>Total</span><span>${money(t.total)}</span></div>
        ${t.adv ? `<div><span>Advance received</span><span>${money(t.adv)}</span></div><div class="big"><span>Balance due</span><span>${money(t.balance)}</span></div>` : ''}
      </div>
      ${d.notes ? `<p><b>Terms & notes</b><br>${nl2br(d.notes)}</p>` : ''}
      <div class="sign"><span>For ${esc(s.bizName)}</span></div>
    </div>
    <div class="doc-actions stack">
      <a class="btn wa" href="${esc(waLink(c?.phone, docText(d)))}" target="_blank" rel="noopener">${ICON.chat} Send on WhatsApp</a>
      <button class="btn primary" data-act="print">${ICON.print} Print / Save as PDF</button>
      ${navigator.share ? `<button class="btn" data-act="shareDoc" data-id="${d.id}">${ICON.share} Share…</button>` : ''}
      <a class="btn" href="#/doc/${d.id}">${ICON.edit} Edit</a>
    </div>`;
    return { title: docTitle(d), html, back: true, tab: 'docs' };
  },

  calc() {
    const k = (label, key, cls = '') => `<button class="${cls}" data-act="key" data-k="${key}">${label}</button>`;
    const html = `<div class="calc-display"><div class="expr" id="cExpr"></div><div class="res" id="cRes">0</div></div>
      <div class="keys">
        ${k('C', 'C', 'fn')}${k('⌫', 'back', 'fn')}${k('%', '%', 'op')}${k('÷', '/', 'op')}
        ${k('7', '7')}${k('8', '8')}${k('9', '9')}${k('×', '*', 'op')}
        ${k('4', '4')}${k('5', '5')}${k('6', '6')}${k('−', '-', 'op')}
        ${k('1', '1')}${k('2', '2')}${k('3', '3')}${k('+', '+', 'op')}
        ${k('0', '0')}${k('00', '00')}${k('.', '.')}${k('=', '=', 'eq')}
      </div>
      <div class="row" style="margin-top:12px"><button class="btn" data-act="copyCalc">Copy answer</button></div>
      <h2 class="sec">Area calculator (feet)</h2>
      <div class="card">
        <div class="row"><label>Length<input id="calcL" placeholder="12 6" autocomplete="off"></label><label>Width<input id="calcW" placeholder="10" autocomplete="off"></label></div>
        <label>Rate per sq ft (optional)<input id="calcRate" inputmode="decimal" autocomplete="off"></label>
        <div class="totals" id="areaOut"><div class="mini">Type 12 6 for 12 ft 6 in</div></div>
      </div>
      <h2 class="sec">Circle calculator</h2>
      <div class="card">
        <div class="row">
          <label>Diameter<input id="circD" placeholder="12 6" autocomplete="off"></label>
          <label>Unit<select id="circUnit"><option value="ft">Feet</option><option value="in">Inch</option><option value="m">Metre</option><option value="cm">Cm</option></select></label>
        </div>
        <p class="hint" style="margin:0 0 10px">Enter the diameter to get the circumference (and area).</p>
        <div class="totals" id="circOut"><div class="mini">Enter a diameter</div></div>
      </div>`;
    return { title: 'Calculator', html, back: true, tab: '', after: updateCalc };
  },

  settings() {
    const s = db.settings;
    const f = (key, label, extra = '') => `<label>${label}<input data-bind="${key}" value="${esc(s[key])}" ${extra}></label>`;
    const html = `<div data-obj="settings">
      <h2 class="sec">Your business (printed on quotes & bills)</h2>
      <div class="card">
        ${f('bizName', 'Business name')}${f('owner', 'Your name')}${f('phone', 'Phone', 'type="tel"')}
        <label>Address<textarea rows="2" data-bind="address">${esc(s.address)}</textarea></label>
        ${f('taxId', 'GSTIN / tax number (optional)')}
      </div>
      <h2 class="sec">Money</h2>
      <div class="card">
        <div class="row">${f('currency', 'Currency sign')}${f('taxName', 'Tax name')}</div>
        <div class="row">${f('taxPct', 'Default tax %', 'inputmode="decimal"')}${f('cc', 'Country code', 'inputmode="numeric"')}</div>
        <label style="margin:0">Default terms<textarea rows="3" data-bind="terms">${esc(s.terms)}</textarea></label>
      </div>
      <h2 class="sec">Backup</h2>
      <div class="card stack">
        <p class="hint" style="margin:0">Your data is saved only on this phone. Download a backup now and then and keep it safe, for example by sending it to yourself on WhatsApp or saving it to Google Drive.</p>
        <button class="btn primary" data-act="backup">Download backup</button>
        <label class="btn" style="margin:0;color:var(--ink)">Restore from backup<input type="file" id="restoreFile" accept=".json,application/json" hidden></label>
      </div>
      ${installEvt ? '<div class="card"><button class="btn primary" style="width:100%" data-act="install">Install BizBook on this phone</button></div>' : ''}
      <p class="hint" style="text-align:center;margin-top:20px">BizBook v1.0 · ${db.clients.length} clients · ${db.promises.length} promises · ${db.docs.length} quotes/bills</p>
    </div>`;
    return { title: 'Settings', html, back: true, tab: '' };
  },
};

function notFound() {
  return { title: 'Not found', back: true, html: '<div class="card empty"><b>This item was deleted</b><a class="btn" href="#/today">Go home</a></div>' };
}
function measureItem(m) {
  const { tot } = measureTotals(m); const u = UNITS[m.unit];
  return `<a class="item" href="#/measure/${m.id}"><div class="grow"><div class="t">${esc(m.title)}</div>
    <div class="s">${[esc(clientName(m.clientId)), longDate(m.date), m.rooms.length + ' room' + (m.rooms.length === 1 ? '' : 's')].filter(Boolean).join(' · ')}</div></div>
    ${tot.area ? `<div class="r">${fmt(tot.area)}<small>${u.area}</small></div>` : ''}</a>`;
}
function docItem(d) {
  const t = docTotals(d);
  let badge = '';
  if (d.kind === 'bill') badge = t.balance > 0.005 ? `<span class="badge red">Due ${money(t.balance)}</span>` : '<span class="badge">Paid</span>';
  else if (d.converted) badge = '<span class="badge">Billed</span>';
  return `<a class="item" href="#/doc/${d.id}"><div class="grow"><div class="t">${esc(d.number)} · ${esc(clientName(d.clientId) || 'No client')}</div>
    <div class="s">${longDate(d.date)}</div></div><div class="r">${money(t.total)}<small>${badge}</small></div></a>`;
}

/* ---------- live refresh while typing (keeps the keyboard open) ---------- */
function refreshMeasure(m) {
  const { rooms, tot } = measureTotals(m);
  m.rooms.forEach((r, ri) => {
    r.items.forEach((it, ii) => {
      const el = document.getElementById(`iv-${ri}-${ii}`);
      if (el) el.textContent = '= ' + fmt(itemVal(it, m.unit)) + ' ' + UNITS[m.unit][it.type || 'area'];
    });
    const rt = document.getElementById('rt-' + ri); if (rt) rt.innerHTML = totalsHtml(rooms[ri], m.unit);
  });
  const mt = $('#mt'); if (mt) mt.innerHTML = totalsHtml(tot, m.unit);
}
function refreshDoc(d) {
  const t = docTotals(d);
  t.lines.forEach((v, i) => { const el = document.getElementById('da-' + i); if (el) el.textContent = money(v); });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dt-sub', money(t.sub)); set('dt-tax', money(t.tax)); set('dt-total', money(t.total)); set('dt-bal', money(t.balance));
}

/* ---------- calculator ---------- */
const calc = { expr: '', hist: '', done: false };
function evalExpr(e) {
  if (!e) return null;
  const s = e.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  if (!/^[\d+\-*/.() ]+$/.test(s)) return null;
  try {
    const v = Function('"use strict";return (' + s + ')')();
    return Number.isFinite(v) ? Math.round(v * 1e8) / 1e8 : null;
  } catch (err) { return null; }
}
const pretty = (e) => e.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/(?<=\d|\))-/g, ' − ').replace(/\+/g, ' + ');
function updateCalc() {
  const ex = $('#cExpr'), rs = $('#cRes'); if (!ex) return;
  const v = evalExpr(calc.expr);
  ex.textContent = calc.done ? pretty(calc.hist) + ' =' : pretty(calc.expr);
  rs.textContent = v === null ? (calc.expr ? '…' : '0') : v.toLocaleString('en-IN', { maximumFractionDigits: 8 });
}
function pressKey(k) {
  const ops = '+-*/';
  if (k === 'C') { calc.expr = ''; calc.done = false; }
  else if (k === 'back') { calc.expr = calc.expr.slice(0, -1); calc.done = false; }
  else if (k === '=') {
    const v = evalExpr(calc.expr);
    if (v !== null) { calc.hist = calc.expr; calc.expr = String(v); calc.done = true; }
  } else {
    if (calc.done && !ops.includes(k) && k !== '%') calc.expr = '';
    calc.done = false;
    const last = calc.expr.slice(-1);
    if (ops.includes(k) && ops.includes(last)) calc.expr = calc.expr.slice(0, -1);
    if (ops.includes(k) && k !== '-' && !calc.expr) return;
    if (k === '.') { const seg = calc.expr.split(/[+\-*/]/).pop(); if (seg.includes('.')) return; if (!seg) calc.expr += '0'; }
    calc.expr += k;
  }
  updateCalc();
}
function updateArea() {
  const L = parseLen($('#calcL').value, 'ft'), W = parseLen($('#calcW').value, 'ft'), rate = num($('#calcRate').value);
  const a = L * W;
  $('#areaOut').innerHTML = a ? `<div class="big"><span>Area</span><span>${fmt(a)} sq ft</span></div><div><span>In metres</span><b>${fmt(a * 0.092903)} sq m</b></div>
    ${rate ? `<div class="big"><span>Amount</span><span>${money(a * rate)}</span></div>` : ''}` : '<div class="mini">Type 12 6 for 12 ft 6 in</div>';
}
const CIRC_UNIT_LABEL = { ft: 'ft', in: 'in', m: 'm', cm: 'cm' };
function updateCircle() {
  const unitEl = $('#circUnit'), dEl = $('#circD'), out = $('#circOut');
  if (!unitEl || !dEl || !out) return;
  const unit = unitEl.value;
  const d = unit === 'ft' ? parseLen(dEl.value, 'ft') : num(dEl.value);
  if (!d) { out.innerHTML = '<div class="mini">Enter a diameter</div>'; return; }
  const u = CIRC_UNIT_LABEL[unit];
  const circ = Math.PI * d;
  const area = Math.PI * (d / 2) * (d / 2);
  out.innerHTML = `<div><span>Radius</span><b>${fmt(d / 2)} ${u}</b></div>
    <div class="big"><span>Circumference</span><span>${fmt(circ)} ${u}</span></div>
    <div><span>Area</span><b>${fmt(area)} sq ${u}</b></div>`;
}

/* =========================================================
   Actions (buttons with data-act)
   ========================================================= */
const findP = (id) => db.promises.find((p) => p.id === id);
function currentObj() {
  const wrap = $('[data-obj]'); if (!wrap) return null;
  const { obj, id } = wrap.dataset;
  if (obj === 'measure') return db.measures.find((m) => m.id === id);
  if (obj === 'doc') return db.docs.find((d) => d.id === id);
  if (obj === 'settings') return db.settings;
  return null;
}
let fabAction = null;

const actions = {
  fab: () => fabAction && fabAction(),
  back: () => { navDirection = 'back'; if (history.length > 1 && navCount > 0) history.back(); else go('#/today'); },
  closeSheet,
  newPromise: (d) => { closeSheet(); promiseForm(null, d.client ? { clientId: d.client } : {}); },
  newClient: () => { closeSheet(); clientForm(); },
  newMeasure: (d) => { closeSheet(); newMeasure(d.client || null); },
  newQuote: (d) => { closeSheet(); newDoc('quote', d.client || null); },
  newBill: (d) => { closeSheet(); newDoc('bill', d.client || null); },
  editClient: (d) => clientForm(d.id),
  editPromise: (d) => promiseForm(d.id),
  showBills: () => { docTab = 'bill'; go('#/docs'); },
  setDue: (d, el) => {
    $('#f [name=due]').value = d.d;
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  togglePromise: (d) => {
    const p = findP(d.id); if (!p) return;
    p.done = !p.done; p.doneAt = p.done ? Date.now() : null;
    save(); render(); toast(p.done ? 'Done ✓' : 'Moved back to “To do”');
  },
  delPromise: (d) => {
    if (!confirm('Delete this promise?')) return;
    db.promises = db.promises.filter((p) => p.id !== d.id); save(); closeSheet(); render();
  },
  remind: (d) => {
    const p = findP(d.id); if (!p) return;
    openSheet(`<h2>Set an alarm</h2>
      <p class="hint" style="margin:0 0 14px">Adds “${esc(p.title)}” to your phone's calendar so the phone reminds you${p.time ? ' one hour before' : ' the evening before and on the morning of ' + esc(dayLabel(p.due).toLowerCase())}.</p>
      <div class="menu-list">
        <a class="btn primary" href="${esc(gcalUrl(p))}" target="_blank" rel="noopener">${ICON.bell} Google Calendar (Android)</a>
        <button class="btn" data-act="ics" data-id="${p.id}">${ICON.bell} Phone calendar file (iPhone / others)</button>
        <button class="btn ghost" data-act="closeSheet">Cancel</button>
      </div>`);
  },
  ics: (d) => {
    const p = findP(d.id); if (!p) return;
    const t = eventTimes(p);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const alarm = (trigger) => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(p.title), 'TRIGGER:' + trigger, 'END:VALARM'];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BizBook//EN', 'BEGIN:VEVENT',
      'UID:' + p.id + '@bizbook', 'DTSTAMP:' + stamp,
      (t.allDay ? 'DTSTART;VALUE=DATE:' : 'DTSTART:') + t.start,
      (t.allDay ? 'DTEND;VALUE=DATE:' : 'DTEND:') + t.end,
      'SUMMARY:' + icsEsc(p.title), 'DESCRIPTION:' + icsEsc(promiseDetails(p)),
      ...(t.allDay ? [...alarm('-PT6H'), ...alarm('PT9H')] : alarm('-PT1H')),
      'END:VEVENT', 'END:VCALENDAR'];
    download(lines.join('\r\n'), slug(p.title) + '.ics', 'text/calendar');
    closeSheet(); toast('Open the downloaded file to add it to your calendar');
  },
  promiseTab: (d) => { promiseTab = d.v; render(); },
  docTab: (d) => { docTab = d.v; render(); },
  delClient: (d) => {
    const c = getClient(d.id); if (!c) return;
    if (!confirm(`Delete ${c.name} and all their promises, measurements, quotes and bills?`)) return;
    db.clients = db.clients.filter((x) => x.id !== d.id);
    db.promises = db.promises.filter((x) => x.clientId !== d.id);
    db.measures = db.measures.filter((x) => x.clientId !== d.id);
    db.docs = db.docs.filter((x) => x.clientId !== d.id);
    save(); toast('Client deleted'); go('#/clients');
  },
  // measurement editor
  addRoom: () => { const m = currentObj(); m.rooms.push({ name: 'Room ' + (m.rooms.length + 1), items: [blankItem()] }); save(); render(); },
  delRoom: (d) => {
    const m = currentObj(); if (!confirm('Delete this room?')) return;
    m.rooms.splice(Number(d.ri), 1); save(); render();
  },
  addItem: (d) => {
    const m = currentObj(); const r = m.rooms[Number(d.ri)];
    const prev = r.items[r.items.length - 1];
    r.items.push({ ...blankItem(), type: prev?.type || 'area' }); save(); render();
    document.querySelector(`[data-bind="rooms.${d.ri}.items.${r.items.length - 1}.name"]`)?.focus();
  },
  delItem: (d) => { const m = currentObj(); m.rooms[Number(d.ri)].items.splice(Number(d.ii), 1); save(); render(); },
  measureToQuote: () => {
    const m = currentObj(); const u = UNITS[m.unit]; const items = [];
    m.rooms.forEach((r) => r.items.forEach((it) => {
      const v = itemVal(it, m.unit); if (!v) return;
      items.push({ desc: [r.name, it.name].filter(Boolean).join(' – '), qty: String(r2(v)), unit: u[it.type || 'area'], rate: '' });
    }));
    if (!items.length) { toast('Enter some sizes first'); return; }
    save(); newDoc('quote', m.clientId, items); toast('Quotation made. Now fill in the rates');
  },
  shareMeasure: () => { const m = currentObj(); shareText(measureText(m), getClient(m.clientId)?.phone); },
  delMeasure: () => {
    const m = currentObj(); if (!confirm('Delete this measurement?')) return;
    db.measures = db.measures.filter((x) => x.id !== m.id); save(); go('#/measures');
  },
  // quote editor
  addLine: () => {
    const d = currentObj(); d.items.push({ desc: '', qty: '1', unit: d.items[d.items.length - 1]?.unit || '', rate: '' }); save(); render();
    document.querySelector(`[data-bind="items.${d.items.length - 1}.desc"]`)?.focus();
  },
  delLine: (x) => { const d = currentObj(); d.items.splice(Number(x.i), 1); save(); render(); },
  toBill: () => {
    const q = currentObj();
    q.converted = true;
    newDoc('bill', q.clientId, structuredClone(q.items), { discount: q.discount, taxPct: q.taxPct, advance: q.advance, notes: String(q.notes || '').replace(/^.*quotation valid.*$\n?/gim, '').trim(), fromQuote: q.number });
    toast('Bill made from ' + q.number);
  },
  delDoc: () => {
    const d = currentObj(); if (!confirm(`Delete ${docTitle(d)}?`)) return;
    db.docs = db.docs.filter((x) => x.id !== d.id); save(); go('#/docs');
  },
  print: () => window.print(),
  shareDoc: (d) => { const doc = db.docs.find((x) => x.id === d.id); navigator.share({ title: docTitle(doc), text: docText(doc) }).catch(() => {}); },
  // calculator
  key: (d) => pressKey(d.k),
  copyCalc: () => {
    const v = evalExpr(calc.expr);
    if (v === null) return toast('Nothing to copy');
    navigator.clipboard?.writeText(String(v)).then(() => toast('Copied ' + v), () => toast(String(v)));
  },
  // settings
  backup: () => {
    save();
    download(JSON.stringify({ app: 'bizbook', version: 1, saved: new Date().toISOString(), data: db }, null, 2), `bizbook-backup-${today()}.json`, 'application/json');
    toast('Backup downloaded');
  },
  install: async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* ignore */ }
    installEvt = null; render();
  },
};

function shareText(text, phone) {
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else window.open(waLink(phone, text), '_blank', 'noopener');
}

function restore(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      const data = parsed.data || parsed;
      if (!Array.isArray(data.clients) || !Array.isArray(data.promises)) throw new Error('bad');
      if (!confirm(`Restore backup with ${data.clients.length} clients and ${data.promises.length} promises? This replaces what is on this phone now.`)) return;
      db = { ...structuredClone(DEFAULTS), ...data, settings: { ...DEFAULTS.settings, ...data.settings } };
      save(); toast('Backup restored'); render();
    } catch (e) { toast('That file is not a BizBook backup'); }
    input.value = '';
  };
  r.readAsText(file);
}

/* ---------- typing into editors ---------- */
function setPath(obj, path, val) {
  const keys = path.split('.'); let o = obj;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = val;
}
function applyBind(el, rerender) {
  const obj = currentObj(); if (!obj) return;
  const key = el.dataset.bind;
  if (key === 'client') { const v = el.value.trim(); obj.clientId = v ? findOrCreateClient(v).id : null; }
  else setPath(obj, key, el.value);
  if (rerender) { save(); render(); return; }
  saveSoon();
  const type = $('[data-obj]').dataset.obj;
  if (type === 'measure') { refreshMeasure(obj); if (key === 'title') $('#title').textContent = obj.title || 'Measurement'; }
  if (type === 'doc') { refreshDoc(obj); if (key === 'number') $('#title').textContent = docTitle(obj); }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('click', (e) => {
  const sp = e.target.closest(SPARK_SEL);
  if (sp && e.detail !== 0) spark(e.clientX, e.clientY, sp); // e.detail 0 means a keyboard/synthetic click, no real tap point
});
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest(SPOT_SEL);
  if (el) litAt(el, e.clientX, e.clientY);
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'clientSearch') {
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll('[data-name]').forEach((a) => { a.style.display = a.dataset.name.includes(q) ? '' : 'none'; });
    return;
  }
  if (['calcL', 'calcW', 'calcRate'].includes(t.id)) return updateArea();
  if (t.id === 'circD') return updateCircle();
  if (t.dataset.bind && t.dataset.bind !== 'client' && !('rerender' in t.dataset)) applyBind(t, false);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'restoreFile') return restore(t);
  if (t.id === 'circUnit') return updateCircle();
  if (t.dataset.bind && (t.dataset.bind === 'client' || 'rerender' in t.dataset)) applyBind(t, 'rerender' in t.dataset);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) return closeSheet();
  if (!$('#cRes') || e.target.matches('input, textarea, select')) return;
  const map = { Enter: '=', '=': '=', Backspace: 'back', Escape: 'C', Delete: 'C' };
  const k = map[e.key] || ('0123456789.+-*/%'.includes(e.key) && e.key.length === 1 ? e.key : null);
  if (k) { e.preventDefault(); pressKey(k); }
});

/* ---------- router ---------- */
let navCount = -1;
let lastRoute = '';
let navDirection = 'fwd';
function render() {
  const [name = 'today', id] = location.hash.replace(/^#\/?/, '').split('/');
  const key = VIEWS[name] ? name : 'today';
  const v = VIEWS[key](id) || {};
  $('#title').textContent = v.title || 'BizBook';
  document.title = v.title && v.title !== 'BizBook' ? v.title + ' · BizBook' : 'BizBook';
  const view = $('#view');
  view.classList.remove('enter', 'enter-back');
  view.innerHTML = v.html || '';
  staggerIn(view); // set each child's --i before any layout flush, so its riseIn animation starts with the right delay from frame one
  void view.offsetWidth; // reflow, so the view's own entrance animation replays even if the same class name is reused
  view.classList.add(navDirection === 'back' ? 'enter-back' : 'enter');
  navDirection = 'fwd';
  $('#backBtn').hidden = !v.back;
  fabAction = v.fab || null;
  $('#fab').hidden = !v.fab;
  $('#fab').classList.toggle('alert', !!v.fabAlert);
  const tab = v.tab ?? key;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  const route = key + '/' + (id || '');
  if (route !== lastRoute) { window.scrollTo(0, 0); lastRoute = route; }
  if (v.after) v.after();
}
window.addEventListener('hashchange', () => { navCount++; closeSheet(); render(); });
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('BizBook installed'); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

navCount = 0;
render();
