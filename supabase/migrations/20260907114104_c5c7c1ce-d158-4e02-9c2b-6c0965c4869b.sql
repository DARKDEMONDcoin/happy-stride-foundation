CREATE TABLE public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('facebook','instagram')),
  page_id text NOT NULL,
  page_name text,
  page_access_token text NOT NULL,
  ig_user_id text,
  ig_username text,
  user_access_token text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind, page_id)
);

GRANT ALL ON public.meta_connections TO service_role;

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.meta_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER meta_connections_updated_at
  BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();