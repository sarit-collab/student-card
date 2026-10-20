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
  $('#dlgStatus').innerHTML = CONFIG.STATUSES.map(s => `<option>${UI.esc(s)}</option>`).join('');

  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', logout);
  $('#refreshBtn').addEventListener('click', () => load());
  $('#exportBtn').addEventListener('click', exportCsv);
  $('#search').addEventListener('input', render);
  $('#facultyFilter').addEventListener('change', render);
  $('#dlgClose').addEventListener('click', () => $('#dlg').close());
  $('#updateForm').addEventListener('submit', onUpdate);

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
  if (!silent) $('#rows').innerHTML = '<tr><td colspan="6"><div class="spinner"></div></td></tr>';
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
  return allRows.filter(r =>
    (!statusFilter || r.status === statusFilter) &&
    (!fac || r.faculty === fac) &&
    (!q || [r.requestId, r.fullName, r.studentId, r.email, r.phone, r.faculty, r.displayName]
      .join(' ').toLowerCase().includes(q)));
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
  $('#rows').innerHTML = rows.map(r => `
    <tr data-id="${UI.esc(r.requestId)}">
      <td data-label="เลขที่"><span class="req-id">${UI.esc(r.requestId)}</span></td>
      <td data-label="ชื่อ">${UI.esc(UI.fullName(r))}</td>
      <td data-label="รหัสนักศึกษา">${UI.esc(r.studentId)}</td>
      <td data-label="คณะ">${UI.esc(r.faculty)}</td>
      <td data-label="วันที่ยื่น">${UI.esc(UI.fmt(r.createdAt))}</td>
      <td>${UI.badge(r.status)}</td>
    </tr>`).join('');
  $('#rows').querySelectorAll('tr').forEach(tr => tr.addEventListener('click', () => openDetail(tr.dataset.id)));
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

async function onUpdate(e) {
  e.preventDefault();
  if (!current) return;
  const status = $('#dlgStatus').value;
  const note = $('#dlgNote').value.trim();
  if (status === current.status && !note) {
    UI.toast('กรุณาเปลี่ยนสถานะหรือใส่หมายเหตุ', 'error');
    return;
  }
  const btn = $('#saveBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';
  try {
    const updated = await adminCall('adminUpdate', { requestId: current.requestId, status, note });
    const i = allRows.findIndex(r => r.requestId === updated.requestId);
    if (i >= 0) allRows[i] = updated;
    $('#dlg').close();
    render();
    UI.toast(`บันทึกแล้ว — แจ้งเตือน ${updated.requestId} ทาง LINE`, 'success');
  } catch (err) {
    UI.toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'บันทึกและแจ้งเตือนผู้ยื่น';
  }
}

function exportCsv() {
  const rows = filtered();
  const head = ['เลขที่คำร้อง', 'วันที่ยื่น', 'อีเมล', 'สถานที่รับบัตรนักศึกษา', 'เบอร์โทรศัพท์',
    'คำนำหน้า ชื่อ - นามสกุล', 'รหัสนักศึกษา', 'คณะวิชา', 'เหตุผลในการขอทำบัตรนักศึกษา',
    'สถานะ', 'หมายเหตุ', 'อัปเดตล่าสุด', 'ชื่อ LINE'];
  const cell = v => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [head.map(cell).join(',')].concat(rows.map(r => [
    r.requestId, UI.fmt(r.createdAt), r.email, r.pickupLocation, r.phone,
    r.fullName, r.studentId, r.faculty, r.reason,
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
