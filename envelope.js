// ===== หน้าพิมพ์ใบแปะซอง: 1 สถานที่รับบัตร = 1 หน้า =====
const $ = UI.$;
const ENV = CONFIG.ENVELOPE || {};
let adminToken = null;
let allRows = [];
const statuses = new Set(['บัตรพร้อมรับ']);
const places = new Set(CONFIG.PICKUP_LOCATIONS.filter(p => !(ENV.SKIP || []).includes(p)));
const excluded = new Set();

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
};

function init() {
  UI.initTheme($('#themeBtn'));
  UI.demoBanner();
  $('#sender').value = store.get('envSender', ENV.SENDER || '');
  $('#sender').addEventListener('input', () => { store.set('envSender', $('#sender').value); render(); });
  $('#printBtn').addEventListener('click', () => window.print());
  $('#reloadBtn').addEventListener('click', load);
  $('#loginForm').addEventListener('submit', onLogin);

  $('#statusChips').innerHTML = CONFIG.STATUSES.map(s => chip('status', s, statuses.has(s))).join('');
  $('#placeChips').innerHTML = CONFIG.PICKUP_LOCATIONS.map(p => chip('place', p, places.has(p))).join('');
  document.querySelectorAll('#statusChips input, #placeChips input').forEach(cb => cb.addEventListener('change', () => {
    const set = cb.name === 'status' ? statuses : places;
    cb.checked ? set.add(cb.value) : set.delete(cb.value);
    render();
  }));

  try { adminToken = sessionStorage.getItem('adminToken'); } catch (e) { /* ignore */ }
  if (CONFIG.DEMO) adminToken = adminToken || 'demo-admin';
  adminToken ? load() : show('loginView');
}

function chip(name, value, checked) {
  return `<label class="chip"><input type="checkbox" name="${name}" value="${UI.esc(value)}" ${checked ? 'checked' : ''}><span>${UI.esc(value)}</span></label>`;
}

function show(view) {
  $('#loginView').hidden = view !== 'loginView';
  $('#setupView').hidden = view !== 'setupView';
}

async function onLogin(e) {
  e.preventDefault();
  try {
    const res = await Api.call('adminLogin', { password: $('#password').value });
    adminToken = res.token;
    try { sessionStorage.setItem('adminToken', adminToken); } catch (err) { /* ignore */ }
    $('#password').value = '';
    load();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function load() {
  show('setupView');
  $('#sheets').innerHTML = '<div class="spinner"></div>';
  try {
    allRows = await Api.call('adminList', { adminToken });
    render();
  } catch (err) {
    if (err.code === 'ADMIN_AUTH') {
      adminToken = null;
      $('#sheets').innerHTML = '';
      show('loginView');
    }
    UI.toast(err.message, 'error');
  }
}

function recipientFor(place) {
  const saved = store.get('envRecipients', {})[place] || {};
  const def = (ENV.RECIPIENTS || {})[place] || {};
  return { name: saved.name != null ? saved.name : (def.name || ''), place: saved.place != null ? saved.place : (def.place || place) };
}

function saveRecipient(place, field, value) {
  const all = store.get('envRecipients', {});
  all[place] = Object.assign(recipientFor(place), { [field]: value.trim() });
  store.set('envRecipients', all);
}

function render() {
  const rows = allRows.filter(r => statuses.has(r.status) && places.has(r.pickupLocation));
  const groups = CONFIG.PICKUP_LOCATIONS
    .map(p => ({ place: p, rows: rows.filter(r => r.pickupLocation === p).sort((a, b) => String(a.studentId).localeCompare(String(b.studentId))) }))
    .filter(g => g.rows.length);
  const included = rows.filter(r => !excluded.has(r.requestId)).length;
  $('#summary').textContent = `${groups.length} ใบ · ${included} คน`;

  if (!groups.length) {
    $('#sheets').innerHTML = '<div class="card empty no-print">ไม่มีคำร้องตามเงื่อนไขที่เลือก</div>';
    return;
  }
  const sender = $('#sender').value.trim();
  $('#sheets').innerHTML = groups.map(g => {
    const to = recipientFor(g.place);
    let no = 0;
    const body = g.rows.map(r => {
      const off = excluded.has(r.requestId);
      if (!off) no++;
      return `<tr class="${off ? 'off' : ''}">
        <td class="no">${off ? '' : no}</td>
        <td>${UI.esc(r.fullName)}</td>
        <td class="sid">${UI.esc(r.studentId)}</td>
        <td class="tel">${UI.esc(r.phone)}</td>
        <td class="pick no-print"><input type="checkbox" data-id="${UI.esc(r.requestId)}" ${off ? '' : 'checked'} title="รวมในใบนี้"></td>
      </tr>`;
    }).join('');
    return `<section class="sheet" data-place="${UI.esc(g.place)}">
      <div class="to">
        <div class="name" contenteditable="true" data-field="name" data-placeholder="คลิกเพื่อใส่ชื่อผู้รับ">${UI.esc(to.name)}</div>
        <div class="place" contenteditable="true" data-field="place" data-placeholder="คลิกเพื่อใส่หน่วยงาน">${UI.esc(to.place)}</div>
        <div class="count no-print">${no} คน · ${UI.esc(g.place)}</div>
      </div>
      <table>
        <thead><tr><th></th><th>ชื่อ - นามสกุล</th><th>รหัสนักศึกษา</th><th>เบอร์โทรติดต่อ</th><th class="pick no-print"></th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="from">${UI.esc(sender)}</div>
    </section>`;
  }).join('');

  $('#sheets').querySelectorAll('[contenteditable]').forEach(el => el.addEventListener('input', () => {
    saveRecipient(el.closest('.sheet').dataset.place, el.dataset.field, el.textContent);
  }));
  $('#sheets').querySelectorAll('input[data-id]').forEach(cb => cb.addEventListener('change', () => {
    cb.checked ? excluded.delete(cb.dataset.id) : excluded.add(cb.dataset.id);
    render();
  }));
}

init();
