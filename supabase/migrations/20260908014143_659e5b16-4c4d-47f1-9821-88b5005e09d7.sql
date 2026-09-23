CREATE TABLE public.command_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  external_id text NOT NULL,
  label text,
  role text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_links TO authenticated;
GRANT ALL ON public.command_links TO service_role;
ALTER TABLE public.command_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages command links" ON public.command_links FOR ALL TO authenticated
  USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE TABLE public.command_link_codes (
  code text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  role text NOT NULL DEFAULT 'owner',
  label text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_link_codes TO authenticated;
GRANT ALL ON public.command_link_codes TO service_role;
ALTER TABLE public.command_link_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages link codes" ON public.command_link_codes FOR ALL TO authenticated
  USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

CREATE TABLE public.command_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  external_id text NOT NULL,
  employee_id text NOT NULL DEFAULT 'sonny',
  providers text[] NOT NULL DEFAULT '{}',
  request text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  image_url text,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX command_drafts_pending_idx ON public.command_drafts (channel, external_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_drafts TO authenticated;
GRANT ALL ON public.command_drafts TO service_role;
ALTER TABLE public.command_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages command drafts" ON public.command_drafts FOR ALL TO authenticated
  USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER command_drafts_updated_at BEFORE UPDATE ON public.command_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();