alter table public.employee_learning_settings
  alter column enabled set default true,
  alter column auto_promote_low_risk set default true;

update public.employee_learning_settings
set enabled = true, auto_promote_low_risk = true, paused_reason = null;