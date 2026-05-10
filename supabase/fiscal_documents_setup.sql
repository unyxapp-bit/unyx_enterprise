-- ======================================================
-- Unyx Fiscal Documents - local coupons and NFC-e drafts
-- Execute no Supabase SQL Editor
-- ======================================================
-- This module does not transmit to SEFAZ. It stores local
-- operational receipts and NFC-e drafts for later integration.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.fiscal_document_counters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  doc_type        text NOT NULL,
  series          text NOT NULL DEFAULT '1',
  next_number     bigint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, branch_id, doc_type, series)
);

CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id              uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  sale_id                uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  created_by             uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  doc_type               text NOT NULL,
  status                 text NOT NULL DEFAULT 'draft',
  operation_mode         text NOT NULL DEFAULT 'offline',
  series                 text NOT NULL DEFAULT '1',
  number                 bigint NOT NULL,
  fiscal_key             text NOT NULL,
  sefaz_protocol         text,
  sefaz_authorized_at    timestamptz,
  sefaz_rejection_reason text,
  issuer_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,
  customer_snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                  text,
  issued_at              timestamptz NOT NULL DEFAULT now(),
  cancelled_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, branch_id, doc_type, series, number),
  UNIQUE (organization_id, fiscal_key)
);

DO $$ BEGIN
  ALTER TABLE public.fiscal_document_counters
    ADD CONSTRAINT fiscal_document_counters_doc_type_check
    CHECK (doc_type IN ('internal_coupon','nfce_draft'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.fiscal_documents
    ADD CONSTRAINT fiscal_documents_doc_type_check
    CHECK (doc_type IN ('internal_coupon','nfce_draft'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.fiscal_documents
    ADD CONSTRAINT fiscal_documents_status_check
    CHECK (status IN ('draft','ready_to_print','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.fiscal_documents
    ADD CONSTRAINT fiscal_documents_operation_mode_check
    CHECK (operation_mode IN ('offline','sefaz_pending','sefaz_authorized','sefaz_rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_organization
ON public.fiscal_documents(organization_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_branch
ON public.fiscal_documents(branch_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_sale
ON public.fiscal_documents(sale_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_issued_at
ON public.fiscal_documents(issued_at DESC);

ALTER TABLE public.fiscal_document_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_counters_read" ON public.fiscal_document_counters;
DROP POLICY IF EXISTS "fiscal_counters_write" ON public.fiscal_document_counters;
CREATE POLICY "fiscal_counters_read" ON public.fiscal_document_counters FOR SELECT
  USING (
    organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor')
  );
CREATE POLICY "fiscal_counters_write" ON public.fiscal_document_counters FOR ALL
  USING (
    organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor')
  );

DROP POLICY IF EXISTS "fiscal_documents_read" ON public.fiscal_documents;
DROP POLICY IF EXISTS "fiscal_documents_write" ON public.fiscal_documents;
CREATE POLICY "fiscal_documents_read" ON public.fiscal_documents FOR SELECT
  USING (
    organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor')
  );
CREATE POLICY "fiscal_documents_write" ON public.fiscal_documents FOR ALL
  USING (
    organization_id = current_organization_id()
    AND current_user_role() IN ('owner','admin','branch_manager','supervisor')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_document_counters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documents TO authenticated;

CREATE OR REPLACE FUNCTION public.fiscal_create_document_from_sale(
  p_sale_id uuid,
  p_doc_type text DEFAULT 'internal_coupon',
  p_series text DEFAULT '1',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_sale record;
  v_number bigint;
  v_doc_id uuid;
  v_status text;
  v_key text;
  v_issuer jsonb;
  v_customer jsonb;
  v_totals jsonb;
BEGIN
  v_org_id := current_organization_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Usuario sem organizacao.'; END IF;

  IF current_user_role() NOT IN ('owner','admin','branch_manager','supervisor') THEN
    RAISE EXCEPTION 'Sem permissao para documentos fiscais.';
  END IF;

  IF p_doc_type NOT IN ('internal_coupon','nfce_draft') THEN
    RAISE EXCEPTION 'Tipo de documento fiscal invalido.';
  END IF;

  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE auth_user_id = auth.uid() AND organization_id = v_org_id;

  SELECT s.*
    INTO v_sale
  FROM sales s
  WHERE s.id = p_sale_id AND s.organization_id = v_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda nao encontrada.';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Somente vendas concluidas podem gerar cupom.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM fiscal_documents
    WHERE sale_id = p_sale_id
      AND organization_id = v_org_id
      AND doc_type = p_doc_type
      AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Documento ja gerado para esta venda.';
  END IF;

  INSERT INTO fiscal_document_counters (
    organization_id, branch_id, doc_type, series, next_number
  ) VALUES (
    v_org_id, v_sale.branch_id, p_doc_type, COALESCE(NULLIF(p_series, ''), '1'), 1
  )
  ON CONFLICT (organization_id, branch_id, doc_type, series) DO NOTHING;

  UPDATE fiscal_document_counters
     SET next_number = next_number + 1,
         updated_at = now()
   WHERE organization_id = v_org_id
     AND branch_id = v_sale.branch_id
     AND doc_type = p_doc_type
     AND series = COALESCE(NULLIF(p_series, ''), '1')
  RETURNING next_number - 1 INTO v_number;

  v_status := CASE
    WHEN p_doc_type = 'nfce_draft' THEN 'draft'
    ELSE 'ready_to_print'
  END;

  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'trade_name', o.trade_name,
    'document', o.document
  )
    INTO v_issuer
  FROM organizations o
  WHERE o.id = v_org_id;

  IF v_sale.customer_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', c.id,
      'code', c.customer_code,
      'name', c.name,
      'document', c.document,
      'phone', c.phone,
      'email', c.email
    )
      INTO v_customer
    FROM customers c
    WHERE c.id = v_sale.customer_id;
  ELSE
    v_customer := jsonb_build_object('name', COALESCE(v_sale.customer_name, 'Consumidor final'));
  END IF;

  v_totals := jsonb_build_object(
    'subtotal', v_sale.subtotal,
    'discount_amount', v_sale.discount_amount,
    'total_amount', v_sale.total_amount
  );

  v_key := upper(substr(md5(v_org_id::text || p_sale_id::text || v_number::text || clock_timestamp()::text), 1, 32));

  INSERT INTO fiscal_documents (
    organization_id, branch_id, sale_id, created_by,
    doc_type, status, operation_mode, series, number, fiscal_key,
    issuer_snapshot, customer_snapshot, totals_snapshot, notes
  ) VALUES (
    v_org_id, v_sale.branch_id, p_sale_id, v_user_id,
    p_doc_type, v_status, 'offline', COALESCE(NULLIF(p_series, ''), '1'), v_number, v_key,
    COALESCE(v_issuer, '{}'::jsonb), COALESCE(v_customer, '{}'::jsonb), v_totals, NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_doc_id;

  INSERT INTO audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    v_org_id, v_sale.branch_id, v_user_id, 'fiscal_document_created', 'fiscal_documents', v_doc_id, NULL,
    jsonb_build_object('sale_id', p_sale_id, 'doc_type', p_doc_type, 'number', v_number)
  );

  RETURN v_doc_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.fiscal_create_document_from_sale(uuid, text, text, text) TO authenticated;
