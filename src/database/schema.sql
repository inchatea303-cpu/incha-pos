-- ==============================================================================
-- INCHA INDONESIAN ARTISAN MILK TEA - DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Outlet: Karang Tengah, Ciledug, Tangerang
-- Stack: Supabase (PostgreSQL 15+)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('pemilik', 'karyawan');
CREATE TYPE ingredient_category AS ENUM ('base_tea', 'base_flavor', 'blend_flavor', 'cream', 'packaging', 'other');
CREATE TYPE product_category AS ENUM ('milk_tea', 'pure_tea', 'fruity_tea', 'special_blend');
CREATE TYPE sales_channel AS ENUM ('direct', 'gofood', 'grabfood', 'shopeefood');
CREATE TYPE payment_method AS ENUM ('cash', 'qris');
CREATE TYPE promo_type AS ENUM ('discount_pct', 'discount_nom', 'b1g1', 'bundle');
CREATE TYPE expense_category AS ENUM ('fixed', 'variable');

-- 3. OWNER ACCOUNTS (HANYA DUA AKUN PEMILIK - TIDAK ADA PENDAFTARAN PUBLIK)
CREATE TABLE public.owner_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Batasi mutlak: Maksimal hanya 2 akun pemilik dalam sistem
CREATE OR REPLACE FUNCTION trg_limit_owner_accounts()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.owner_accounts) >= 2 THEN
        RAISE EXCEPTION 'Maksimal hanya 2 akun pemilik yang diperbolehkan di sistem ini.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_limit_owners
BEFORE INSERT ON public.owner_accounts
FOR EACH ROW
EXECUTE FUNCTION trg_limit_owner_accounts();

-- 3B. EMPLOYEES & ROLES TABLE (HANYA UNTUK APLIKASI KASIR)
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    pin VARCHAR(10) NOT NULL, -- 4-6 digit numeric PIN
    role user_role NOT NULL DEFAULT 'karyawan',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 4. INGREDIENTS (Tabel Bahan Fisik - Terbuka untuk Karyawan untuk Cek Stok)
CREATE TABLE public.ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(30) UNIQUE,
    name VARCHAR(100) NOT NULL,
    category ingredient_category NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'pack', 'pcs', 'roll'
    min_stock NUMERIC(10, 2) NOT NULL DEFAULT 5,
    current_stock NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Karyawan BISA melihat jumlah ini
    is_verified BOOLEAN NOT NULL DEFAULT true,
    verification_note TEXT, -- 'BELUM DIVERIFIKASI', 'ASUMSI', dll
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 5. INGREDIENT COSTS (Tabel Finansial Bahan - DILINDUNGI RLS: HANYA PEMILIK!)
CREATE TABLE public.ingredient_costs (
    ingredient_id UUID PRIMARY KEY REFERENCES public.ingredients(id) ON DELETE CASCADE,
    buy_price NUMERIC(12, 2) NOT NULL CHECK (buy_price >= 0),
    portions_per_unit NUMERIC(10, 2) NOT NULL CHECK (portions_per_unit > 0),
    cost_per_portion NUMERIC(12, 4) GENERATED ALWAYS AS (buy_price / portions_per_unit) STORED,
    min_order VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_by VARCHAR(100)
);

-- 6. INGREDIENT PRICE HISTORY (Audit Log Perubahan Harga & Peringatan > 5%)
CREATE TABLE public.ingredient_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(100) NOT NULL,
    old_price NUMERIC(12, 2) NOT NULL,
    new_price NUMERIC(12, 2) NOT NULL,
    change_pct NUMERIC(6, 2) NOT NULL,
    is_alert_over_5pct BOOLEAN NOT NULL DEFAULT false,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    changed_by VARCHAR(100) NOT NULL
);

-- 7. PRODUCTS (Katalog Menu - Terbuka untuk Kasir)
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category product_category NOT NULL,
    sell_price NUMERIC(12, 2) NOT NULL CHECK (sell_price >= 0),
    max_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 15.00 CHECK (max_discount_pct >= 0 AND max_discount_pct <= 100),
    is_verified BOOLEAN NOT NULL DEFAULT true,
    verification_note TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 8. RECIPES (Komposisi Takaran per Porsi Cup)
