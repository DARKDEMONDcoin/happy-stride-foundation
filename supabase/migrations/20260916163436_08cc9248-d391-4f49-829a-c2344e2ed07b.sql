CREATE TABLE public.employee_learning_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  auto_promote_low_risk boolean NOT NULL DEFAULT true,
  experiment_percent integer NOT NULL DEFAULT 15 CHECK (experiment_percent BETWEEN 0 AND 50),
  minimum_evidence integer NOT NULL DEFAULT 3 CHECK (minimum_evidence BETWEEN 2 AND 20),
  minimum_improvement real NOT NULL DEFAULT 4 CHECK (minimum_improvement BETWEEN 0 AND 25),
  paused_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_learning_settings TO authenticated;
GRANT ALL ON public.employee_learning_settings TO service_role;
ALTER TABLE public.employee_learning_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage learning settings" ON public.employee_learning_settings FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER employee_learning_settings_updated BEFORE UPDATE ON public.employee_learning_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.employee_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  capability text,
  request_text text NOT NULL,
  original_output text NOT NULL,
  final_output text NOT NULL,
  quality_score integer CHECK (quality_score BETWEEN 0 AND 100),
  quality_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  was_revised boolean NOT NULL DEFAULT false,
  policy_version integer NOT NULL DEFAULT 1,
  applied_lesson_ids uuid[] NOT NULL DEFAULT '{}',
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','approved','edited','rejected','published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employee_runs TO authenticated;
GRANT ALL ON public.employee_runs TO service_role;
ALTER TABLE public.employee_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view employee runs" ON public.employee_runs FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id));
CREATE TRIGGER employee_runs_updated BEFORE UPDATE ON public.employee_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX employee_runs_workspace_employee_created_idx ON public.employee_runs(workspace_id, employee_id, created_at DESC);
CREATE INDEX employee_runs_task_idx ON public.employee_runs(task_id) WHERE task_id IS NOT NULL;

CREATE TABLE public.employee_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  run_id uuid REFERENCES public.employee_runs(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('approved','edited','rejected','published','metric','note')),
  reason text,
  original_text text,
  edited_text text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight real NOT NULL DEFAULT 1 CHECK (weight BETWEEN 0 AND 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.employee_feedback TO authenticated;
GRANT ALL ON public.employee_feedback TO service_role;
ALTER TABLE public.employee_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view employee feedback" ON public.employee_feedback FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id));
CREATE POLICY "Owners add employee feedback" ON public.employee_feedback FOR INSERT TO authenticated WITH CHECK (public.owns_workspace(workspace_id));
CREATE INDEX employee_feedback_workspace_employee_created_idx ON public.employee_feedback(workspace_id, employee_id, created_at DESC);
CREATE UNIQUE INDEX employee_feedback_task_kind_once_idx ON public.employee_feedback(task_id, kind) WHERE task_id IS NOT NULL AND kind IN ('approved','rejected','published');

CREATE TABLE public.employee_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  title text NOT NULL,
  instruction text NOT NULL,
  scope text NOT NULL DEFAULT 'general',
  source_kind text NOT NULL DEFAULT 'feedback',
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','testing','approved','active','rejected','rolled_back','expired')),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','high')),
  confidence real NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  evidence_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  activated_at timestamptz,
  expires_at timestamptz,
  supersedes_id uuid REFERENCES public.employee_lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_lessons TO authenticated;
GRANT ALL ON public.employee_lessons TO service_role;
ALTER TABLE public.employee_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage employee lessons" ON public.employee_lessons FOR ALL TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER employee_lessons_updated BEFORE UPDATE ON public.employee_lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX employee_lessons_active_idx ON public.employee_lessons(workspace_id, employee_id, status, updated_at DESC);

CREATE TABLE public.employee_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.employee_lessons(id) ON DELETE CASCADE,
  sample_size integer NOT NULL DEFAULT 0,
  baseline_score real,
  candidate_score real,
  improvement real,
  safety_passed boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employee_evaluations TO authenticated;
GRANT ALL ON public.employee_evaluations TO service_role;
ALTER TABLE public.employee_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view employee evaluations" ON public.employee_evaluations FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id));
CREATE INDEX employee_evaluations_lesson_created_idx ON public.employee_evaluations(lesson_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.capture_task_learning_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_kind text;
  linked_run uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  event_kind := CASE NEW.status WHEN 'done' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE NULL END;
  IF event_kind IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO linked_run FROM public.employee_runs WHERE task_id = NEW.id ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.employee_feedback (workspace_id, employee_id, run_id, task_id, kind, weight)
  VALUES (NEW.workspace_id, NEW.employee_id, linked_run, NEW.id, event_kind, CASE WHEN event_kind = 'rejected' THEN 2 ELSE 1 END)
  ON CONFLICT DO NOTHING;
  UPDATE public.employee_runs SET outcome = event_kind WHERE id = linked_run;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tasks_capture_learning_feedback AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.capture_task_learning_feedback();