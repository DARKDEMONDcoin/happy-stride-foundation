CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  title text NOT NULL DEFAULT 'محادثة جديدة',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage conversations" ON public.conversations FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX conversations_workspace_employee_updated_idx ON public.conversations(workspace_id, employee_id, updated_at DESC);

ALTER TABLE public.messages ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
CREATE INDEX messages_conversation_created_idx ON public.messages(conversation_id, created_at);

CREATE TABLE public.brand_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  employee_id text,
  kind text NOT NULL DEFAULT 'fact',
  content text NOT NULL,
  source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  confidence real NOT NULL DEFAULT 0.8,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  superseded_by uuid REFERENCES public.brand_memories(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_memories TO authenticated;
GRANT ALL ON public.brand_memories TO service_role;
ALTER TABLE public.brand_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage brand memories" ON public.brand_memories FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER brand_memories_updated_at BEFORE UPDATE ON public.brand_memories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX brand_memories_workspace_active_idx ON public.brand_memories(workspace_id, valid_until, updated_at DESC) WHERE superseded_by IS NULL;
CREATE INDEX brand_memories_conversation_idx ON public.brand_memories(conversation_id, updated_at DESC);