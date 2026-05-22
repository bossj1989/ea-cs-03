-- PostgreSQL Row-Level Security setup for multi-tenant isolation on `orders`

-- Ensure tenant column is present and not nullable
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS tenant_id text;

ALTER TABLE orders
  ALTER COLUMN tenant_id SET NOT NULL;

-- Enable and enforce RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

-- Clean up old policy name if rerun
DROP POLICY IF EXISTS orders_tenant_isolation ON orders;

-- Policy: allow SELECT and INSERT only when tenant_id matches session tenant
CREATE POLICY orders_tenant_isolation
ON orders
FOR SELECT, INSERT
USING (
  tenant_id = current_setting('app.current_tenant', true)
)
WITH CHECK (
  tenant_id = current_setting('app.current_tenant', true)
);
