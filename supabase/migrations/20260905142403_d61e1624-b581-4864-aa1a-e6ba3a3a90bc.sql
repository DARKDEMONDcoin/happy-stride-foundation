ALTER TABLE public.social_autopilot
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS days smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS slots text[] NOT NULL DEFAULT '{}';

UPDATE public.social_autopilot
SET slots = COALESCE((
  SELECT array_agg(lpad((((h + 3) % 24))::text, 2, '0') || ':00' ORDER BY h)
  FROM unnest(hours) AS h
), ARRAY['09:00'])
WHERE cardinality(slots) = 0;

CREATE OR REPLACE FUNCTION private.run_social_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE t text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.social_posts
    WHERE status = 'scheduled' AND scheduled_at <= now()
  ) THEN
    SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-queue';
    IF t IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://project--c4bd074c-2c2d-444e-8f68-306d87a2b61b.lovable.app/api/public/social-queue',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', t),
        body := '{}'::jsonb
      );
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.social_autopilot
    WHERE active = true AND next_run_at <= now()
  ) THEN
    SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-autopilot';
    IF t IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://project--c4bd074c-2c2d-444e-8f68-306d87a2b61b.lovable.app/api/public/social-autopilot',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', t),
        body := '{}'::jsonb
      );
    END IF;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION private.run_social_queue() FROM PUBLIC;

SELECT cron.unschedule('social-autopilot-runner');