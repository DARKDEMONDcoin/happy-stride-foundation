CREATE OR REPLACE FUNCTION private.run_nour_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE t text;
BEGIN
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'nour-weekly';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--176da9aa-7e28-4bd2-b2d6-4e8945afeeb2.lovable.app/api/public/nour-automations',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', t),
    body := '{}'::jsonb
  );
END; $$;

REVOKE ALL ON FUNCTION private.run_nour_automations() FROM PUBLIC;

SELECT cron.schedule('nour-automations-runner', '5 * * * *', 'SELECT private.run_nour_automations();');