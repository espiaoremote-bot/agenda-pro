-- Coluna para marcar profissional como pago (premium, sem anuncios) ou gratuito (com anuncios)
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE;
