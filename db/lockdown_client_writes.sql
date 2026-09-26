-- Applied to project dfpfkmrpnwioxzbwndzx on 2026-09-26 (migration
-- `lockdown_client_writes`). Recorded here so the repo matches production.
--
-- Supabase does not accept Privy JWTs (no third-party auth is configured), so
-- every browser request runs as `anon` and auth.jwt() is null. Edge logs for
-- the preceding 24h showed only `anon` and `service_role` requests, never
-- `authenticated`. These owner-scoped WRITE policies therefore never matched:
-- they were dormant rather than safe. If Privy were ever wired up as a Supabase
-- auth provider, they would let any user set their own wngs_balance, forge
-- transactions, and edit their assets/quests straight through PostgREST.
-- Every one of these writes already goes through a service-role API route
-- (api/v2/*), and no code in src/ writes to these tables, so the client never
-- needs them. The owner-scoped SELECT policies are kept.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users update own assets" ON public.user_assets;
DROP POLICY IF EXISTS "Users insert own quest progress" ON public.user_quests;
DROP POLICY IF EXISTS "Users update own quest progress" ON public.user_quests;
DROP POLICY IF EXISTS "Users update own digital inventory" ON public.user_digital_inventory;

-- Trigger-only functions have no business being callable over /rest/v1/rpc.
-- (Firing a trigger does not check EXECUTE; only CREATE TRIGGER does.)
REVOKE EXECUTE ON FUNCTION public.process_social_scan_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_artifact_activated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Verification: the only client-writable policy left should be the waitlist
-- INSERT (intentional).
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
--    AND 'public' = ANY(roles);
