import { supabase } from "../supabaseClient";

// =====================================================================
//  Camada de acesso aos AGENDAMENTOS via RPCs (security definer).
//  Depois que o RLS é ligado no banco (_blindagem_agendamentos.sql), o app
//  NÃO pode mais usar supabase.from("agendamentos") direto — passa por aqui.
//
//  O profissional é identificado por um TOKEN de sessão (guardado no
//  localStorage). O cliente que agenda é anônimo e usa as RPCs públicas.
// =====================================================================

const CHAVE_TOKEN = "agenda_token_sessao";

// ---- Token de sessão ---------------------------------------------------
export function getToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, String(token));
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* ignora */
  }
}

// ---- Helpers internos (dual-mode) ----------------------------------------
function getProfissionalLogadoId() {
  try {
    if (typeof window !== "undefined" && window.__profissionalLogadoId) {
      return window.__profissionalLogadoId;
    }
  } catch { /* ignora */ }
  return getProfissionalIdSalvo();
}

function getProfissionalIdSalvo() {
  try {
    const salvo = localStorage.getItem("profissionalLogado");
    if (!salvo) return null;
    const dados = JSON.parse(salvo);
    return dados?.id ?? null;
  } catch {
    return null;
  }
}

// true quando a RPC ainda não existe no banco (blindagem não aplicada).
// Nesse caso usamos o caminho antigo (leitura/escrita direta).
function erroRpcAusente(error) {
  if (!error) return false;
  const msg = String(error.message || "").toLowerCase();
  const code = String(error.code || "");
  return (
    code === "42883" || // undefined_function
    code === "PGRST202" ||
    msg.includes("could not find the function") ||
    (msg.includes("function") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  );
}

// ---- Login / logout ----------------------------------------------------
// Devolve { token, profissional } ou null quando nome/senha não batem.
// DUAL-MODE: tenta sessao_abrir (banco blindado); se a RPC não existir
// (banco ainda antigo), cai para profissionais_login (login sem token).
export async function login(nome, senha) {
  try {
    const { data, error } = await supabase.rpc("sessao_abrir", {
      p_nome: nome,
      p_senha: senha,
    });
    if (!error) {
      if (!data) return null;
      setToken(data.token);
      return data; // { token, profissional }
    }
    if (!erroRpcAusente(error)) throw error;
  } catch (e) {
    if (!erroRpcAusente(e)) throw e;
  }
  // Fallback: banco antigo sem blindagem.
  const { data: antigo, error: erroAntigo } = await supabase.rpc("profissionais_login", {
    p_nome: nome,
    p_senha: senha,
  });
  if (erroAntigo) throw erroAntigo;
  const profissional = Array.isArray(antigo) ? antigo[0] : antigo;
  if (!profissional) return null;
  setToken(null);
  return { token: null, profissional };
}

export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await supabase.rpc("sessao_fechar", { p_token: token });
    } catch {
      /* ignora */
    }
  }
  setToken(null);
}

