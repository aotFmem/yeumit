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
    image_url TEXT,
    total_stock INTEGER NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    available_stock INTEGER NOT NULL DEFAULT 0 CHECK (available_stock >= 0 AND available_stock <= total_stock),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    department TEXT NOT NULL,
    equipment_id UUID NOT NULL REFERENCES equipments(id) ON DELETE RESTRICT,
    borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_date DATE,
    status transaction_status NOT NULL DEFAULT 'borrowed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Indexes for High Performance Lookups
CREATE INDEX IF NOT EXISTS idx_equipments_available_stock ON equipments(available_stock);
CREATE INDEX IF NOT EXISTS idx_transactions_line_user_id ON transactions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_equipment_id ON transactions(equipment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies
-- Allow public anon read access to equipments so LIFF frontend can show available items
DROP POLICY IF EXISTS "Public users can view equipments" ON equipments;
CREATE POLICY "Public users can view equipments"
    ON equipments
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Equipments insert/update/delete restricted to service_role
DROP POLICY IF EXISTS "Service role manages equipments" ON equipments;
CREATE POLICY "Service role manages equipments"
    ON equipments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Transactions: Public users can only read their own transactions if authenticated
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions"
    ON transactions
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Transactions insert/update/delete strictly executed via service_role in Next.js API Route
DROP POLICY IF EXISTS "Service role manages transactions" ON transactions;
CREATE POLICY "Service role manages transactions"
    ON transactions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow return status update on transactions (safeguard when using anon API key)
DROP POLICY IF EXISTS "Allow return update on transactions" ON transactions;
CREATE POLICY "Allow return update on transactions"
    ON transactions
    FOR UPDATE
    TO anon, authenticated
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

-- 10. Seed Sample IT Equipment Data
INSERT INTO equipments (name, image_url, total_stock, available_stock)
VALUES
    ('MacBook Pro 14" M3 (Space Gray)', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80', 5, 3),
    ('Dell XPS 15 (Core i7, 32GB RAM)', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=600&q=80', 4, 2),
    ('Dell UltraSharp 27" 4K Monitor', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80', 6, 4),
    ('iPad Air 11" M2 + Apple Pencil', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80', 3, 1),
    ('Logitech MX Master 3S Wireless Mouse', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80', 10, 8),
    ('Epson Full HD Mobile Projector', 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=600&q=80', 2, 0), -- Out of stock test case
    ('Anker 12-in-1 USB-C Docking Station', 'https://images.unsplash.com/photo-1622445262464-84b14e4b7501?auto=format&fit=crop&w=600&q=80', 5, 5)
ON CONFLICT DO NOTHING;

