CREATE TABLE public.automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL DEFAULT 'nour',
  skill_id TEXT NOT NULL,
  label TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  cadence TEXT NOT NULL DEFAULT 'weekly',
  day_of_week SMALLINT NOT NULL DEFAULT 1,
  hour SMALLINT NOT NULL DEFAULT 9,
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their automations" ON public.automations FOR ALL TO authenticated
USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE INDEX automations_due_idx ON public.automations (active, next_run_at);

CREATE TRIGGER automations_updated_at BEFORE UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.serp_cache (
  cache_key TEXT NOT NULL PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.serp_cache TO service_role;
ALTER TABLE public.serp_cache ENABLE ROW LEVEL SECURITY;