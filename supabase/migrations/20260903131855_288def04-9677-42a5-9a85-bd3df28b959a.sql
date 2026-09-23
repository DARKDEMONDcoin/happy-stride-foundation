CREATE TABLE IF NOT EXISTS public.app_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_secrets FROM anon, authenticated;
GRANT ALL ON public.app_secrets TO service_role;

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- لا توجد أي سياسات: لا أحد يستطيع القراءة عبر الواجهة العامة، فقط الخادم الموثوق.