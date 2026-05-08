-- ======================================================
-- Unyx POS — supabase/pos_setup.sql
-- Execute no Supabase SQL Editor
-- ======================================================

-- Enums
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE public.cash_session_status AS ENUM ('open','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.sale_status AS ENUM ('draft','completed','cancelled','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.payment_method AS ENUM ('cash','pix','debit_card','credit_card','voucher','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('pending','confirmed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.pos_cash_movement_type AS ENUM ('sale_cash_in','cash_out','cash_in','sangria','change_reinforcement','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── products ─────────────────────────────────────────
-- product_categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  segment          text NOT NULL DEFAULT 'all',
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_categories_organization ON public.product_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_branch       ON public.product_categories(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_segment      ON public.product_categories(segment);
CREATE INDEX IF NOT EXISTS idx_product_categories_name         ON public.product_categories(name);

DO $$ BEGIN
  ALTER TABLE public.product_categories
    ADD CONSTRAINT product_categories_segment_check
    CHECK (segment IN ('all','retail_store','supermarket','restaurant','pharmacy','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id      uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name             text NOT NULL,
  description      text,
  barcode          text,
  sku              text,
  category         text,
  brand            text,
  product_kind     text NOT NULL DEFAULT 'retail',
  size_label       text,
  dosage           text,
  unit             text NOT NULL DEFAULT 'un',
  price            numeric(12,2) NOT NULL DEFAULT 0,
  cost_price       numeric(12,2),
  stock_quantity   numeric(12,3) NOT NULL DEFAULT 0,
  min_stock_quantity numeric(12,3) NOT NULL DEFAULT 0,
  track_inventory  boolean NOT NULL DEFAULT true,
  allow_fractional_quantity boolean NOT NULL DEFAULT false,
  perishable       boolean NOT NULL DEFAULT false,
  prescription_required boolean NOT NULL DEFAULT false,
  controlled_substance boolean NOT NULL DEFAULT false,
  preparation_time_minutes integer,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_organization ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_branch      ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode     ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name        ON public.products(name);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_kind text NOT NULL DEFAULT 'retail';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS size_label text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dosage text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_quantity numeric(12,3) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allow_fractional_quantity boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS perishable boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS prescription_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS controlled_substance boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS preparation_time_minutes integer;
UPDATE public.products SET product_kind = 'retail' WHERE product_kind IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku         ON public.products(sku) WHERE sku IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_product_kind_check
    CHECK (product_kind IN ('retail','food','medicine','service'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- product_variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name             text NOT NULL,
  barcode          text,
  sku              text,
  price            numeric(12,2) NOT NULL DEFAULT 0,
  cost_price       numeric(12,2),
  stock_quantity   numeric(12,3) NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_organization ON public.product_variants(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product      ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode      ON public.product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_sku          ON public.product_variants(sku) WHERE sku IS NOT NULL;

-- ── cash_sessions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  post_id          uuid REFERENCES public.operational_posts(id) ON DELETE SET NULL,
  user_profile_id  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  employee_id      uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  opened_at        timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  initial_amount   numeric(12,2) NOT NULL DEFAULT 0,
  expected_amount  numeric(12,2) NOT NULL DEFAULT 0,
  final_amount     numeric(12,2),
  difference_amount numeric(12,2),
  status           public.cash_session_status NOT NULL DEFAULT 'open',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_organization ON public.cash_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch      ON public.cash_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status      ON public.cash_sessions(status);

-- ── sales ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_pos_credentials (
  employee_id      uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pin_hash         text NOT NULL,
  active           boolean NOT NULL DEFAULT true,
  updated_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employee_pos_credentials_org
ON public.employee_pos_credentials(organization_id);

CREATE TABLE IF NOT EXISTS public.sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cash_session_id  uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  post_id          uuid REFERENCES public.operational_posts(id) ON DELETE SET NULL,
  user_profile_id  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  employee_id      uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  customer_id      uuid,
  customer_name    text,
  sale_mode        public.business_segment DEFAULT 'retail_store',
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  status           public.sale_status NOT NULL DEFAULT 'completed',
  sold_at          timestamptz NOT NULL DEFAULT now(),
  cancelled_at     timestamptz,
  manager_authorization text,
  cancel_reason    text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_organization ON public.sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch       ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_session      ON public.sales(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at      ON public.sales(sold_at DESC);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_mode public.business_segment DEFAULT 'retail_store';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS manager_authorization text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancel_reason text;
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id) WHERE customer_id IS NOT NULL;
DO $$ BEGIN
  IF to_regclass('public.customers') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'sales_customer_id_fkey'
        AND conrelid = 'public.sales'::regclass
    )
  THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── sale_items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id          uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id       uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name     text NOT NULL,
  quantity         numeric(12,3) NOT NULL DEFAULT 1,
  unit_price       numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale    ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON public.sale_items(variant_id);

-- ── sale_payments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id          uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  method           public.payment_method NOT NULL,
  amount           numeric(12,2) NOT NULL,
  change_amount    numeric(12,2) NOT NULL DEFAULT 0,
  status           public.payment_status NOT NULL DEFAULT 'confirmed',
  paid_at          timestamptz NOT NULL DEFAULT now(),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments(sale_id);

-- ── pos_cash_movements ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_cash_movements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  cash_session_id  uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  post_id          uuid REFERENCES public.operational_posts(id) ON DELETE SET NULL,
  movement_type    public.pos_cash_movement_type NOT NULL,
  amount           numeric(12,2) NOT NULL,
  created_by       uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_session ON public.pos_cash_movements(cash_session_id);

-- ── RLS ───────────────────────────────────────────────
ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_pos_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_products_read"   ON public.products;
DROP POLICY IF EXISTS "pos_products_write"  ON public.products;
CREATE POLICY "pos_products_read"  ON public.products FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_products_write" ON public.products FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_product_categories_read"  ON public.product_categories;
DROP POLICY IF EXISTS "pos_product_categories_write" ON public.product_categories;
CREATE POLICY "pos_product_categories_read"  ON public.product_categories FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_product_categories_write" ON public.product_categories FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_product_variants_read"  ON public.product_variants;
DROP POLICY IF EXISTS "pos_product_variants_write" ON public.product_variants;
CREATE POLICY "pos_product_variants_read"  ON public.product_variants FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_product_variants_write" ON public.product_variants FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_sessions_read"  ON public.cash_sessions;
DROP POLICY IF EXISTS "pos_sessions_write" ON public.cash_sessions;
CREATE POLICY "pos_sessions_read"  ON public.cash_sessions FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_sessions_write" ON public.cash_sessions FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_sales_read"  ON public.sales;
DROP POLICY IF EXISTS "pos_sales_write" ON public.sales;
CREATE POLICY "pos_sales_read"  ON public.sales FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_sales_write" ON public.sales FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_sale_items_read"  ON public.sale_items;
DROP POLICY IF EXISTS "pos_sale_items_write" ON public.sale_items;
CREATE POLICY "pos_sale_items_read"  ON public.sale_items FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_sale_items_write" ON public.sale_items FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_payments_read"  ON public.sale_payments;
DROP POLICY IF EXISTS "pos_payments_write" ON public.sale_payments;
CREATE POLICY "pos_payments_read"  ON public.sale_payments FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_payments_write" ON public.sale_payments FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

DROP POLICY IF EXISTS "pos_movements_read"  ON public.pos_cash_movements;
DROP POLICY IF EXISTS "pos_movements_write" ON public.pos_cash_movements;
CREATE POLICY "pos_movements_read"  ON public.pos_cash_movements FOR SELECT
  USING (organization_id = current_organization_id());
CREATE POLICY "pos_movements_write" ON public.pos_cash_movements FOR ALL
  USING (organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor','operator'));

-- ── Grants ────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cash_sessions      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sales              TO authenticated;
GRANT SELECT, INSERT         ON public.sale_items         TO authenticated;
GRANT SELECT, INSERT         ON public.sale_payments      TO authenticated;
GRANT SELECT, INSERT         ON public.pos_cash_movements TO authenticated;

-- ── RPC: pos_open_cash_session ────────────────────────
CREATE OR REPLACE FUNCTION public.pos_set_operator_password(
  p_employee_id uuid,
  p_password    text,
  p_active      boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_role text;
  v_employee record;
BEGIN
  v_org_id := current_organization_id();
  v_role := current_user_role();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuario sem organizacao.'; END IF;
  IF v_role NOT IN ('owner','admin','branch_manager','supervisor') THEN
    RAISE EXCEPTION 'Sem permissao para definir senha do PDV.';
  END IF;
  IF p_password IS NULL OR length(btrim(p_password)) < 4 THEN
    RAISE EXCEPTION 'A senha do PDV deve ter pelo menos 4 caracteres.';
  END IF;

  SELECT id INTO v_user_id FROM user_profiles
    WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  SELECT id, organization_id, branch_id, active
    INTO v_employee
  FROM employees
  WHERE id = p_employee_id AND organization_id = v_org_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador nao encontrado.'; END IF;
  IF NOT v_employee.active THEN RAISE EXCEPTION 'Colaborador inativo nao pode acessar o PDV.'; END IF;
  IF NOT (
    public.is_org_admin()
    OR v_employee.branch_id = public.current_branch_id()
    OR public.can_manage_branch(v_employee.branch_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissao para esta filial.';
  END IF;

  INSERT INTO employee_pos_credentials (
    employee_id, organization_id, pin_hash, active, updated_by, updated_at
  ) VALUES (
    p_employee_id, v_org_id, crypt(p_password, gen_salt('bf')), p_active, v_user_id, now()
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    pin_hash = excluded.pin_hash,
    active = excluded.active,
    updated_by = excluded.updated_by,
    updated_at = now();

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_org_id, v_employee.branch_id, v_user_id, 'pos_operator_password_set', 'employees', p_employee_id, NULL,
    jsonb_build_object('employee_id', p_employee_id, 'active', p_active));
END; $$;

CREATE OR REPLACE FUNCTION public.pos_verify_operator(
  p_session_id   uuid,
  p_employee_id  uuid,
  p_password     text
)
RETURNS TABLE(employee_id uuid, employee_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_session record;
  v_employee record;
BEGIN
  v_org_id := current_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuario sem organizacao.'; END IF;

  SELECT id INTO v_user_id FROM user_profiles
    WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  SELECT id, branch_id, employee_id, status
    INTO v_session
  FROM cash_sessions
  WHERE id = p_session_id AND organization_id = v_org_id;

  IF NOT FOUND OR v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Caixa nao encontrado ou encerrado.';
  END IF;
  IF v_session.employee_id IS NULL THEN
    RAISE EXCEPTION 'Este caixa nao possui operador vinculado.';
  END IF;
  IF v_session.employee_id <> p_employee_id THEN
    RAISE EXCEPTION 'Este caixa pertence a outro operador.';
  END IF;

  SELECT e.id, e.name, e.branch_id, e.active, c.pin_hash, c.active AS credential_active
    INTO v_employee
  FROM employees e
  LEFT JOIN employee_pos_credentials c ON c.employee_id = e.id
  WHERE e.id = p_employee_id AND e.organization_id = v_org_id;

  IF NOT FOUND OR NOT v_employee.active OR v_employee.branch_id <> v_session.branch_id THEN
    RAISE EXCEPTION 'Operador invalido para este caixa.';
  END IF;
  IF v_employee.pin_hash IS NULL OR NOT COALESCE(v_employee.credential_active, false) THEN
    RAISE EXCEPTION 'Operador sem senha de PDV configurada.';
  END IF;
  IF crypt(COALESCE(p_password, ''), v_employee.pin_hash) <> v_employee.pin_hash THEN
    RAISE EXCEPTION 'Senha do PDV invalida.';
  END IF;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_org_id, v_session.branch_id, v_user_id, 'pos_operator_unlocked', 'cash_sessions', p_session_id, NULL,
    jsonb_build_object('employee_id', p_employee_id));

  RETURN QUERY SELECT v_employee.id::uuid, v_employee.name::text;
END; $$;

CREATE OR REPLACE FUNCTION public.pos_open_cash_session(
  p_branch_id     uuid,
  p_post_id       uuid    DEFAULT NULL,
  p_employee_id   uuid    DEFAULT NULL,
  p_initial_amount numeric DEFAULT 0,
  p_notes         text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id    uuid;
  v_user_id   uuid;
  v_session_id uuid;
BEGIN
  v_org_id := current_organization_id();
  IF p_employee_id IS NULL THEN RAISE EXCEPTION 'Selecione o operador do caixa.'; END IF;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuário sem organização.'; END IF;

  SELECT id INTO v_user_id FROM user_profiles
    WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  IF NOT EXISTS (
    SELECT 1 FROM employees
    WHERE id = p_employee_id
      AND organization_id = v_org_id
      AND branch_id = p_branch_id
      AND active
  ) THEN
    RAISE EXCEPTION 'Operador invalido para esta filial.';
  END IF;

  IF p_post_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM cash_sessions
     WHERE organization_id = v_org_id AND branch_id = p_branch_id
       AND post_id = p_post_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Já existe uma sessão aberta neste posto.';
  END IF;

  INSERT INTO cash_sessions (
    organization_id, branch_id, post_id, user_profile_id, employee_id,
    initial_amount, expected_amount, status, notes
  ) VALUES (
    v_org_id, p_branch_id, p_post_id, v_user_id, p_employee_id,
    p_initial_amount, p_initial_amount, 'open', p_notes
  ) RETURNING id INTO v_session_id;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_org_id, p_branch_id, v_user_id, 'pos_session_opened', 'cash_sessions', v_session_id, NULL,
    jsonb_build_object('session_id', v_session_id, 'initial_amount', p_initial_amount));

  RETURN v_session_id;
END; $$;

-- ── RPC: pos_complete_sale ────────────────────────────
DROP FUNCTION IF EXISTS public.pos_complete_sale(uuid, uuid, uuid, jsonb, jsonb, text, numeric, text);
DROP FUNCTION IF EXISTS public.pos_complete_sale(uuid, uuid, uuid, jsonb, jsonb, uuid, text, public.business_segment, text, numeric, text);

CREATE OR REPLACE FUNCTION public.pos_complete_sale(
  p_branch_id      uuid,
  p_session_id     uuid,
  p_post_id        uuid    DEFAULT NULL,
  p_items          jsonb   DEFAULT '[]',
  p_payments       jsonb   DEFAULT '[]',
  p_operator_employee_id uuid DEFAULT NULL,
  p_operator_password text DEFAULT NULL,
  p_customer_id    uuid    DEFAULT NULL,
  p_customer_name  text    DEFAULT NULL,
  p_sale_mode      public.business_segment DEFAULT 'retail_store',
  p_manager_authorization text DEFAULT NULL,
  p_discount_amount numeric DEFAULT 0,
  p_notes          text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id   uuid;
  v_user_id  uuid;
  v_sale_id  uuid;
  v_subtotal numeric := 0;
  v_total    numeric;
  v_cash_net numeric := 0;
  v_item     jsonb;
  v_payment  jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity numeric;
  v_track_inventory boolean;
BEGIN
  v_org_id := current_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuário sem organização.'; END IF;

  SELECT id INTO v_user_id FROM user_profiles
    WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  IF NOT EXISTS (
    SELECT 1 FROM cash_sessions
     WHERE id = p_session_id AND organization_id = v_org_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Sessão de caixa não encontrada ou já encerrada.';
  END IF;

  PERFORM 1
  FROM public.pos_verify_operator(p_session_id, p_operator_employee_id, p_operator_password);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal
      + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  END LOOP;
  v_total := v_subtotal - COALESCE(p_discount_amount, 0);

  INSERT INTO sales (
    organization_id, branch_id, cash_session_id, post_id, user_profile_id,
    customer_id, customer_name, sale_mode, subtotal, discount_amount, total_amount,
    status, sold_at, manager_authorization, notes
  ) VALUES (
    v_org_id, p_branch_id, p_session_id, p_post_id, v_user_id,
    p_customer_id, p_customer_name, COALESCE(p_sale_mode, 'retail_store'),
    v_subtotal, COALESCE(p_discount_amount, 0), v_total,
    'completed', now(), NULLIF(btrim(p_manager_authorization), ''), p_notes
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 0);

    INSERT INTO sale_items (
      organization_id, sale_id, product_id, variant_id, product_name,
      quantity, unit_price, discount_amount, total_amount
    ) VALUES (
      v_org_id, v_sale_id,
      v_product_id,
      v_variant_id,
      v_item->>'product_name',
      v_quantity,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount_amount')::numeric, 0),
      (v_item->>'total_amount')::numeric
    );

    IF v_product_id IS NOT NULL THEN
      v_track_inventory := false;
      SELECT COALESCE(track_inventory, true)
        INTO v_track_inventory
        FROM products
       WHERE id = v_product_id AND organization_id = v_org_id;

      IF COALESCE(v_track_inventory, false) THEN
        IF v_variant_id IS NOT NULL THEN
          UPDATE product_variants
             SET stock_quantity = GREATEST(0, stock_quantity - v_quantity),
                 updated_at = now()
           WHERE id = v_variant_id
             AND product_id = v_product_id
             AND organization_id = v_org_id;
        ELSE
          UPDATE products
             SET stock_quantity = GREATEST(0, stock_quantity - v_quantity),
                 updated_at = now()
           WHERE id = v_product_id
             AND organization_id = v_org_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
    INSERT INTO sale_payments (
      organization_id, sale_id, method, amount, change_amount, status, paid_at
    ) VALUES (
      v_org_id, v_sale_id,
      (v_payment->>'method')::payment_method,
      (v_payment->>'amount')::numeric,
      COALESCE((v_payment->>'change_amount')::numeric, 0),
      'confirmed', now()
    );
    IF (v_payment->>'method') = 'cash' THEN
      v_cash_net := v_cash_net + (v_payment->>'amount')::numeric
        - COALESCE((v_payment->>'change_amount')::numeric, 0);
    END IF;
  END LOOP;

  IF v_cash_net > 0 THEN
    INSERT INTO pos_cash_movements (
      organization_id, branch_id, cash_session_id, post_id, movement_type, amount, created_by
    ) VALUES (v_org_id, p_branch_id, p_session_id, p_post_id, 'sale_cash_in', v_cash_net, v_user_id);

    UPDATE cash_sessions
       SET expected_amount = expected_amount + v_cash_net, updated_at = now()
     WHERE id = p_session_id;
  END IF;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_org_id, p_branch_id, v_user_id, 'pos_sale_completed', 'sales', v_sale_id, NULL,
    jsonb_build_object('total', v_total));

  RETURN v_sale_id;
END; $$;

-- ── RPC: pos_close_cash_session ───────────────────────
CREATE OR REPLACE FUNCTION public.pos_close_cash_session(
  p_session_id   uuid,
  p_final_amount numeric,
  p_notes        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id          uuid;
  v_user_id         uuid;
  v_branch_id       uuid;
  v_expected_amount numeric;
  v_status          text;
BEGIN
  v_org_id := current_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuário sem organização.'; END IF;

  SELECT id INTO v_user_id FROM user_profiles
    WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  SELECT branch_id, expected_amount, status::text
    INTO v_branch_id, v_expected_amount, v_status
    FROM cash_sessions WHERE id = p_session_id AND organization_id = v_org_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada.'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Sessão já encerrada.'; END IF;

  UPDATE cash_sessions SET
    status            = 'closed',
    closed_at         = now(),
    final_amount      = p_final_amount,
    difference_amount = p_final_amount - v_expected_amount,
    notes             = COALESCE(p_notes, notes),
    updated_at        = now()
  WHERE id = p_session_id;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_org_id, v_branch_id, v_user_id, 'pos_session_closed', 'cash_sessions', p_session_id, NULL,
    jsonb_build_object('final_amount', p_final_amount, 'expected', v_expected_amount,
                       'difference', p_final_amount - v_expected_amount));
END; $$;

-- ── RPC: pos_create_cash_movement ─────────────────────
CREATE OR REPLACE FUNCTION public.pos_create_cash_movement(
  p_session_id    uuid,
  p_movement_type public.pos_cash_movement_type,
  p_amount        numeric,
  p_notes         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id      uuid;
  v_user_id     uuid;
  v_branch_id   uuid;
  v_post_id     uuid;
  v_status      text;
  v_movement_id uuid;
BEGIN
  v_org_id := current_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuário sem organização.'; END IF;

  SELECT id INTO v_user_id FROM user_profiles
    WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  SELECT branch_id, post_id, status::text
    INTO v_branch_id, v_post_id, v_status
    FROM cash_sessions WHERE id = p_session_id AND organization_id = v_org_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada.'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Sessão já encerrada.'; END IF;

  INSERT INTO pos_cash_movements (
    organization_id, branch_id, cash_session_id, post_id,
    movement_type, amount, created_by, notes
  ) VALUES (
    v_org_id, v_branch_id, p_session_id, v_post_id,
    p_movement_type, p_amount, v_user_id, p_notes
  ) RETURNING id INTO v_movement_id;

  IF p_movement_type IN ('cash_in','change_reinforcement') THEN
    UPDATE cash_sessions SET expected_amount = expected_amount + p_amount, updated_at = now()
     WHERE id = p_session_id;
  ELSIF p_movement_type IN ('sangria','cash_out') THEN
    UPDATE cash_sessions SET expected_amount = expected_amount - p_amount, updated_at = now()
     WHERE id = p_session_id;
  END IF;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_org_id, v_branch_id, v_user_id, 'pos_cash_movement', 'pos_cash_movements', v_movement_id, NULL,
    jsonb_build_object('type', p_movement_type, 'amount', p_amount));

  RETURN v_movement_id;
END; $$;

-- ── Grants RPCs ───────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.pos_open_cash_session    TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_complete_sale        TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_close_cash_session   TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_create_cash_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_set_operator_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.pos_verify_operator TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
