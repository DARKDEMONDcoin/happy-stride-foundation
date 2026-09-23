CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  approval_ready boolean NOT NULL DEFAULT true,
  integration_disconnected boolean NOT NULL DEFAULT true,
  publishing_failed boolean NOT NULL DEFAULT true,
  weekly_summary boolean NOT NULL DEFAULT true,
  task_digest boolean NOT NULL DEFAULT true,
  digest_frequency text NOT NULL DEFAULT 'weekly',
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_preferences_updated
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();