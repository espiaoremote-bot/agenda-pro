-- ============================================================
-- CONFIGURAÇÃO GLOBAL: permitir versão gratuita após expiração do plano
-- ============================================================
-- Quando esta opção estiver DESABILITADA (false), qualquer profissional
-- cujo plano vencer será automaticamente DESATIVADO (ativo = false).
-- Quando estiver HABILITADA (true), o profissional continua ativo na
-- versão gratuita (com anúncios) após o plano vencer.

CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Valor padrão: true (versão gratuita HABILITADA após expiração)
INSERT INTO public.configuracoes_sistema (chave, valor)
VALUES ('permitir_versao_gratuita_apos_expiracao', 'true')
ON CONFLICT (chave) DO NOTHING;

-- Habilitar RLS para leitura pública (qualquer um pode ler)
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'configuracoes_sistema' 
    AND policyname = 'Leitura pública de configurações do sistema'
  ) THEN
    CREATE POLICY "Leitura pública de configurações do sistema"
    ON public.configuracoes_sistema
    FOR SELECT
    USING (true);
  END IF;
END $$;