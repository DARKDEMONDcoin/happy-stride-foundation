-- lovable-cron-fallback-reviewed: 288 runs/day; social posts must publish at their exact scheduled peak-engagement minute, hourly polling would delay a 7:00 post to 7:59 and defeat the scheduling feature
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL DEFAULT 'sonny',
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'scheduled',
  attempts SMALLINT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  remote_ref TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their social posts" ON public.social_posts FOR ALL TO authenticated
USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE INDEX social_posts_due_idx ON public.social_posts (status, scheduled_at);
CREATE INDEX social_posts_workspace_idx ON public.social_posts (workspace_id, scheduled_at DESC);

CREATE TRIGGER social_posts_updated_at BEFORE UPDATE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO private.cron_tokens (name, token)
SELECT 'social-queue', encode(gen_random_bytes(24), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM private.cron_tokens WHERE name = 'social-queue');

CREATE OR REPLACE FUNCTION private.run_social_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.social_posts
    WHERE status = 'scheduled' AND scheduled_at <= now()
  ) THEN
    RETURN;
  END IF;
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-queue';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--c4bd074c-2c2d-444e-8f68-306d87a2b61b.lovable.app/api/public/social-queue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', t),
    body := '{}'::jsonb
  );
END; $$;

REVOKE ALL ON FUNCTION private.run_social_queue() FROM PUBLIC;

SELECT cron.schedule('social-queue-runner', '*/5 * * * *', 'SELECT private.run_social_queue();');