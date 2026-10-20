// ===== ส่วนกลาง: เรียก API, โหมดทดลอง, ตัวช่วยแสดงผล =====

function appError(message, code) {
  const err = new Error(message);
  err.code = code || 'ERROR';
  return err;
}

const Api = {
  async call(action, data) {
    if (CONFIG.DEMO) return Demo.handle(action, data || {});
    let res;
    try {
      // text/plain เพื่อไม่ให้เกิด CORS preflight กับ Apps Script
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action }, data)),
      });
    } catch (e) {
      throw appError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต', 'NETWORK');
    }
    const json = await res.json().catch(() => null);
    if (!json) throw appError('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง', 'SERVER');
    if (!json.ok) throw appError(json.error, json.code);
    return json.data;
  },
};

// โหมดทดลอง: จำลอง backend ด้วย localStorage
const Demo = {
  KEY: 'demo_card_requests',
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; }
  },
  save(rows) {
    try { localStorage.setItem(this.KEY, JSON.stringify(rows)); }
    catch (e) { throw appError('พื้นที่จัดเก็บของเบราว์เซอร์เต็ม (โหมดทดลอง)', 'STORAGE'); }
  },
  pub(r) {
    const copy = Object.assign({}, r);
    delete copy.photo;
    return copy;
  },
  async handle(action, b) {
    await new Promise(r => setTimeout(r, 400));
    const rows = this.load();
    const now = new Date().toISOString();
    const find = id => {
      const r = rows.find(x => x.requestId === id);
      if (!r) throw appError('ไม่พบคำร้อง', 'NOT_FOUND');
      return r;
    };
    switch (action) {
      case 'submit': {
        const active = rows.find(r => !CONFIG.CLOSED_STATUSES.includes(r.status));
        if (active) throw appError('คุณมีคำร้องเลขที่ ' + active.requestId + ' ที่ยังดำเนินการอยู่ กรุณารอให้เสร็จก่อนยื่นใหม่', 'DUPLICATE');
        const d = new Date();
        const day = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        const prefix = 'SC' + day + '-';
        const requestId = prefix + String(rows.filter(r => r.requestId.startsWith(prefix)).length + 1).padStart(4, '0');
        const status = CONFIG.STATUSES[0];
        rows.push({
          requestId, createdAt: now, updatedAt: now, displayName: 'ผู้ทดลองใช้',
          email: b.email, pickupLocation: b.pickupLocation, phone: b.phone, fullName: b.fullName,
          studentId: b.studentId, faculty: b.faculty, reason: b.reason,
          status, note: '', photo: b.photo,
          history: [{ at: now, status, note: 'ยื่นคำร้อง', by: 'ผู้ยื่นคำร้อง' }],
        });
        this.save(rows);
        return { requestId, status };
      }
      case 'myRequests':
      case 'adminList':
        if (action === 'adminList' && b.adminToken !== 'demo-admin') throw appError('กรุณาเข้าสู่ระบบใหม่', 'ADMIN_AUTH');
        return rows.map(r => this.pub(r)).reverse();
      case 'photo':
        return find(b.requestId).photo;
      case 'adminLogin':
        if (b.password !== 'admin') throw appError('รหัสผ่านไม่ถูกต้อง (โหมดทดลองใช้ admin)', 'AUTH');
        return { token: 'demo-admin' };
      case 'adminUpdate': {
        const r = find(b.requestId);
        r.status = b.status;
        r.note = b.note || '';
        r.updatedAt = now;
        r.history.push({ at: now, status: b.status, note: r.note, by: 'ผู้ดูแล' });
        this.save(rows);
        return this.pub(r);
      }
    }
    throw appError('ไม่รู้จักคำสั่งนี้', 'BAD_ACTION');
  },
};

const UI = {
  $: s => document.querySelector(s),

  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  fmt(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  },

  badge(status) {
    const i = CONFIG.STATUSES.indexOf(status);
    return `<span class="badge s${i}">${UI.esc(status)}</span>`;
  },

  fullName(r) {
    return r.fullName || '';
  },

  historyHtml(history) {
    return `<ol class="timeline">${(history || []).slice().reverse().map(h => `
      <li>
        <div class="tl-head">${UI.badge(h.status)} <span class="muted">${UI.esc(UI.fmt(h.at))} · ${UI.esc(h.by || '')}</span></div>
        ${h.note ? `<div class="tl-note">${UI.esc(h.note)}</div>` : ''}
      </li>`).join('')}</ol>`;
  },

  toast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'show ' + (type || '');
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(() => { el.className = ''; }, 4000);
  },

  initTheme(btn) {
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    if (saved) root.dataset.theme = saved;
    const isDark = () => root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const label = () => { btn.textContent = isDark() ? '☀️' : '🌙'; btn.title = isDark() ? 'โหมดสว่าง' : 'โหมดมืด'; };
    label();
    btn.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* ignore */ }
      label();
    });
  },

  demoBanner() {
    if (!CONFIG.DEMO) return;
    const b = document.createElement('div');
    b.className = 'demo-banner';
    b.textContent = 'โหมดทดลอง — ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น (ตั้งค่า API_URL ใน config.js เพื่อใช้งานจริง)';
    document.body.prepend(b);
  },
};
