CREATE OR REPLACE FUNCTION private.run_social_queue()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'private','public'
AS $function$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.social_posts WHERE status = 'scheduled' AND scheduled_at <= now()) THEN
    SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-queue';
    IF t IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://project--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/api/public/social-queue',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
        body := '{}'::jsonb);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.social_autopilot WHERE active = true AND next_run_at <= now()) THEN
    SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-autopilot';
    IF t IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://project--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/api/public/social-autopilot',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
        body := '{}'::jsonb);
    END IF;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION private.run_social_autopilot()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'private','public'
AS $function$
DECLARE t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.social_autopilot WHERE active = true AND next_run_at <= now()) THEN RETURN; END IF;
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'social-autopilot';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/api/public/social-autopilot',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
    body := '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION private.run_morning_briefing()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'private','public'
AS $function$
DECLARE t text;
BEGIN
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'morning-briefing';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/api/public/morning-briefing',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
    body := '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION private.run_nour_automations()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'private','public'
AS $function$
DECLARE t text;
BEGIN
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'nour-weekly';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/api/public/nour-automations',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
    body := '{}'::jsonb);
END; $function$;

CREATE OR REPLACE FUNCTION private.run_nour_weekly()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'private','extensions','public'
AS $function$
DECLARE t text;
BEGIN
  SELECT token INTO t FROM private.cron_tokens WHERE name = 'nour-weekly';
  IF t IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://project--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/api/public/nour-weekly',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
    body := '{}'::jsonb);
END; $function$;