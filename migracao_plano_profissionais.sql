-- ============================================
-- PACOTE MENSAL — 30 dias de uso por profissional
-- Rode este script no Supabase:
--   Dashboard -> SQL Editor -> New query -> Run
-- O script é seguro (pode rodar quantas vezes quiser).
-- ============================================

-- 1) Cria as colunas do plano (IF NOT EXISTS = não apaga nada existente)
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS validade_plano TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plano_ilimitado BOOLEAN DEFAULT FALSE;

-- 2) Profissionais já existentes: ganham 30 dias de uso a partir de AGORA
--    (apenas quem ainda não tem validade cadastrada)
UPDATE profissionais
SET validade_plano = NOW() + INTERVAL '30 days',
    plano_ilimitado = FALSE
WHERE tipo <> 'super_admin'
  AND validade_plano IS NULL;

-- 3) O administrador (super_admin) fica sem prazo (uso permanente)
UPDATE profissionais
SET plano_ilimitado = TRUE,
    validade_plano = NULL
WHERE tipo = 'super_admin';

-- 4) Confere o resultado
SELECT id, nome, tipo, ativo, validade_plano, plano_ilimitado
FROM profissionais
ORDER BY id;