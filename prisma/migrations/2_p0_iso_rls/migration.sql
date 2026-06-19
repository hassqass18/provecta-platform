-- P0-ISO: tenant isolation via Row-Level Security.
--
-- Enforced for the non-BYPASSRLS login role `app_rls` only. The app's default
-- connection (neondb_owner) has the BYPASSRLS attribute, so admin / auth / crud
-- paths are intentionally unaffected and require no rewiring. The client portal
-- read path connects as app_rls via dbForTenant(), which sets the transaction-
-- local GUC `app.current_org`. When the GUC is unset the policies default-deny.
--
-- NOTE: the `app_rls` role must already exist (created out-of-band so its
-- password never lands in git). On prod, create it before `migrate deploy`.

-- Read access for the RLS role (rows further gated by the policies below).
GRANT USAGE ON SCHEMA public TO app_rls;
GRANT SELECT ON "Tenant", "Engagement", "Milestone", "Kpi", "Sla", "Invoice", "Ticket", "Document" TO app_rls;

-- Directly tenant-scoped tables ──────────────────────────────────────────
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Tenant"
  USING ("id" = current_setting('app.current_org', true));

ALTER TABLE "Engagement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Engagement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Engagement"
  USING ("tenantId" = current_setting('app.current_org', true));

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Invoice"
  USING ("tenantId" = current_setting('app.current_org', true));

ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ticket" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Ticket"
  USING ("tenantId" = current_setting('app.current_org', true));

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Document"
  USING ("tenantId" = current_setting('app.current_org', true));

-- Engagement-child tables (only engagementId) — scope via the parent engagement.
-- The subquery is itself RLS-filtered on Engagement, so it resolves to exactly
-- the current org's engagement ids.
ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Milestone"
  USING ("engagementId" IN (SELECT "id" FROM "Engagement" WHERE "tenantId" = current_setting('app.current_org', true)));

ALTER TABLE "Kpi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Kpi" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Kpi"
  USING ("engagementId" IN (SELECT "id" FROM "Engagement" WHERE "tenantId" = current_setting('app.current_org', true)));

ALTER TABLE "Sla" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sla" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Sla"
  USING ("engagementId" IN (SELECT "id" FROM "Engagement" WHERE "tenantId" = current_setting('app.current_org', true)));
