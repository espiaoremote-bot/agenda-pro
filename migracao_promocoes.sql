-- ============================================
--  PROMOÇÕES DO MÊS (Agenda Pro)
--  Rode este script no SQL Editor do Supabase.
-- ============================================

-- Tabela de promoções (serviços marcados com 💲 pelo profissional).
-- meses  : meses do ano em que a promoção vale (ex.: {11,12} = novembro e dezembro)
-- semanas: ativação por semana, no formato {"11": [true,true,true,true,false], "12": [...]}
--          (1ª até 5ª semana). Mês sem entrada = todas as semanas ativas.
CREATE TABLE IF NOT EXISTS public.promocoes (
  id serial PRIMARY KEY,
  profissional_id integer NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  servico text NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  duracao text NOT NULL DEFAULT '',
  meses integer[] NOT NULL DEFAULT '{}',
  semanas jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profissional_id, servico)
);

-- O profissional pode ATIVAR/DESATIVAR o seletor de promoções inteiro.
-- Quando false, o cliente não vê o seletor de serviços em promoção.
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS seletor_promocoes_habilitado boolean NOT NULL DEFAULT true;

-- O app acessa as tabelas direto pela chave pública (como as demais tabelas
-- do projeto, ex.: servicos e agendamentos), então RLS fica desligado aqui.
ALTER TABLE public.promocoes DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.promocoes IS
  'Serviços em promoção. semanas = {"11": [true,true,true,true,false]} por mês (1ª..5ª semana).';