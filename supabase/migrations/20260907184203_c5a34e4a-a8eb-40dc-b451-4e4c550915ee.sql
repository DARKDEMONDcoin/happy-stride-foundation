CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  host text,
  path text NOT NULL DEFAULT '/',
  referrer text,
  source text,
  country text,
  visitor_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_visits_ws_time_idx ON public.site_visits (workspace_id, created_at DESC);

GRANT SELECT ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read their site visits" ON public.site_visits;
CREATE POLICY "owners read their site visits"
ON public.site_visits FOR SELECT TO authenticated
USING (public.owns_workspace(workspace_id));