REVOKE ALL ON FUNCTION public.capture_task_learning_feedback() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_task_learning_feedback() FROM anon;
REVOKE ALL ON FUNCTION public.capture_task_learning_feedback() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.capture_task_learning_feedback() TO service_role;