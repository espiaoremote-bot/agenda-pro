import { supabase } from "../supabaseClient";
import { getToken } from "./agendamentosApi";

// =====================================================================
//  Camada de acesso a SERVIÇOS e PROMOÇÕES via RPCs (security definer).
//  Depois que o RLS é ligado no banco (_blindagem_servicos_promocoes.sql),
//  o app NÃO pode mais escrever nessas tabelas direto — passa por aqui.
//  A LEITURA continua pública (select direto funciona normalmente).
//
//  O profissional é identificado por um TOKEN de sessão (agundamentosApi).
// =====================================================================

// ---- Helpers ------------------------------------------------------------
// Devolve o registro único de um `returns setof` (array -> primeiro item).
function primeiro(dado) {
  return Array.isArray(dado) ? dado[0] : dado;
}

// ---- SERVIÇOS -----------------------------------------------------------

// Cria um serviço do dono da sessão. Devolve o registro criado.
export async function servCriar({ nome, valor, duracao }) {
  const { data, error } = await supabase.rpc("serv_criar", {
    p_token: getToken(),
    p_nome: nome,
    p_valor: valor,
    p_duracao: duracao,
  });
  if (error) throw error;
  return primeiro(data);
}

// Atualiza um serviço do dono. campos é um objeto só com as colunas
// permitidas (nome, valor, duracao, ativo). Devolve o registro.
export async function servAtualizar(id, campos) {
  const { data, error } = await supabase.rpc("serv_atualizar", {
    p_token: getToken(),
    p_id: id,
    p_campos: campos,
  });
  if (error) throw error;
  return primeiro(data);
}

// Exclui um serviço do dono. Devolve quantos foram excluídos.
export async function servExcluir(id) {
  const { data, error } = await supabase.rpc("serv_excluir", {
    p_token: getToken(),
    p_id: id,
  });
  if (error) throw error;
  return data || 0;
}

// ---- PROMOÇÕES ----------------------------------------------------------

// Cria uma promoção do dono da sessão. Devolve o registro criado.
export async function promoCriar({ servico, valor, duracao }) {
  const { data, error } = await supabase.rpc("promo_criar", {
    p_token: getToken(),
    p_servico: servico,
    p_valor: valor,
    p_duracao: duracao,
  });
  if (error) throw error;
  return primeiro(data);
}

// Atualiza uma promoção do dono. campos é um objeto só com as colunas
// permitidas (valor, duracao, meses, semanas, dias_semana, ativo).
// Devolve o registro.
export async function promoAtualizar(id, campos) {
  const { data, error } = await supabase.rpc("promo_atualizar", {
    p_token: getToken(),
    p_id: id,
    p_campos: campos,
  });
  if (error) throw error;
  return primeiro(data);
}

// Atualiza VÁRIAS promoções de uma vez (só períodos: meses, semanas,
// dias_semana). Devolve quantas foram alteradas.
export async function promoAtualizarVarios(ids, campos) {
  const { data, error } = await supabase.rpc("promo_atualizar_varios", {
    p_token: getToken(),
    p_ids: ids,
    p_campos: campos,
  });
  if (error) throw error;
  return data || 0;
}

// Exclui uma promoção do dono. Devolve quantas foram excluídas.
export async function promoExcluir(id) {
  const { data, error } = await supabase.rpc("promo_excluir", {
    p_token: getToken(),
    p_id: id,
  });
  if (error) throw error;
  return data || 0;
}

// Liga/desliga o seletor de promoções do próprio perfil. Devolve o novo valor.
export async function promoSeletor(habilitado) {
  const { data, error } = await supabase.rpc("promo_seletor", {
    p_token: getToken(),
    p_habilitado: habilitado,
  });
  if (error) throw error;
  return data;
}