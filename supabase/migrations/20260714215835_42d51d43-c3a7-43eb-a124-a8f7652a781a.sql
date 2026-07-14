
CREATE POLICY "import-uploads project read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'import-uploads'
    AND (storage.foldername(name))[1] = public.get_user_project_id(auth.uid())::text
  );

CREATE POLICY "import-uploads project insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'import-uploads'
    AND (storage.foldername(name))[1] = public.get_user_project_id(auth.uid())::text
  );

CREATE POLICY "import-uploads project update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'import-uploads'
    AND (storage.foldername(name))[1] = public.get_user_project_id(auth.uid())::text
  );

CREATE POLICY "import-uploads project delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'import-uploads'
    AND (storage.foldername(name))[1] = public.get_user_project_id(auth.uid())::text
  );
