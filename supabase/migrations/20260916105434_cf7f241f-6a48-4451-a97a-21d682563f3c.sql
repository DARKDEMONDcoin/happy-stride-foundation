create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  identifier text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 1,
  unique (bucket, identifier, window_start)
);

grant all on public.rate_limits to service_role;

alter table public.rate_limits enable row level security;

create policy "Service role only rate limits"
  on public.rate_limits for all
  to service_role
  using (true) with check (true);

create index if not exists rate_limits_lookup_idx
  on public.rate_limits (bucket, identifier, window_start desc);

-- يزيد العدّاد داخل نافذة زمنية ويعيد العدد بعد الزيادة.
create or replace function public.bump_rate_limit(_bucket text, _identifier text, _window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _start timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  _hits integer;
begin
  insert into public.rate_limits (bucket, identifier, window_start, hits)
  values (_bucket, _identifier, _start, 1)
  on conflict (bucket, identifier, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into _hits;

  delete from public.rate_limits where window_start < now() - interval '1 day';

  return _hits;
end;
$$;

revoke all on function public.bump_rate_limit(text, text, integer) from public, anon, authenticated;