CREATE TABLE IF NOT EXISTS public.site_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  url TEXT NOT NULL,
  page_url TEXT,
  alt TEXT,
  kind TEXT NOT NULL DEFAULT 'image',
  source TEXT NOT NULL DEFAULT 'website',
  weight INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_assets TO authenticated;
GRANT ALL ON public.site_assets TO service_role;
ALTER TABLE public.site_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage site assets" ON public.site_assets
  FOR ALL TO authenticated
  USING (public.owns_workspace(workspace_id))
  WITH CHECK (public.owns_workspace(workspace_id));
CREATE INDEX IF NOT EXISTS site_assets_workspace_idx ON public.site_assets (workspace_id, created_at DESC);