DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_coaches') THEN
    EXECUTE 'ALTER TABLE IF EXISTS public.team_coaches ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.team_coaches';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_coaches') THEN EXECUTE 'CREATE POLICY "Enable all for authenticated users" ON public.team_coaches FOR ALL USING (auth.role() = ''''authenticated'''')'';'; END IF; END $wrap$;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_branches') THEN
    EXECUTE 'ALTER TABLE IF EXISTS public.team_branches ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.team_branches';
    EXECUTE 'DO $wrap$ BEGIN IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='team_branches') THEN EXECUTE 'CREATE POLICY "Enable all for authenticated users" ON public.team_branches FOR ALL USING (auth.role() = ''''authenticated'''')'';'; END IF; END $wrap$;
  END IF;
END $$;
