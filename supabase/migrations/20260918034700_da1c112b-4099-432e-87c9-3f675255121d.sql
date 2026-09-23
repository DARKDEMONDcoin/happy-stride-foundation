CREATE TABLE public.live_snapshots (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key)
);
GRANT ALL ON public.live_snapshots TO service_role;
ALTER TABLE public.live_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_snapshots service only" ON public.live_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);