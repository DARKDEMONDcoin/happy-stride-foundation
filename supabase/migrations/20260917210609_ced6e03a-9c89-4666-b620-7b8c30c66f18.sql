insert into private.cron_tokens (name, token)
values ('learning-cycle', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

create or replace function private.run_learning_cycle()
returns void
language plpgsql
security definer
set search_path to 'private', 'extensions', 'public'
as $$
declare t text;
begin
  select token into t from private.cron_tokens where name = 'learning-cycle';
  if t is null then return; end if;
  perform net.http_post(
    url := 'https://project--330ebaef-0a29-4e52-b96f-ce6f58250b56.lovable.app/api/public/learning-cycle',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', t),
    body := '{}'::jsonb);
end; $$;

select cron.schedule('learning-cycle-runner', '30 1 * * *', 'SELECT private.run_learning_cycle();');