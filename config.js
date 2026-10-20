// ===== ตั้งค่าระบบ =====
// API_URL: URL ของ Web App จาก Google Apps Script (ลงท้ายด้วย /exec)
// LIFF_ID: LIFF ID จาก LINE Developers (เช่น 2001234567-AbCdEfGh)
// ถ้าเว้น API_URL ว่างไว้ ระบบจะทำงานใน "โหมดทดลอง" (เก็บข้อมูลในเบราว์เซอร์นี้เท่านั้น, รหัสผู้ดูแล = admin)
window.CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzAaxW2ClRglfpwfUsc6T7MqHjrdTfi5r1CmnThSRrCt8e1BNVJX72WAA-JvZutpYQH4A/exec',
  LIFF_ID: '2012119896-WX54sK1D',

  // ต้องตรงกับ PICKUP_LOCATIONS ใน Code.gs
  PICKUP_LOCATIONS: [
    'กองบริหารงานวิชาการ พระราชวังสนามจันทร์',
    'กองบริหารงานวิชาการ วังท่าพระ',
    'กองบริหารงานวิชาการ เพชรบุรี',
    'คณะเทคโนโลยีสารสนเทศ เมืองทองธานี',
    'คณะวิทยาการจัดการ บางรัก',
    'คณะวิทยาการจัดการ เมืองทองธานี',
  ],

  FACULTIES: [
    'คณะจิตรกรรม ประติมากรรมและภาพพิมพ์',
    'คณะสถาปัตยกรรมศาสตร์',
    'คณะโบราณคดี',
    'คณะมัณฑนศิลป์',
    'คณะอักษรศาสตร์',
    'คณะศึกษาศาสตร์',
    'คณะวิทยาศาสตร์',
    'คณะเภสัชศาสตร์',
    'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
    'คณะดุริยางคศาสตร์',
    'คณะสัตวศาสตร์และเทคโนโลยีการเกษตร',
    'คณะวิทยาการจัดการ',
    'คณะเทคโนโลยีสารสนเทศและการสื่อสาร',
    'วิทยาลัยนานาชาติ',
    'คณะสหเวชศาสตร์',
  ],

  // ชื่อคณะภาษาอังกฤษ (แสดงในหน้าผู้ดูแล)
  FACULTIES_EN: {
    'คณะจิตรกรรม ประติมากรรมและภาพพิมพ์': 'Faculty of Painting Sculpture and Graphic Arts',
    'คณะสถาปัตยกรรมศาสตร์': 'Faculty of Architecture',
    'คณะโบราณคดี': 'Faculty of Archaeology',
    'คณะมัณฑนศิลป์': 'Faculty of Decorative Arts',
    'คณะอักษรศาสตร์': 'Faculty of Arts',
    'คณะศึกษาศาสตร์': 'Faculty of Education',
    'คณะวิทยาศาสตร์': 'Faculty of Science',
    'คณะเภสัชศาสตร์': 'Faculty of Pharmacy',
    'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม': 'Faculty of Engineering and Industrial Technology',
    'คณะดุริยางคศาสตร์': 'Faculty of Music',
    'คณะสัตวศาสตร์และเทคโนโลยีการเกษตร': 'Faculty of Animal Sciences and Agricultural Technology',
    'คณะวิทยาการจัดการ': 'Faculty of Management Sciences',
    'คณะเทคโนโลยีสารสนเทศและการสื่อสาร': 'Faculty of Information and Communication Technology',
    'วิทยาลัยนานาชาติ': 'International College',
    'คณะสหเวชศาสตร์': 'Faculty of Allied Health Sciences',
  },

  // ต้องตรงกับ STATUSES ใน Code.gs
  STATUSES: ['รอตรวจสอบ', 'รับเรื่องแล้ว', 'กำลังจัดทำบัตร', 'บัตรพร้อมรับ', 'รับบัตรแล้ว', 'ไม่อนุมัติ'],
  CLOSED_STATUSES: ['รับบัตรแล้ว', 'ไม่อนุมัติ'],

  REFRESH_SECONDS: 30,
};
CONFIG.DEMO = !CONFIG.API_URL;
