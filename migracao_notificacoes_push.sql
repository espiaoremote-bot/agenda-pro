-- Registro dos dispositivos e assinaturas Push por profissional.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id text PRIMARY KEY,
  profissional_id integer NOT NULL
    REFERENCES public.profissionais(id) ON DELETE CASCADE,
  plataforma text NOT NULL
    CHECK (plataforma IN ('android', 'web')),
  token_fcm text,
  assinatura_web jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_check CHECK (
    (plataforma = 'android' AND token_fcm IS NOT NULL)
    OR (plataforma = 'web' AND assinatura_web IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS push_subscriptions_profissional_id_idx
  ON public.push_subscriptions (profissional_id);

CREATE TABLE IF NOT EXISTS public.push_deliveries (
  agendamento_id bigint PRIMARY KEY,
  status text NOT NULL DEFAULT 'sending'
    CHECK (status IN ('sending', 'sent', 'failed')),
  enviados integer NOT NULL DEFAULT 0,
  erro text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- As tabelas ficam acessíveis somente às funções Edge com service-role.
-- O endpoint de dispositivos valida as credenciais do profissional antes
-- de registrar, associar ou remover uma assinatura.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