CREATE TABLE public.recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
    amount NUMERIC(8, 3) NOT NULL CHECK (amount > 0), -- takaran porsi (mis. 1 porsi tea base)
    UNIQUE(product_id, ingredient_id)
);

-- 9. PRODUCT FINANCIALS (HPP, Margin, Harga Min - DILINDUNGI RLS: HANYA PEMILIK!)
CREATE TABLE public.product_financials (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    hpp NUMERIC(12, 2) NOT NULL,
    margin NUMERIC(12, 2) NOT NULL,
    margin_pct NUMERIC(6, 2) NOT NULL,
    min_price_direct NUMERIC(12, 2) NOT NULL,
    min_price_online NUMERIC(12, 2) NOT NULL,
    online_margin NUMERIC(12, 2) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 10. PACKAGING CONFIG (Biaya Cup, Lid, Biaya Lain - HANYA PEMILIK)
CREATE TABLE public.packaging_config (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cup_price NUMERIC(10, 2) NOT NULL DEFAULT 749,
    lid_roll_price NUMERIC(10, 2) NOT NULL DEFAULT 249000,
    lid_cups_per_roll INT NOT NULL DEFAULT 1200,
    other_costs_per_cup NUMERIC(10, 2) NOT NULL DEFAULT 1000, -- ASUMSI (es, sedotan, plastik)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 11. SALES TRANSACTIONS (Transaksi Kasir)
CREATE TABLE public.sales_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    cashier_id UUID REFERENCES public.employees(id),
    cashier_name VARCHAR(100) NOT NULL,
    channel sales_channel NOT NULL DEFAULT 'direct',
    payment_method payment_method NOT NULL DEFAULT 'cash',
    total_gross NUMERIC(12, 2) NOT NULL CHECK (total_gross >= 0),
    total_discount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
    total_net NUMERIC(12, 2) NOT NULL CHECK (total_net >= 0),
    total_hpp NUMERIC(12, 2) NOT NULL DEFAULT 0, -- Nilai HPP (hanya terbaca Pemilik)
    cash_received NUMERIC(12, 2),
    cash_change NUMERIC(12, 2),
    sync_status VARCHAR(20) NOT NULL DEFAULT 'terkirim', -- 'lokal', 'terkirim', 'gagal'
    is_voided BOOLEAN NOT NULL DEFAULT false,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    voided_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 12. SALES ITEMS (Detail Item Penjualan)
CREATE TABLE public.sales_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    product_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12, 2) NOT NULL,
    hpp_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- 13. SHIFTS / TUTUP KAS HARIAN
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashier_id UUID NOT NULL REFERENCES public.employees(id),
    cashier_name VARCHAR(100) NOT NULL,
    opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qris_sales NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cash_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash_in_drawer NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cash_variance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed'
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    closed_at TIMESTAMPTZ,
    notes TEXT
);

-- 14. EXPENSES (Biaya Tetap & Variabel - HANYA PEMILIK)
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    category expense_category NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    is_recurring_monthly BOOLEAN NOT NULL DEFAULT false,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    recorded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 15. PROMO RULES (Aturan Promo & Diskon)
CREATE TABLE public.promo_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    type promo_type NOT NULL,
    target_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    buy_qty INT DEFAULT 1,
    free_qty INT DEFAULT 1,
    online_allowed BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    confirmed_loss_by_owner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 16. AUDIT LOGS (Riwayat Perubahan Tanpa Tombol Hapus)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    actor VARCHAR(100) NOT NULL,
    page VARCHAR(50) NOT NULL DEFAULT 'Dashboard',
    action VARCHAR(100) NOT NULL,
    changes_before TEXT,
    changes_after TEXT,
    details TEXT NOT NULL,
    ip_address VARCHAR(50) NOT NULL DEFAULT '127.0.0.1'
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on ALL tables
ALTER TABLE public.owner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Membaca role pengguna saat ini dari Supabase JWT atau custom header
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::jsonb->>'user_role',
        current_setting('app.current_user_role', true),
        'karyawan'
    )::user_role;
