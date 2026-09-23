GRANT INSERT, UPDATE ON public.employee_runs TO authenticated;
CREATE POLICY "Owners add employee runs" ON public.employee_runs FOR INSERT TO authenticated WITH CHECK (owns_workspace(workspace_id));
CREATE POLICY "Owners update employee runs" ON public.employee_runs FOR UPDATE TO authenticated USING (owns_workspace(workspace_id)) WITH CHECK (owns_workspace(workspace_id));
GRANT UPDATE ON public.employee_feedback TO authenticated;
CREATE POLICY "Owners update employee feedback" ON public.employee_feedback FOR UPDATE TO authenticated USING (owns_workspace(workspace_id)) WITH CHECK (owns_workspace(workspace_id));