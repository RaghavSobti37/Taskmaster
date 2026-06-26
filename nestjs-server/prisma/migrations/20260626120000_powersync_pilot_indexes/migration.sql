-- Pilot additive migration for PowerSync publication tables (indexes for sync filters)
CREATE INDEX IF NOT EXISTS "Workspace_tenantId_idx" ON "Workspace"("tenantId");
CREATE INDEX IF NOT EXISTS "Project_tenantId_idx" ON "Project"("tenantId");
CREATE INDEX IF NOT EXISTS "Task_tenantId_idx" ON "Task"("tenantId");
CREATE INDEX IF NOT EXISTS "Task_projectId_idx" ON "Task"("projectId");
