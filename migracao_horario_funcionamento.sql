ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS horario_funcionamento_inicio text,
  ADD COLUMN IF NOT EXISTS horario_funcionamento_fim text,
  ADD COLUMN IF NOT EXISTS mostrar_horario_funcionamento boolean NOT NULL DEFAULT false;