EXCEPTION WHEN OTHERS THEN
    RETURN 'karyawan'::user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- A. KEBIJAKAN TABEL KEUANGAN & PEMILIK (HANYA PEMILIK BISA MELIHAT & MENGUBAH)
-- ------------------------------------------------------------------------------

-- 0. OWNER ACCOUNTS (HANYA PEMILIK, TIDAK ADA ENDPOINT PENDAFTARAN)
CREATE POLICY "pemilik_select_owner_accounts" ON public.owner_accounts
    FOR SELECT USING (current_user_role() = 'pemilik');
CREATE POLICY "pemilik_update_owner_accounts" ON public.owner_accounts
    FOR UPDATE USING (current_user_role() = 'pemilik');
-- Tidak ada INSERT POLICY untuk public/karyawan (Pendaftaran ditolak di level RLS)

-- 1. INGREDIENT COSTS (HARGA BELI BAHAN): HANYA PEMILIK
CREATE POLICY "pemilik_full_access_ingredient_costs" ON public.ingredient_costs
    FOR ALL USING (current_user_role() = 'pemilik');

-- 2. PRODUCT FINANCIALS (HPP & MARGIN PRODUK): HANYA PEMILIK
CREATE POLICY "pemilik_full_access_product_financials" ON public.product_financials
    FOR ALL USING (current_user_role() = 'pemilik');

-- 3. INGREDIENT PRICE HISTORY: HANYA PEMILIK
CREATE POLICY "pemilik_full_access_price_history" ON public.ingredient_price_history
    FOR ALL USING (current_user_role() = 'pemilik');

-- 4. EXPENSES (PENGELUARAN): HANYA PEMILIK
CREATE POLICY "pemilik_full_access_expenses" ON public.expenses
    FOR ALL USING (current_user_role() = 'pemilik');

-- 5. PACKAGING CONFIG: HANYA PEMILIK
CREATE POLICY "pemilik_full_access_packaging_config" ON public.packaging_config
    FOR ALL USING (current_user_role() = 'pemilik');

-- 6. AUDIT LOGS: HANYA PEMILIK
CREATE POLICY "pemilik_select_audit_logs" ON public.audit_logs
    FOR SELECT USING (current_user_role() = 'pemilik');
CREATE POLICY "all_insert_audit_logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true); -- Kasir & sistem bisa mencatat event log

-- ------------------------------------------------------------------------------
-- B. KEBIJAKAN TABEL OPERASIONAL (KARYAWAN BISA MELIHAT DENGAN BATASAN)
-- ------------------------------------------------------------------------------

-- 1. INGREDIENTS: Semua bisa SELECT (stok fisik), hanya Pemilik bisa INSERT/UPDATE/DELETE
CREATE POLICY "everyone_select_ingredients" ON public.ingredients
    FOR SELECT USING (true);
CREATE POLICY "pemilik_modify_ingredients" ON public.ingredients
    FOR ALL USING (current_user_role() = 'pemilik');

-- 2. PRODUCTS: Semua bisa SELECT menu aktif, hanya Pemilik bisa merubah
CREATE POLICY "everyone_select_products" ON public.products
    FOR SELECT USING (active = true OR current_user_role() = 'pemilik');
CREATE POLICY "pemilik_modify_products" ON public.products
    FOR ALL USING (current_user_role() = 'pemilik');

-- 3. RECIPES: Semua bisa SELECT untuk pemrosesan order, Pemilik bisa merubah
CREATE POLICY "everyone_select_recipes" ON public.recipes
    FOR SELECT USING (true);
CREATE POLICY "pemilik_modify_recipes" ON public.recipes
    FOR ALL USING (current_user_role() = 'pemilik');

-- 4. SALES TRANSACTIONS & ITEMS
-- Kasir bisa membuat penjualan & melihat transaksi shift mereka. Pemilik bisa melihat semua.
CREATE POLICY "insert_sales_transactions" ON public.sales_transactions
    FOR INSERT WITH CHECK (true);
