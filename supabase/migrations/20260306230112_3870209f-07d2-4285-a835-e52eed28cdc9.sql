
-- Fix overly permissive INSERT policy on project_requests
DROP POLICY IF EXISTS "Trigger can insert requests" ON public.project_requests;
CREATE POLICY "Users can insert own request" ON public.project_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
