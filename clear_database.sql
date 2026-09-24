-- ==============================================================================
-- Yeum-IT Database Cleanup Script (สำหรับล้างข้อมูลทดสอบก่อนใช้งานจริง)
-- ==============================================================================
-- คำแนะนำ: คัดลอกข้อความด้านล่างนี้ไปวางใน Supabase Dashboard -> SQL Editor แล้วกด Run

-- 1. ล้างข้อมูลประวัติการยืม-คืนทั้งหมด
TRUNCATE TABLE transactions CASCADE;

-- 2. ล้างข้อมูลอุปกรณ์จำลอง/อุปกรณ์ทดสอบทั้งหมด
TRUNCATE TABLE equipments CASCADE;

-- ยืนยันว่าตารางสะอาดเรียบร้อย
SELECT count(*) AS total_equipments FROM equipments;
SELECT count(*) AS total_transactions FROM transactions;
