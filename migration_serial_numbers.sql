-- ==============================================================================
-- Migration: Add IT Asset Tracking, Serial Numbers (S/N) & Equipment Categories
-- ระบบติดตามเครื่องรายตัว, หมายเลข S/N, หมายเลขครุภัณฑ์/พัสดุ และหมวดหมู่อุปกรณ์
-- ==============================================================================

-- 1. เพิ่มคอลัมน์ category ในตาราง equipments
ALTER TABLE equipments ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'โน้ตบุ๊ก';

-- 2. สร้างตาราง equipment_items สำหรับจัดเก็บเครื่องย่อย (S/N, หมายเลขพัสดุ/ครุภัณฑ์)
CREATE TABLE IF NOT EXISTS equipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL, -- เช่น "เครื่องที่ 1", "NB-01"
    serial_number TEXT,      -- S/N ประจำเครื่อง
    asset_number TEXT,       -- หมายเลขครุภัณฑ์ / พัสดุ (ถ้ามี)
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance', 'retired')),
    note TEXT,               -- หมายเหตุสเปค เช่น "RAM 16GB, เมาส์บลูทูธ"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. เพิ่มคอลัมน์ในตาราง transactions เพื่อบันทึกเครื่องเฉพาะตัวที่ถูกยืมไป
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES equipment_items(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset_number TEXT;

-- 4. สร้าง Indexes เพื่อความรวดเร็วในการค้นหา
CREATE INDEX IF NOT EXISTS idx_equipment_items_equipment_id ON equipment_items(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items(status);
CREATE INDEX IF NOT EXISTS idx_equipment_items_serial ON equipment_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_items_asset ON equipment_items(asset_number);
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);

-- 5. กำหนด Row Level Security (RLS) สำหรับ equipment_items
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

-- อนุญาตให้ทุกคน (รวมทั้งผู้ใช้ทั่วไปผ่านหน้าเว็บ LIFF) อ่านรายการเครื่องย่อยได้
DROP POLICY IF EXISTS "Public users can view equipment_items" ON equipment_items;
CREATE POLICY "Public users can view equipment_items"
    ON equipment_items
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- อนุญาตให้ Backend Service Role / API จัดการเพิ่ม แก้ไข ลบ เครื่องย่อยได้
DROP POLICY IF EXISTS "Service role manages equipment_items" ON equipment_items;
CREATE POLICY "Service role manages equipment_items"
    ON equipment_items
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);
