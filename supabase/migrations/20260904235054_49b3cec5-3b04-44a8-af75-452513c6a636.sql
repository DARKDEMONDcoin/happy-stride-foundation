CREATE TABLE public.social_autopilot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id text NOT NULL DEFAULT 'sonny',
  active boolean NOT NULL DEFAULT false,
  providers text[] NOT NULL DEFAULT '{}',
  brief text NOT NULL DEFAULT '',
  dialect text NOT NULL DEFAULT 'خليجية',
  posts_per_day smallint NOT NULL DEFAULT 1,
  hours smallint[] NOT NULL DEFAULT '{9}',
  mode text NOT NULL DEFAULT 'review',
  with_image boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  paused_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_autopilot TO authenticated;
GRANT ALL ON public.social_autopilot TO service_role;

ALTER TABLE public.social_autopilot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their autopilot"
  ON public.social_autopilot FOR ALL TO authenticated
  USING (public.owns_workspace(workspace_id))
  WITH CHECK (public.owns_workspace(workspace_id));

CREATE INDEX social_autopilot_due_idx ON public.social_autopilot (active, next_run_at);

CREATE TRIGGER social_autopilot_updated_at
  BEFORE UPDATE ON public.social_autopilot
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO private.cron_tokens (name, token)
VALUES ('social-autopilot', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION private.run_social_autopilot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE t text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.social_autopilot
    WHERE active = true AND next_run_at <= now()
  ) THEN
    RETURN;
  END IF;
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-autopilot';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--c4bd074c-2c2d-444e-8f68-306d87a2b61b.lovable.app/api/public/social-autopilot',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', t),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('social-autopilot-runner', '10 * * * *', $$SELECT private.run_social_autopilot();$$);