
create or replace function private.app_base_url()
returns text language sql immutable set search_path to 'private','public' as $$
  select 'https://project--03e4d277-af75-46c7-a00d-9e0a26303b1f.lovable.app'
$$;

create or replace function private.cron_post(_name text, _path text)
returns void language plpgsql security definer set search_path to 'private','public','extensions' as $$
declare t text;
begin
  select token into t from private.cron_tokens where name = _name;
  if t is null then return; end if;
  perform net.http_post(
    url := private.app_base_url() || _path,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end; $$;

create or replace function private.run_social_queue()
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin
  if exists (select 1 from public.social_posts where status = 'scheduled' and scheduled_at <= now()) then
    perform private.cron_post('social-queue', '/api/public/social-queue');
  end if;
  if exists (select 1 from public.social_autopilot where active = true and next_run_at <= now()) then
    perform private.cron_post('social-autopilot', '/api/public/social-autopilot');
  end if;
end; $$;

create or replace function private.run_social_autopilot()
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin
  if exists (select 1 from public.social_autopilot where active = true and next_run_at <= now()) then
    perform private.cron_post('social-autopilot', '/api/public/social-autopilot');
  end if;
end; $$;

create or replace function private.run_morning_briefing()
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin perform private.cron_post('morning-briefing', '/api/public/morning-briefing'); end; $$;

create or replace function private.run_nour_automations()
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin perform private.cron_post('nour-weekly', '/api/public/nour-automations'); end; $$;

create or replace function private.run_nour_weekly()
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin perform private.cron_post('nour-weekly', '/api/public/nour-weekly'); end; $$;

create or replace function private.run_learning_cycle()
returns void language plpgsql security definer set search_path to 'private','public' as $$
begin perform private.cron_post('learning-cycle', '/api/public/learning-cycle'); end; $$;

select cron.alter_job(3, schedule := '* * * * *');
