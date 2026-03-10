CREATE POLICY "Owner can delete requests"
ON public.project_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));