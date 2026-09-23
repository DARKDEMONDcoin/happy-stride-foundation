
alter table public.automations
  add column if not exists timezone text not null default 'Africa/Cairo',
  add column if not exists locked_at timestamptz;

create index if not exists automations_due_idx on public.automations (next_run_at) where active;
