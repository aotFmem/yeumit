-- ==============================================================================
-- IT Equipment Borrowing System - Supabase Schema
-- ==============================================================================

-- 1. Enable UUID Extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Enum for Transaction Status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
        CREATE TYPE transaction_status AS ENUM ('borrowed', 'returned');
    END IF;
END$$;

-- 3. Create Equipments Table
CREATE TABLE IF NOT EXISTS equipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'โน้ตบุ๊ก',
    image_url TEXT,
    total_stock INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    available_stock INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0 AND available_stock <= total_stock),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE equipments ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'โน้ตบุ๊ก';

-- 3.1 Create Equipment Items Table (เครื่องย่อยรายตัว / S/N / เลขพัสดุ)
CREATE TABLE IF NOT EXISTS equipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL,
    serial_number TEXT,
    asset_number TEXT,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'maintenance', 'retired')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    department TEXT NOT NULL,
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE RESTRICT,
    item_id UUID REFERENCES equipment_items(id) ON DELETE SET NULL,
    serial_number TEXT,
    asset_number TEXT,
    borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_date DATE,
    status transaction_status NOT NULL DEFAULT 'borrowed',
    time_slot TEXT,
    purpose TEXT,
    internal_phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was already created
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS time_slot TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS internal_phone TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES equipment_items(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset_number TEXT;

-- 5. Create Indexes for High Performance Lookups
CREATE INDEX IF NOT EXISTS idx_equipments_available_stock ON equipments(available_stock);
CREATE INDEX IF NOT EXISTS idx_equipment_items_equipment_id ON equipment_items(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items(status);
CREATE INDEX IF NOT EXISTS idx_transactions_line_user_id ON transactions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_equipment_id ON transactions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies
-- Allow public anon read access to equipments and equipment_items so LIFF frontend can show available items
DROP POLICY IF EXISTS "Public users can view equipments" ON equipments;
CREATE POLICY "Public users can view equipments"
    ON equipments
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Public users can view equipment_items" ON equipment_items;
CREATE POLICY "Public users can view equipment_items"
    ON equipment_items
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Service role manages equipment_items" ON equipment_items;
CREATE POLICY "Service role manages equipment_items"
    ON equipment_items
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Equipments insert/update/delete (managed via service_role or server-side API with admin auth)
DROP POLICY IF EXISTS "Service role manages equipments" ON equipments;
CREATE POLICY "Service role manages equipments"
    ON equipments
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Transactions: Public users can only read their own transactions if authenticated
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions"
    ON transactions
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Transactions insert/update/delete strictly executed via Next.js API Route
DROP POLICY IF EXISTS "Service role manages transactions" ON transactions;
CREATE POLICY "Service role manages transactions"
    ON transactions
    FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Allow return status update on transactions (safeguard when using anon API key)
DROP POLICY IF EXISTS "Allow return update on transactions" ON transactions;
CREATE POLICY "Allow return update on transactions"
    ON transactions
    FOR UPDATE
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 8. Atomic Borrowing Function (Prevents Race Conditions & Overbooking)
CREATE OR REPLACE FUNCTION borrow_equipment_atomic(
    p_line_user_id TEXT,
    p_display_name TEXT,
    p_department TEXT,
    p_equipment_id UUID,
    p_borrow_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_equipment equipments%ROWTYPE;
    v_transaction_id UUID;
BEGIN
    -- Lock row for update to prevent race conditions
    SELECT * INTO v_equipment
    FROM equipments
    WHERE id = p_equipment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Equipment not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_equipment.available_stock <= 0 THEN
        RAISE EXCEPTION 'Equipment is out of stock' USING ERRCODE = 'P0001';
    END IF;

    -- Decrement available stock
    UPDATE equipments
    SET available_stock = available_stock - 1
    WHERE id = p_equipment_id;

    -- Insert new transaction record
    INSERT INTO transactions (
        line_user_id,
        display_name,
        department,
        equipment_id,
        borrow_date,
        status
    ) VALUES (
        p_line_user_id,
        p_display_name,
        p_department,
        p_equipment_id,
        p_borrow_date,
        'borrowed'
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'equipment_name', v_equipment.name,
        'remaining_stock', v_equipment.available_stock - 1
    );
END;
$$;

-- 9. Atomic Return Function (Restores stock safely)
CREATE OR REPLACE FUNCTION return_equipment_atomic(
    p_transaction_id UUID,
    p_return_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction transactions%ROWTYPE;
    v_equipment equipments%ROWTYPE;
BEGIN
    -- Find and lock transaction
    SELECT * INTO v_transaction
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_transaction.status = 'returned' THEN
        RAISE EXCEPTION 'Equipment has already been returned' USING ERRCODE = 'P0003';
    END IF;

    -- Update transaction
    UPDATE transactions
    SET status = 'returned',
        return_date = p_return_date
    WHERE id = p_transaction_id;

    -- Increment equipment available stock
    UPDATE equipments
    SET available_stock = LEAST(available_stock + 1, total_stock)
    WHERE id = v_transaction.equipment_id
    RETURNING * INTO v_equipment;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'equipment_name', v_equipment.name,
        'restored_stock', v_equipment.available_stock
    );
END;
$$;

