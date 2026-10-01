-- ============================================
-- ENDEREÇO DO LOCAL — perfil do profissional
-- Rode este script no Supabase:
--   Dashboard -> SQL Editor -> New query -> Run
-- O script é seguro (pode rodar quantas vezes quiser).
-- ============================================

-- Cria as colunas do endereço (IF NOT EXISTS = não apaga nada existente)
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS endereco_rua TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
  ADD COLUMN IF NOT EXISTS mostrar_endereco BOOLEAN DEFAULT FALSE;

-- Por padrão, o endereço fica oculto na página do cliente até que
-- o profissional o ative (checkbox) nas Configurações.

-- 1) Confere o resultado
SELECT id, nome, chave_pix, endereco_rua, endereco_numero, endereco_cep, mostrar_endereco
FROM profissionais
ORDER BY id;