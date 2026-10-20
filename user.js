// ===== หน้าผู้ยื่นคำร้อง (เปิดผ่าน LIFF ใน LINE) =====
const $ = UI.$;
let idToken = null;
let photoData = null;
let myRows = [];

async function init() {
  UI.initTheme($('#themeBtn'));
  UI.demoBanner();
  fillOptions();
  bindEvents();

  if (CONFIG.DEMO) {
    idToken = 'demo-user';
    showApp({ displayName: 'ผู้ทดลองใช้' });
    return;
  }
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });
    if (!liff.isLoggedIn()) {
      show('loginView');
      return;
    }
    idToken = liff.getIDToken();
    // ถ้า LINE Login channel ได้รับสิทธิ์ email ให้กรอกอีเมลไว้ให้ก่อน
    const decoded = liff.getDecodedIDToken();
    if (decoded && decoded.email) $('#email').value = decoded.email;
    const profile = await liff.getProfile();
    showApp(profile);
  } catch (e) {
    show('loginView');
    UI.toast('เริ่มต้น LINE ไม่สำเร็จ: ' + e.message, 'error');
  }
}

function show(view) {
  ['loadingView', 'loginView', 'appView'].forEach(v => { $('#' + v).hidden = v !== view; });
}

function showApp(profile) {
  $('#userBox').innerHTML =
    (profile.pictureUrl ? `<img src="${UI.esc(profile.pictureUrl)}" alt="">` : '') +
    `<span>${UI.esc(profile.displayName)}</span>`;
  show('appView');
  // ?tab=mine (ใช้จากปุ่ม "ติดตามสถานะ" ใน Rich menu) เปิดแท็บคำร้องของฉันทันที
  if (new URLSearchParams(location.search).get('tab') === 'mine') switchTab('mine');
  loadMine();
  setInterval(() => { if (!document.hidden) loadMine(true); }, CONFIG.REFRESH_SECONDS * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadMine(true); });
}

async function callUser(action, data) {
  try {
    return await Api.call(action, Object.assign({ idToken }, data));
  } catch (e) {
    if (e.code === 'TOKEN_EXPIRED' && !CONFIG.DEMO) {
      // ล็อกอินใหม่ได้ครั้งเดียวต่อนาที กันวนลูปถ้าตั้งค่า channel ผิด
      let last = 0;
      try { last = Number(sessionStorage.getItem('relogin_at')) || 0; } catch (err) { /* ignore */ }
      if (Date.now() - last > 60000) {
        try { sessionStorage.setItem('relogin_at', String(Date.now())); } catch (err) { /* ignore */ }
        liff.logout();
        liff.login({ redirectUri: location.href });
      } else {
        UI.toast('ยืนยันตัวตน LINE ไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ', 'error');
      }
    }
    throw e;
  }
}

function fillOptions() {
  $('#pickupList').innerHTML = CONFIG.PICKUP_LOCATIONS.map(p =>
    `<label><input type="radio" name="pickup" value="${UI.esc(p)}"><span>${UI.esc(p)}</span></label>`).join('');
  $('#faculty').insertAdjacentHTML('beforeend',
    CONFIG.FACULTIES.map(f => `<option>${UI.esc(f)}</option>`).join(''));
}

function bindEvents() {
  $('#loginBtn').addEventListener('click', () => liff.login({ redirectUri: location.href }));

  document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  $('#photoInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      UI.toast('กรุณาเลือกไฟล์รูปภาพ', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      UI.toast('ไฟล์ใหญ่เกินไป (ขนาดสูงสุด 10 MB)', 'error');
      return;
    }
    try {
      // แปลงเป็น JPEG และย่อขนาด (พอสำหรับพิมพ์รูป 2 นิ้ว)
      photoData = await resizeImage(file, 1200, 0.9);
      $('#photoPreview').innerHTML = `<img src="${photoData}" alt="ตัวอย่างรูป">`;
      $('#photoName').textContent = file.name;
      clearError($('#photoInput'));
    } catch (err) {
      photoData = null;
      UI.toast('อ่านไฟล์รูปไม่สำเร็จ กรุณาใช้ไฟล์ JPG หรือ PNG', 'error');
    }
  });

  $('#reqForm').addEventListener('submit', onSubmit);
  $('#reqForm').addEventListener('input', e => clearError(e.target));
  $('#reqForm').addEventListener('change', e => clearError(e.target));
  $('#clearBtn').addEventListener('click', () => {
    if (confirm('ล้างคำตอบทั้งหมดในแบบฟอร์มใช่ไหม')) resetForm();
  });
}

