ALTER TABLE public.command_links
  ADD COLUMN IF NOT EXISTS active_employee text,
  ADD COLUMN IF NOT EXISTS conversation_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_update_id bigint;