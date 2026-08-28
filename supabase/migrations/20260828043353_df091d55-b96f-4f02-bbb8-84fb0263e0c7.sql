ALTER TABLE public.survey_responses
  DROP CONSTRAINT IF EXISTS chk_nationality_len,
  DROP CONSTRAINT IF EXISTS chk_cep_len,
  DROP CONSTRAINT IF EXISTS chk_neighborhood_len,
  DROP CONSTRAINT IF EXISTS chk_phone_len;

ALTER TABLE public.survey_responses
  ALTER COLUMN nationality DROP NOT NULL,
  ALTER COLUMN cep DROP NOT NULL,
  ALTER COLUMN neighborhood DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN full_name DROP NOT NULL;

ALTER TABLE public.survey_responses
  ADD CONSTRAINT chk_nationality_len CHECK (nationality IS NULL OR char_length(nationality) <= 80),
  ADD CONSTRAINT chk_cep_len CHECK (cep IS NULL OR char_length(cep) <= 12),
  ADD CONSTRAINT chk_neighborhood_len CHECK (neighborhood IS NULL OR char_length(neighborhood) <= 80),
  ADD CONSTRAINT chk_phone_len CHECK (phone IS NULL OR char_length(phone) <= 30);

ALTER TABLE public.survey_responses DROP CONSTRAINT IF EXISTS chk_full_name_len;
ALTER TABLE public.survey_responses
  ADD CONSTRAINT chk_full_name_len CHECK (full_name IS NULL OR char_length(full_name) <= 120);