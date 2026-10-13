-- Row-level security: every tenant table is visible only when
-- app.tenant_id matches (ADR-001). Generated from schema.prisma; keep in sync
-- (packages/db/test/rls.test.ts fails if a tenant table lacks a policy).

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Role" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Location" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditLog" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Counter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Counter" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Counter" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Category" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "TaxClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxClass" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TaxClass" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "TaxRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TaxRule" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Variant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Variant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Variant" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "StockLevel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockLevel" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockLevel" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockMovement" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Stocktake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stocktake" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Stocktake" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "StocktakeLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StocktakeLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StocktakeLine" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Shift" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashMovement" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Sale" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "SaleLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SaleLine" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Payment" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "SyncOp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncOp" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SyncOp" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Customer" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "LoyaltyEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoyaltyEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LoyaltyEntry" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "GiftCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GiftCard" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "GiftCard" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "GiftCardEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GiftCardEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "GiftCardEntry" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Supplier" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PurchaseOrder" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PurchaseOrderLine" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Transfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transfer" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Transfer" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "TransferLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransferLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TransferLine" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "DiningTable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiningTable" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DiningTable" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "TableTab" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TableTab" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TableTab" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "ModifierGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModifierGroup" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ModifierGroup" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "KitchenTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KitchenTicket" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KitchenTicket" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Quote" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Expense" USING ("tenantId" = unipos_current_tenant()) WITH CHECK ("tenantId" = unipos_current_tenant());

-- The stock ledger and audit log are append-only.
CREATE OR REPLACE FUNCTION unipos_forbid_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movement_append_only BEFORE UPDATE ON "StockMovement" FOR EACH ROW EXECUTE FUNCTION unipos_forbid_update();
CREATE TRIGGER audit_log_append_only BEFORE UPDATE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION unipos_forbid_update();

-- Grant the application role access if it exists (see prisma/sql/setup-roles.sql).
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'unipos_app') THEN
    GRANT USAGE ON SCHEMA public TO unipos_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unipos_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO unipos_app;
  END IF;
END $$;
