// ===== หน้าผู้ดูแล =====
const $ = UI.$;
let adminToken = null;
let allRows = [];
let statusFilter = '';
let current = null;
let refreshTimer = null;

function init() {
  UI.initTheme($('#themeBtn'));
  UI.demoBanner();
  $('#facultyFilter').insertAdjacentHTML('beforeend',
    CONFIG.FACULTIES.map(f => `<option>${UI.esc(f)}</option>`).join(''));
  $('#pickupFilter').insertAdjacentHTML('beforeend',
    CONFIG.PICKUP_LOCATIONS.map(p => `<option>${UI.esc(p)}</option>`).join(''));
  try { $('#sortBy').value = localStorage.getItem('adminSort') || 'pickup'; } catch (e) { /* ignore */ }
  $('#dlgStatus').innerHTML = CONFIG.STATUSES.map(s => `<option>${UI.esc(s)}</option>`).join('');

  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', logout);
  $('#refreshBtn').addEventListener('click', () => load());
  $('#exportBtn').addEventListener('click', exportCsv);
  $('#search').addEventListener('input', render);
  $('#facultyFilter').addEventListener('change', render);
  $('#pickupFilter').addEventListener('change', render);
  $('#sortBy').addEventListener('change', () => {
    try { localStorage.setItem('adminSort', $('#sortBy').value); } catch (e) { /* ignore */ }
    render();
  });
  $('#dlgClose').addEventListener('click', () => $('#dlg').close());
  $('#updateForm').addEventListener('submit', onUpdate);
  $('#notifyBtn').addEventListener('click', onNotify);

  try { adminToken = sessionStorage.getItem('adminToken'); } catch (e) { /* ignore */ }
  if (adminToken) enterDashboard();
}

async function adminCall(action, data) {
  try {
    return await Api.call(action, Object.assign({ adminToken }, data));
  } catch (e) {
    if (e.code === 'ADMIN_AUTH') logout();
    throw e;
  }
}

