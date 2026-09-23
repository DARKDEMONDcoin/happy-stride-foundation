CREATE POLICY "Service role only app secrets" ON public.app_secrets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only integration credentials" ON public.integration_credentials FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role only serp cache" ON public.serp_cache FOR ALL TO service_role USING (true) WITH CHECK (true);