// ---- Leitura -----------------------------------------------------------
// Lista os agendamentos do profissional logado (mais recentes primeiro).
// DUAL-MODE: com token usa ag_listar; SEM token (banco antigo) lê direto
// com profissional_id. Precisa do id no 2º modo.
export async function listar(profissionalId = null) {
  const token = getToken();
  if (token) {
    try {
      const { data, error } = await supabase.rpc("ag_listar", { p_token: token });
      if (!error) return data || [];
      if (!erroRpcAusente(error)) throw error;
    } catch (e) {
      if (!erroRpcAusente(e)) throw e;
    }
  }
  // Fallback banco antigo / sem sessão: leitura direta.
  const pid = profissionalId ?? getProfissionalLogadoId();
  if (!pid) return [];
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("profissional_id", pid)
    .order("id", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Disponibilidade para o CLIENTE anônimo (sem dados de outros clientes).
// Devolve [{ horario, servico, horario_liberado }, ...].
// DUAL-MODE: sem a RPC (banco antigo), deriva da leitura direta filtrada.
export async function disponibilidadeCliente(profissionalId, dataISO) {
  try {
    const { data, error } = await supabase.rpc("ag_disponibilidade_cliente", {
      p_profissional_id: profissionalId,
      p_data: dataISO,
    });
    if (!error) return data || [];
    if (!erroRpcAusente(error)) throw error;
  } catch (e) {
    if (!erroRpcAusente(e)) throw e;
  }
  const { data: direto, error: erroDireto } = await supabase
    .from("agendamentos")
    .select("horario,servico,horario_liberado")
    .eq("profissional_id", profissionalId)
    .eq("data", dataISO)
    .eq("status", "Agendado");
  if (erroDireto) throw erroDireto;
  return direto || [];
}

// Lista os agendamentos do profissional para o CLIENTE anônimo calcular
// horários ocupados — SEM expor nome/whatsapp/valor de outros clientes.
// Devolve [{ id, data, horario, servico, status, horario_liberado }, ...].
// DUAL-MODE: sem a RPC (banco antigo), lê direto as colunas públicas.
export async function listarPublico(profissionalId) {
  try {
    const { data, error } = await supabase.rpc("ag_listar_publico", {
      p_profissional_id: profissionalId,
    });
    if (!error) return data || [];
    if (!erroRpcAusente(error)) throw error;
  } catch (e) {
    if (!erroRpcAusente(e)) throw e;
  }
  const { data: direto, error: erroDireto } = await supabase
    .from("agendamentos")
    .select("id,data,horario,servico,status,horario_liberado")
    .eq("profissional_id", profissionalId)
    .order("id", { ascending: false });
  if (erroDireto) throw erroDireto;
  return direto || [];
}

// Contagem total (painel do admin).
// DUAL-MODE: sem a RPC, conta via leitura direta.
export async function contarAdmin() {
  try {
    const { data, error } = await supabase.rpc("ag_contar_admin");
    if (!error) return data || 0;
    if (!erroRpcAusente(error)) throw error;
  } catch (e) {
    if (!erroRpcAusente(e)) throw e;
  }
  const { count, error: erroDireto } = await supabase
    .from("agendamentos")
    .select("id", { count: "exact", head: true });
  if (erroDireto) throw erroDireto;
  return count || 0;
}

// ---- Criação -----------------------------------------------------------
// Cliente cria 1 agendamento. Devolve o registro criado.
// status: "Agendado" | "Pendente".
// DUAL-MODE: sem a RPC (banco antigo), insere direto.
export async function criarCliente({
  profissionalId,
  nome,
  whatsapp,
  servico,
  valor,
  data,
  horario,
  status,
}) {
  try {
    const { data: criado, error } = await supabase.rpc("ag_criar_cliente", {
      p_profissional_id: profissionalId,
      p_nome: nome,
      p_whatsapp: whatsapp,
      p_servico: servico,
      p_valor: valor,
      p_data: data,
      p_horario: horario,
      p_status: status,
    });
    if (!error) return Array.isArray(criado) ? criado[0] : criado;
    if (!erroRpcAusente(error)) throw error;
  } catch (e) {
    if (!erroRpcAusente(e)) throw e;
  }
  const { data: direto, error: erroDireto } = await supabase
    .from("agendamentos")
    .insert([
      {
        profissional_id: profissionalId,
        nome,
        whatsapp,
        servico,
        valor_servico: valor ?? 0,
        data,
        horario,
        status: status || "Agendado",
        horario_liberado: false,
      },
    ])
    .select("*");
  if (erroDireto) throw erroDireto;
  // returns setof -> array; pega o primeiro.
  return Array.isArray(direto) ? direto[0] : direto;
}

// Profissional cria VÁRIOS (recorrência). linhas = [{ nome, whatsapp,
// servico, valor_servico, data, horario }, ...]. Devolve os criados.
// DUAL-MODE: sem token/RPC (banco antigo), insere direto com profissional_id.
export async function criarProfissional(linhas, profissionalId = null) {
  const token = getToken();
  if (token) {
    try {
      const { data, error } = await supabase.rpc("ag_criar_profissional", {
        p_token: token,
        p_linhas: linhas,
      });
      if (!error) return data || [];
      if (!erroRpcAusente(error)) throw error;
    } catch (e) {
      if (!erroRpcAusente(e)) throw e;
    }
  }
  const pid = profissionalId ?? getProfissionalLogadoId();
  if (!pid) return [];
  const payload = (linhas || []).map((l) => ({
    profissional_id: pid,
    nome: l.nome,
    whatsapp: l.whatsapp,
    servico: l.servico,
    valor_servico: l.valor_servico ?? 0,
    data: l.data,
    horario: l.horario,
    status: l.status || "Agendado",
    horario_liberado: false,
  }));
  const { data, error } = await supabase.from("agendamentos").insert(payload).select("*");
  if (error) throw error;
  return data || [];
}

// ---- Atualização -------------------------------------------------------
// Atualiza 1 agendamento do profissional. campos é um objeto só com as
// colunas permitidas (status, horario_liberado, datacancelamento,
// dataconcluido, valor_servico, data, horario). Devolve o registro.
// DUAL-MODE: sem token/RPC (banco antigo), atualiza direto.
export async function atualizar(id, campos) {
  const token = getToken();
  if (token) {
    try {
      const { data, error } = await supabase.rpc("ag_atualizar", {
        p_token: token,
        p_id: id,
        p_campos: campos,
      });
      if (!error) return Array.isArray(data) ? data[0] : data;
      if (!erroRpcAusente(error)) throw error;
    } catch (e) {
      if (!erroRpcAusente(e)) throw e;
    }
  }
  const { data, error } = await supabase
    .from("agendamentos")
    .update(campos)
    .eq("id", id)
    .select("*");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// Atualiza VÁRIOS (ex.: cancelar uma recorrência inteira). Devolve quantos.
// DUAL-MODE: sem token/RPC (banco antigo), atualiza direto.
export async function atualizarVarios(ids, campos) {
  const token = getToken();
  if (token) {
    try {
      const { data, error } = await supabase.rpc("ag_atualizar_varios", {
        p_token: token,
        p_ids: ids,
        p_campos: campos,
      });
      if (!error) return data || 0;
      if (!erroRpcAusente(error)) throw error;
    } catch (e) {
      if (!erroRpcAusente(e)) throw e;
    }
  }
  const { data, error } = await supabase
    .from("agendamentos")
    .update(campos)
    .in("id", ids || [])
    .select("id");
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

// ---- Exclusão ----------------------------------------------------------
// Exclui agendamentos por id (do profissional). Devolve quantos.
// DUAL-MODE: sem token/RPC (banco antigo), exclui direto.
export async function excluir(ids) {
  const token = getToken();
  if (token) {
    try {
      const { data, error } = await supabase.rpc("ag_excluir", {
        p_token: token,
        p_ids: ids,
      });
      if (!error) return data || 0;
      if (!erroRpcAusente(error)) throw error;
    } catch (e) {
      if (!erroRpcAusente(e)) throw e;
    }
  }
  const { error } = await supabase.from("agendamentos").delete().in("id", ids || []);
  if (error) throw error;
  return (ids || []).length;
}

// ---- Helper de erro ----------------------------------------------------
// true quando o erro é de horário já reservado (unique violation 23505).
export function erroHorarioOcupado(error) {
  return Boolean(error) && (error.code === "23505" || error.code === "23P01");
}

// true quando a sessão expirou/é inválida (precisa logar de novo).
export function erroSessaoInvalida(error) {
  if (!error) return false;
  return error.code === "28000" || /sessao_invalida/i.test(error.message || "");
}

// ---- Perfil do profissional (senha) ------------------------------------
// Ver a senha de um profissional. Só o super_admin autenticado consegue.
// Devolve a senha em texto puro (ou null se não encontrar).
export async function adminVerSenha(profissionalId) {
  const { data, error } = await supabase.rpc("admin_ver_senha", {
    p_token: getToken(),
    p_id: profissionalId,
  });
  if (error) throw error;
  return data;
}
