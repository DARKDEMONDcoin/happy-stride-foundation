-- تشغيل أسبوعي تلقائي لحلقة القياس والتحسين الخاصة بنور (مجاناً عبر pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.cron_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.cron_tokens TO service_role;
ALTER TABLE private.cron_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO private.cron_tokens (name)
VALUES ('nour-weekly')
ON CONFLICT (name) DO NOTHING;

-- دالة تُقرأ بها بيانات الاعتماد داخلياً فقط
CREATE OR REPLACE FUNCTION private.run_nour_weekly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, extensions, public
AS $$
DECLARE t text;
BEGIN
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'nour-weekly';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--176da9aa-7e28-4bd2-b2d6-4e8945afeeb2.lovable.app/api/public/nour-weekly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', t),
    body := '{}'::jsonb
  );
END; $$;

REVOKE ALL ON FUNCTION private.run_nour_weekly() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('nour-weekly-seo-loop')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nour-weekly-seo-loop');

SELECT cron.schedule(
  'nour-weekly-seo-loop',
  '0 6 * * 1',
  $$SELECT private.run_nour_weekly();$$
);