function resetForm() {
  $('#reqForm').reset();
  photoData = null;
  $('#photoPreview').textContent = '📷';
  $('#photoName').textContent = 'อัปโหลดไฟล์รูปภาพ 1 รายการ ขนาดสูงสุด 10 MB';
  document.querySelectorAll('.q-card.invalid').forEach(c => clearError(c));
}

function setError(el, msg) {
  const card = el.closest('.q-card');
  card.classList.add('invalid');
  let err = card.querySelector('.err');
  if (!err) {
    err = document.createElement('div');
    err.className = 'err';
    card.appendChild(err);
  }
  err.textContent = '⚠ ' + msg;
}

function clearError(el) {
  const card = el && el.closest && el.closest('.q-card');
  if (!card) return;
  card.classList.remove('invalid');
  const err = card.querySelector('.err');
  if (err) err.remove();
}

function switchTab(tab) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#tab-form').hidden = tab !== 'form';
  $('#tab-mine').hidden = tab !== 'mine';
  if (tab === 'mine') loadMine(true);
}

/** ย่อรูปให้ด้านยาวไม่เกิน maxSide px แล้วแปลงเป็น JPEG data URL */
function resizeImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function onSubmit(e) {
  e.preventDefault();
  const pickupEl = document.querySelector('input[name="pickup"]:checked');
  const data = {
    email: $('#email').value.trim(),
    pickupLocation: pickupEl ? pickupEl.value : '',
    phone: $('#phone').value.replace(/[\s-]/g, ''),
    fullName: $('#fullName').value.trim(),
    studentId: $('#studentId').value.trim(),
    faculty: $('#faculty').value,
    photo: photoData,
    reason: $('#reason').value.trim(),
  };
  const REQUIRED = 'นี่เป็นคำถามที่จำเป็น';
  const checks = [
    [$('#email'), !data.email ? REQUIRED : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? 'รูปแบบอีเมลไม่ถูกต้อง' : ''],
    [$('#pickupList'), data.pickupLocation ? '' : REQUIRED],
    [$('#phone'), !data.phone ? REQUIRED : !/^0\d{8,9}$/.test(data.phone) ? 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก ขึ้นต้นด้วย 0' : ''],
    [$('#fullName'), data.fullName ? '' : REQUIRED],
    [$('#studentId'), !data.studentId ? REQUIRED : !/^\d{8,12}$/.test(data.studentId) ? 'รหัสนักศึกษาต้องเป็นตัวเลข' : ''],
    [$('#faculty'), data.faculty ? '' : REQUIRED],
    [$('#photoInput'), data.photo ? '' : REQUIRED],
    [$('#reason'), data.reason ? '' : REQUIRED],
  ];
  let firstBad = null;
  checks.forEach(([el, msg]) => {
    if (msg) {
      setError(el, msg);
      firstBad = firstBad || el;
    } else {
      clearError(el);
    }
  });
  if (firstBad) {
    firstBad.closest('.q-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = $('#submitBtn');
  btn.disabled = true;
  btn.textContent = 'กำลังส่งคำร้อง...';
  try {
    const res = await callUser('submit', data);
    resetForm();
    const box = $('#successBox');
    box.innerHTML = `✅ ส่งคำร้องเรียบร้อยแล้ว<br>เลขที่คำร้อง <b>${UI.esc(res.requestId)}</b> — ระบบจะแจ้งเตือนสถานะทาง LINE`;
    box.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadMine(true);
  } catch (err) {
    UI.toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'ส่ง';
  }
}

async function loadMine(silent) {
  const list = $('#mineList');
  if (!silent && !myRows.length) list.innerHTML = '<div class="spinner"></div>';
  try {
    const rows = await callUser('myRequests');
    if (silent && JSON.stringify(rows) === JSON.stringify(myRows)) return;
    myRows = rows;
    renderMine();
  } catch (err) {
    if (!silent) list.innerHTML = `<div class="empty">${UI.esc(err.message)}</div>`;
  }
}

function renderMine() {
  const active = myRows.find(r => !CONFIG.CLOSED_STATUSES.includes(r.status));
  const count = $('#mineCount');
  count.hidden = !myRows.length;
  count.textContent = myRows.length;

  // มีคำร้องค้างอยู่ → ปิดฟอร์มชั่วคราว
  $('#activeBox').hidden = !active;
  $('#reqForm').hidden = !!active;
  if (active) {
    $('#activeBox').innerHTML = `คุณมีคำร้องเลขที่ <b>${UI.esc(active.requestId)}</b> สถานะ ${UI.badge(active.status)}<br>` +
      `<span class="small">สามารถยื่นคำร้องใหม่ได้เมื่อคำร้องเดิมเสร็จสิ้น — <a href="#" id="goMine">ดูรายละเอียด</a></span>`;
    $('#goMine').addEventListener('click', ev => { ev.preventDefault(); switchTab('mine'); });
  }

  const list = $('#mineList');
  if (!myRows.length) {
    list.innerHTML = '<div class="card empty">ยังไม่มีคำร้อง</div>';
    return;
  }
  const openIds = [...list.querySelectorAll('details[open]')].map(d => d.dataset.id);
  const flow = CONFIG.STATUSES.filter(s => s !== 'ไม่อนุมัติ');
  list.innerHTML = myRows.map(r => {
    const rejected = r.status === 'ไม่อนุมัติ';
    const idx = flow.indexOf(r.status);
    const steps = rejected ? '' : `<div class="steps">${flow.map((s, i) =>
      `<div class="step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}">${UI.esc(s)}</div>`).join('')}</div>`;
    return `
      <article class="card req-card">
        <div class="head">
          <div>
            <div class="req-id">${UI.esc(r.requestId)}</div>
            <div class="muted small">ยื่นเมื่อ ${UI.esc(UI.fmt(r.createdAt))}</div>
          </div>
          ${UI.badge(r.status)}
        </div>
        ${steps}
        <div style="margin-top:8px">${UI.esc(UI.fullName(r))} · ${UI.esc(r.studentId)}</div>
        <div class="muted small">${UI.esc(r.faculty)}</div>
        <div class="muted small">สถานที่รับบัตร: ${UI.esc(r.pickupLocation)}</div>
        ${r.note ? `<div class="note-box">หมายเหตุจากเจ้าหน้าที่: ${UI.esc(r.note)}</div>` : ''}
        <details data-id="${UI.esc(r.requestId)}">
          <summary>ประวัติสถานะและรูปถ่าย</summary>
          ${UI.historyHtml(r.history)}
          <div class="photo-slot muted small">กำลังโหลดรูป...</div>
        </details>
      </article>`;
  }).join('');

  list.querySelectorAll('details').forEach(d => d.addEventListener('toggle', async () => {
    const slot = d.querySelector('.photo-slot');
    if (!d.open || slot.dataset.loaded) return;
    slot.dataset.loaded = '1';
    try {
      const src = await callUser('photo', { requestId: d.dataset.id });
      slot.innerHTML = `<img class="thumb" src="${UI.esc(src)}" alt="รูปถ่ายที่แนบ">`;
    } catch (err) {
      slot.textContent = 'โหลดรูปไม่สำเร็จ';
      delete slot.dataset.loaded;
    }
  }));
  list.querySelectorAll('details').forEach(d => { if (openIds.includes(d.dataset.id)) d.open = true; });
}

init();
