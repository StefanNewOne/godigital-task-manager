-- TD-5: append-only заштита на ниво на база (CLAUDE.md §И6).
-- Апликацискиот role `gd_app` (≠ owner) не смее UPDATE/DELETE на append-only табелите.
-- Guarded: се применува само ако role-от постои (прод two-role setup). No-op во dev
-- (единствен owner role → нема `gd_app`), како што предвидува TD-5.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gd_app') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON "EventLog", "MetricSnapshot", "Revision", "Approval" FROM gd_app';
  END IF;
END
$$;
