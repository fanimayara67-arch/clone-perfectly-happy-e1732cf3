CREATE POLICY "Admins can update responses"
ON public.survey_responses
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete responses"
ON public.survey_responses
FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));