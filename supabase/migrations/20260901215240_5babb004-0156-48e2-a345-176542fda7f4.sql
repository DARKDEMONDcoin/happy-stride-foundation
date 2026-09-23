
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  dialect TEXT NOT NULL DEFAULT 'خليجية',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'عام',
  initials TEXT NOT NULL DEFAULT 'سه',
  tone TEXT NOT NULL DEFAULT 'دافئة، واثقة، بدون مبالغة',
  banned_words TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspaces" ON public.workspaces FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.owns_workspace(_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = auth.uid());
$$;

CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  account TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations" ON public.integrations FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE TABLE public.brain_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  meta TEXT,
  body TEXT,
  used_by TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_items TO authenticated;
GRANT ALL ON public.brain_items TO service_role;
ALTER TABLE public.brain_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brain" ON public.brain_items FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  channel TEXT NOT NULL DEFAULT 'instagram',
  status TEXT NOT NULL DEFAULT 'running',
  output TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.tasks FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.messages FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id UUID; company_name TEXT;
BEGIN
  company_name := COALESCE(NEW.raw_user_meta_data->>'company', NEW.raw_user_meta_data->>'full_name', 'مساحة عملي');
  INSERT INTO public.profiles (id, full_name, company, dialect)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', company_name, COALESCE(NEW.raw_user_meta_data->>'dialect', 'خليجية'));

  INSERT INTO public.workspaces (owner_id, name, industry, initials)
  VALUES (NEW.id, company_name, COALESCE(NEW.raw_user_meta_data->>'industry', 'عام'), substr(company_name, 1, 2))
  RETURNING id INTO ws_id;

  INSERT INTO public.integrations (workspace_id, employee_id, provider, status) VALUES
    (ws_id,'sonny','instagram','disconnected'),
    (ws_id,'sonny','x','disconnected'),
    (ws_id,'sonny','linkedin','disconnected'),
    (ws_id,'sonny','tiktok','disconnected'),
    (ws_id,'sonny','facebook','disconnected'),
    (ws_id,'eva','gmail','disconnected'),
    (ws_id,'eva','calendar','disconnected'),
    (ws_id,'eva','whatsapp','disconnected'),
    (ws_id,'sam','hubspot','disconnected'),
    (ws_id,'sam','sheets','disconnected'),
    (ws_id,'nour','wordpress','disconnected'),
    (ws_id,'nour','search-console','disconnected'),
    (ws_id,'dana','figma','disconnected'),
    (ws_id,'dana','canva','disconnected'),
    (ws_id,'adam','analytics','disconnected'),
    (ws_id,'adam','meta-ads','disconnected');

  INSERT INTO public.brain_items (workspace_id, kind, title, meta, body, used_by) VALUES
    (ws_id,'note','نبرة العلامة: دافئة، واثقة، بدون مبالغة','ملاحظة · تم إنشاؤها تلقائياً','اكتب دائماً بنبرة دافئة وواثقة وبدون مبالغة.', ARRAY['sonny','nour','eva']),
    (ws_id,'note','كلمات ممنوعة: «الأفضل في العالم»، «مجاناً 100%»','ملاحظة · قاعدة إلزامية','تجنّب هذه العبارات في كل المخرجات.', ARRAY['sonny','nour','sam']);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