async function onLogin(e) {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  try {
    const res = await Api.call('adminLogin', { password: $('#password').value });
    adminToken = res.token;
    try { sessionStorage.setItem('adminToken', adminToken); } catch (err) { /* ignore */ }
    $('#password').value = '';
    enterDashboard();
  } catch (err) {
    UI.toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function enterDashboard() {
  $('#loginView').hidden = true;
  $('#dashView').hidden = false;
  $('#logoutBtn').hidden = false;
  load();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => { if (!document.hidden && !$('#dlg').open) load(true); }, CONFIG.REFRESH_SECONDS * 1000);
}

function logout() {
  adminToken = null;
  try { sessionStorage.removeItem('adminToken'); } catch (e) { /* ignore */ }
  clearInterval(refreshTimer);
  if ($('#dlg').open) $('#dlg').close();
  $('#loginView').hidden = false;
  $('#dashView').hidden = true;
  $('#logoutBtn').hidden = true;
}

async function load(silent) {
  if (!silent) $('#rows').innerHTML = '<tr><td colspan="7"><div class="spinner"></div></td></tr>';
  try {
    allRows = await adminCall('adminList');
    $('#lastUpdated').textContent = 'อัปเดตล่าสุด ' + UI.fmt(new Date().toISOString()) +
      ` · รีเฟรชอัตโนมัติทุก ${CONFIG.REFRESH_SECONDS} วินาที`;
    render();
  } catch (err) {
    if (!silent) UI.toast(err.message, 'error');
  }
}

function filtered() {
  const q = $('#search').value.trim().toLowerCase();
  const fac = $('#facultyFilter').value;
  const pickup = $('#pickupFilter').value;
  const rows = allRows.filter(r =>
    (!statusFilter || r.status === statusFilter) &&
    (!fac || r.faculty === fac) &&
    (!pickup || r.pickupLocation === pickup) &&
    (!q || [r.requestId, r.fullName, r.studentId, r.email, r.phone, r.faculty, r.pickupLocation, r.displayName]
      .join(' ').toLowerCase().includes(q)));
  return sortRows(rows);
}

/** เรียงตามสถานที่รับบัตร (ตามลำดับใน config) แล้วตามวันที่ยื่นล่าสุด หรือเรียงตามวันที่อย่างเดียว */
function sortRows(rows) {
  const by = $('#sortBy').value;
  const time = r => new Date(r.createdAt).getTime() || 0;
  const place = r => {
    const i = CONFIG.PICKUP_LOCATIONS.indexOf(r.pickupLocation);
    return i < 0 ? CONFIG.PICKUP_LOCATIONS.length : i;
  };
  return rows.slice().sort((a, b) => {
    if (by === 'oldest') return time(a) - time(b);
    if (by === 'pickup' && place(a) !== place(b)) return place(a) - place(b);
    return time(b) - time(a);
  });
}

function render() {
  const counts = {};
  allRows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const stat = (key, label, n, cls) => `
    <button type="button" class="stat ${statusFilter === key ? 'active' : ''}" data-status="${UI.esc(key)}">
      <div class="num" ${cls != null ? `style="color:var(--s${cls})"` : ''}>${n}</div>
      <div class="lbl">${UI.esc(label)}</div>
    </button>`;
  $('#stats').innerHTML = stat('', 'ทั้งหมด', allRows.length, null) +
    CONFIG.STATUSES.map((s, i) => stat(s, s, counts[s] || 0, i)).join('');
  $('#stats').querySelectorAll('.stat').forEach(b => b.addEventListener('click', () => {
    statusFilter = b.dataset.status;
    render();
  }));

  const rows = filtered();
  $('#emptyBox').hidden = rows.length > 0;
  const grouped = $('#sortBy').value === 'pickup';
  const groupCount = {};
  rows.forEach(r => { groupCount[r.pickupLocation] = (groupCount[r.pickupLocation] || 0) + 1; });
  let lastPlace = null;
  $('#rows').innerHTML = rows.map(r => {
    let head = '';
    if (grouped && r.pickupLocation !== lastPlace) {
      lastPlace = r.pickupLocation;
      head = `<tr class="group-row"><td colspan="7">📍 ${UI.esc(r.pickupLocation || 'ไม่ระบุสถานที่')}
        <span class="muted small">(${groupCount[r.pickupLocation]} รายการ)</span></td></tr>`;
    }
    return head + `
    <tr data-id="${UI.esc(r.requestId)}">
      <td data-label="เลขที่"><span class="req-id">${UI.esc(r.requestId)}</span></td>
      <td data-label="ชื่อ">${UI.esc(UI.fullName(r))}</td>
      <td data-label="รหัสนักศึกษา">${UI.esc(r.studentId)}</td>
      <td data-label="คณะ">${UI.esc(r.faculty)}</td>
      <td data-label="รับบัตรที่">${UI.esc(r.pickupLocation)}</td>
      <td data-label="วันที่ยื่น">${UI.esc(UI.fmt(r.createdAt))}</td>
      <td>${UI.badge(r.status)}</td>
    </tr>`;
  }).join('');
  $('#rows').querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', () => openDetail(tr.dataset.id)));
}

async function openDetail(id) {
  current = allRows.find(r => r.requestId === id);
  if (!current) return;
  const r = current;
  $('#dlgTitle').textContent = r.requestId;
  $('#dlgBadge').innerHTML = UI.badge(r.status);
  $('#dlgInfo').innerHTML = `
    <dt>ชื่อ</dt><dd>${UI.esc(UI.fullName(r))}</dd>
    <dt>รหัส นศ.</dt><dd>${UI.esc(r.studentId)}</dd>
    <dt>คณะวิชา</dt><dd>${UI.esc(r.faculty)}</dd>
    <dt>Faculty</dt><dd>${UI.esc(CONFIG.FACULTIES_EN[r.faculty] || '-')}</dd>
    <dt>รับบัตรที่</dt><dd>${UI.esc(r.pickupLocation)}</dd>
    <dt>โทรศัพท์</dt><dd><a href="tel:${UI.esc(r.phone)}">${UI.esc(r.phone)}</a></dd>
    <dt>อีเมล</dt><dd><a href="mailto:${UI.esc(r.email)}">${UI.esc(r.email)}</a></dd>
    <dt>เหตุผล</dt><dd>${UI.esc(r.reason)}</dd>
    <dt>LINE</dt><dd>${UI.esc(r.displayName || '-')}</dd>
    <dt>วันที่ยื่น</dt><dd>${UI.esc(UI.fmt(r.createdAt))}</dd>
    <dt>อัปเดต</dt><dd>${UI.esc(UI.fmt(r.updatedAt))}</dd>`;
  $('#dlgStatus').value = r.status;
  $('#dlgNote').value = '';
  $('#dlgHistory').innerHTML = UI.historyHtml(r.history);
  $('#dlgPhoto').innerHTML = '<div class="spinner"></div>';
  $('#dlgDownload').hidden = true;
  $('#dlg').showModal();

  try {
    const src = await adminCall('photo', { requestId: id });
    if (current !== r) return;
    $('#dlgPhoto').innerHTML = `<img src="${UI.esc(src)}" alt="รูปถ่ายของ ${UI.esc(UI.fullName(r))}">`;
    const dl = $('#dlgDownload');
    dl.href = src;
    dl.download = `${r.studentId}.${src.startsWith('data:image/png') ? 'png' : 'jpg'}`;
    dl.hidden = false;
  } catch (err) {
    $('#dlgPhoto').innerHTML = '<span class="muted small">โหลดรูปไม่สำเร็จ</span>';
  }
}

/** ปุ่ม "บันทึก": เก็บสถานะ/หมายเหตุ โดยไม่ส่ง LINE */
async function onUpdate(e) {
  e.preventDefault();
  if (!current) return;
  const status = $('#dlgStatus').value;
  const note = $('#dlgNote').value.trim();
  if (status === current.status && !note) {
    UI.toast('กรุณาเปลี่ยนสถานะหรือใส่หมายเหตุ', 'error');
    return;
  }
  await submitUpdate('adminUpdate', { requestId: current.requestId, status, note, notify: false },
    $('#saveBtn'), id => `บันทึก ${id} แล้ว (ยังไม่ได้แจ้ง LINE)`);
}

/** ปุ่ม "แจ้งเตือน": ถ้ามีการเปลี่ยนให้บันทึกพร้อมแจ้ง ไม่งั้นส่งแจ้งสถานะปัจจุบันซ้ำ */
async function onNotify() {
  if (!current) return;
  const status = $('#dlgStatus').value;
  const note = $('#dlgNote').value.trim();
  const changed = status !== current.status || note;
  if (!changed && !confirm(`ส่งแจ้งเตือนสถานะ "${current.status}" ถึงผู้ยื่นอีกครั้งใช่ไหม`)) return;
  await submitUpdate(changed ? 'adminUpdate' : 'adminNotify',
    { requestId: current.requestId, status, note, notify: true },
    $('#notifyBtn'), id => `แจ้งเตือน ${id} ทาง LINE แล้ว`);
}

async function submitUpdate(action, data, btn, doneMsg) {
  const label = btn.textContent;
  $('#saveBtn').disabled = $('#notifyBtn').disabled = true;
  btn.textContent = 'กำลังดำเนินการ...';
  try {
    const updated = await adminCall(action, data);
    const i = allRows.findIndex(r => r.requestId === updated.requestId);
    if (i >= 0) allRows[i] = updated;
    $('#dlg').close();
    render();
    UI.toast(doneMsg(updated.requestId), 'success');
  } catch (err) {
    UI.toast(err.message, 'error');
  } finally {
    $('#saveBtn').disabled = $('#notifyBtn').disabled = false;
    btn.textContent = label;
  }
}

function exportCsv() {
  const rows = filtered();
  const head = ['เลขที่คำร้อง', 'วันที่ยื่น', 'อีเมล', 'สถานที่รับบัตรนักศึกษา', 'เบอร์โทรศัพท์',
    'คำนำหน้า ชื่อ - นามสกุล', 'รหัสนักศึกษา', 'คณะวิชา', 'Faculty', 'เหตุผลในการขอทำบัตรนักศึกษา',
    'สถานะ', 'หมายเหตุ', 'อัปเดตล่าสุด', 'ชื่อ LINE'];
  const cell = v => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [head.map(cell).join(',')].concat(rows.map(r => [
    r.requestId, UI.fmt(r.createdAt), r.email, r.pickupLocation, r.phone,
    r.fullName, r.studentId, r.faculty, CONFIG.FACULTIES_EN[r.faculty] || '', r.reason,
    r.status, r.note, UI.fmt(r.updatedAt), r.displayName,
  ].map(cell).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `คำร้องบัตรนักศึกษา_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

init();
