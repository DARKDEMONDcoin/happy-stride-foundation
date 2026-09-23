CREATE TABLE public.pipedream_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  app_slug text NOT NULL,
  account_id text NOT NULL,
  account_name text,
  status text NOT NULL DEFAULT 'connected',
  healthy boolean NOT NULL DEFAULT true,
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, account_id)
);

CREATE INDEX pipedream_accounts_workspace_idx ON public.pipedream_accounts (workspace_id, provider);

GRANT SELECT ON public.pipedream_accounts TO authenticated;
GRANT ALL ON public.pipedream_accounts TO service_role;

ALTER TABLE public.pipedream_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read pipedream accounts"
ON public.pipedream_accounts FOR SELECT TO authenticated
USING (public.owns_workspace(workspace_id));

CREATE TRIGGER pipedream_accounts_updated_at
BEFORE UPDATE ON public.pipedream_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();