CREATE POLICY "select_sales_transactions" ON public.sales_transactions
    FOR SELECT USING (
        current_user_role() = 'pemilik' OR 
        cashier_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
    );
CREATE POLICY "insert_sales_items" ON public.sales_items
    FOR INSERT WITH CHECK (true);
CREATE POLICY "select_sales_items" ON public.sales_items
    FOR SELECT USING (true);

-- 5. SHIFTS
CREATE POLICY "everyone_manage_own_shift" ON public.shifts
    FOR ALL USING (
        current_user_role() = 'pemilik' OR 
        cashier_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
    );

-- 6. PROMOS
CREATE POLICY "everyone_select_active_promos" ON public.promo_rules
    FOR SELECT USING (is_active = true OR current_user_role() = 'pemilik');
CREATE POLICY "pemilik_modify_promos" ON public.promo_rules
    FOR ALL USING (current_user_role() = 'pemilik');

-- ==============================================================================
-- TRIGGERS & AUTOMATION
-- ==============================================================================

-- Trigger: Otomatis catat riwayat harga bahan dan deteksi kenaikan > 5%
CREATE OR REPLACE FUNCTION trg_log_ingredient_price_change()
RETURNS TRIGGER AS $$
DECLARE
    v_change_pct NUMERIC(6, 2);
    v_is_alert BOOLEAN := false;
    v_name VARCHAR(100);
BEGIN
    IF (OLD.buy_price <> NEW.buy_price) THEN
        v_change_pct := ROUND(((NEW.buy_price - OLD.buy_price) / OLD.buy_price) * 100, 2);
        IF (v_change_pct > 5.00) THEN
            v_is_alert := true;
        END IF;

        SELECT name INTO v_name FROM public.ingredients WHERE id = NEW.ingredient_id;

        INSERT INTO public.ingredient_price_history (
            ingredient_id,
            ingredient_name,
            old_price,
            new_price,
            change_pct,
            is_alert_over_5pct,
            changed_by
        ) VALUES (
            NEW.ingredient_id,
            COALESCE(v_name, 'Bahan'),
            OLD.buy_price,
            NEW.buy_price,
            v_change_pct,
            v_is_alert,
            COALESCE(NEW.updated_by, 'Pemilik')
        );

        -- Catat ke audit log
        INSERT INTO public.audit_logs (actor, action, details)
        VALUES (
            COALESCE(NEW.updated_by, 'Pemilik'),
            'UBAH_HARGA_BAHAN',
            format('Harga %s diubah dari Rp%s menjadi Rp%s (%s%%). %s',
                v_name, OLD.buy_price, NEW.buy_price, v_change_pct,
                CASE WHEN v_is_alert THEN 'PERINGATAN: Kenaikan lebih dari 5%!' ELSE '' END
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ingredient_price_change ON public.ingredient_costs;
CREATE TRIGGER trigger_ingredient_price_change
AFTER UPDATE ON public.ingredient_costs
FOR EACH ROW
EXECUTE FUNCTION trg_log_ingredient_price_change();

-- Trigger: Otomatis kurangi stok bahan saat ada item transaksi terjual
CREATE OR REPLACE FUNCTION trg_deduct_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
BEGIN
    -- Loop setiap bahan pada resep menu yang dipesan
    FOR r IN (
        SELECT ingredient_id, amount
        FROM public.recipes
        WHERE product_id = NEW.product_id
    ) LOOP
        UPDATE public.ingredients
        SET current_stock = current_stock - (r.amount * NEW.quantity),
            updated_at = timezone('utc', now())
        WHERE id = r.ingredient_id;
    END LOOP;

    -- Pengurangan Cup & Lid sealer otomatis (1 cup dan 1 lid per porsi)
    UPDATE public.ingredients
    SET current_stock = current_stock - NEW.quantity
    WHERE code IN ('CUP', 'LID');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deduct_stock ON public.sales_items;
CREATE TRIGGER trigger_deduct_stock
AFTER INSERT ON public.sales_items
FOR EACH ROW
EXECUTE FUNCTION trg_deduct_stock_on_sale();
