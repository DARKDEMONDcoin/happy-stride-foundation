CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    (ws_id,'sonny','youtube','disconnected'),
    (ws_id,'sonny','pinterest','disconnected'),
    (ws_id,'sonny','reddit','disconnected'),
    (ws_id,'sonny','bluesky','disconnected'),
    (ws_id,'sonny','google-business','disconnected'),
    (ws_id,'eva','gmail','disconnected'),
    (ws_id,'eva','outlook','disconnected'),
    (ws_id,'eva','calendar','disconnected'),
    (ws_id,'eva','whatsapp','disconnected'),
    (ws_id,'eva','slack','disconnected'),
    (ws_id,'eva','notion','disconnected'),
    (ws_id,'eva','discord','disconnected'),
    (ws_id,'eva','telegram','disconnected'),
    (ws_id,'eva','zoom','disconnected'),
    (ws_id,'eva','trello','disconnected'),
    (ws_id,'eva','asana','disconnected'),
    (ws_id,'eva','jira','disconnected'),
    (ws_id,'eva','clickup','disconnected'),
    (ws_id,'eva','monday','disconnected'),
    (ws_id,'sam','hubspot','disconnected'),
    (ws_id,'sam','salesforce','disconnected'),
    (ws_id,'sam','sheets','disconnected'),
    (ws_id,'sam','mailchimp','disconnected'),
    (ws_id,'sam','pipedrive','disconnected'),
    (ws_id,'sam','intercom','disconnected'),
    (ws_id,'sam','twilio','disconnected'),
    (ws_id,'sam','airtable','disconnected'),
    (ws_id,'sam','stripe','disconnected'),
    (ws_id,'nour','wordpress','disconnected'),
    (ws_id,'nour','search-console','disconnected'),
    (ws_id,'nour','indexnow','disconnected'),
    (ws_id,'nour','shopify','disconnected'),
    (ws_id,'nour','webflow','disconnected'),
    (ws_id,'nour','ghost','disconnected'),
    (ws_id,'dana','figma','disconnected'),
    (ws_id,'dana','canva','disconnected'),
    (ws_id,'dana','drive','disconnected'),
    (ws_id,'adam','analytics','disconnected'),
    (ws_id,'adam','meta-ads','disconnected'),
    (ws_id,'adam','google-ads','disconnected');

  INSERT INTO public.brain_items (workspace_id, kind, title, meta, body, used_by) VALUES
    (ws_id,'note','نبرة العلامة: دافئة، واثقة، بدون مبالغة','ملاحظة · تم إنشاؤها تلقائياً','اكتب دائماً بنبرة دافئة وواثقة وبدون مبالغة.', ARRAY['sonny','nour','eva']),
    (ws_id,'note','كلمات ممنوعة: «الأفضل في العالم»، «مجاناً 100%»','ملاحظة · قاعدة إلزامية','تجنّب هذه العبارات في كل المخرجات.', ARRAY['sonny','nour','sam']);
  RETURN NEW;
END; $function$;

DELETE FROM public.integrations WHERE provider = 'threads';