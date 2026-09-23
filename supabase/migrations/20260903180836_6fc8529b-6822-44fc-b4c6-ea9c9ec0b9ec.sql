CREATE TABLE public.tracked_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  domain TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'SA',
  active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, keyword, domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_keywords TO authenticated;
GRANT ALL ON public.tracked_keywords TO service_role;
ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage tracked keywords" ON public.tracked_keywords FOR ALL TO authenticated
USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER tracked_keywords_updated_at BEFORE UPDATE ON public.tracked_keywords
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.rank_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES public.tracked_keywords(id) ON DELETE CASCADE,
  position SMALLINT,
  url TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rank_snapshots TO authenticated;
GRANT ALL ON public.rank_snapshots TO service_role;
ALTER TABLE public.rank_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage rank snapshots" ON public.rank_snapshots FOR ALL TO authenticated
USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE INDEX rank_snapshots_keyword_idx ON public.rank_snapshots (keyword_id, captured_at DESC);

CREATE POLICY "Owners read nour media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'nour-media' AND public.owns_workspace(NULLIF(split_part(name, '/', 1), '')::uuid));
CREATE POLICY "Owners upload nour media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'nour-media' AND public.owns_workspace(NULLIF(split_part(name, '/', 1), '')::uuid));