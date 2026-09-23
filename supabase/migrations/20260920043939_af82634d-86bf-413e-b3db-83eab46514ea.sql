CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  detail JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS integration_events_unique_key
  ON public.integration_events (workspace_id, provider, event_key);
CREATE INDEX IF NOT EXISTS integration_events_workspace_created
  ON public.integration_events (workspace_id, created_at DESC);

GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their integration events"
  ON public.integration_events FOR SELECT TO authenticated
  USING (public.owns_workspace(workspace_id));