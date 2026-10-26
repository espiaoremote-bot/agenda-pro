import Calendar from "react-calendar";
import { FaWhatsapp } from "react-icons/fa";
import "react-calendar/dist/Calendar.css";
import { useState, useEffect, useRef, Component } from "react";
import { supabase } from "./supabaseClient";
import * as ag from "./lib/agendamentosApi";
import * as cat from "./lib/catalogoApi";
import { App as CapacitorApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { ehFree } from "./lib/planos";
import { informacaoPlano } from "./lib/planos";
import AdBanner from "./components/AdBanner";
import AdInterstitial from "./components/AdInterstitial";
import AdMobBanner from "./components/AdMobBanner";
import AdMobInterstitial from "./components/AdMobInterstitial";
import {
  ADSENSE_SLOT_CLIENT,
  ADSENSE_SLOT_CLIENT_MEIO,
  ADSENSE_SLOT_PROFISSIONAL,
} from "./lib/adsense";
import "./App.css";

const URL_PUBLICA = "https://agenda-pro-gilt.vercel.app";
const CHAVE_PUBLICA_VAPID =
  "BHmE7f6Kb0SnrWK8dyQif8_vJaXDNOFaA5d8hmVdVQ4gfH8OOjw1e08tkNBbepTHIzTytuADKCuRmYbCxU3MiUM";

function chaveVapidParaBytes(chave) {
  const base64 = chave.replace(/-/g, "+").replace(/_/g, "/");
  const dados = window.atob(base64);
  return Uint8Array.from(dados, (caractere) => caractere.charCodeAt(0));
}

function statusAtendimentoAberto(status) {
  return status !== "Ocupado" && status !== "Fechado";
}

// Mensagem amigável para erros das RPCs do catálogo (serviços/promoções).
function msgErroCatalogo(error) {
  if (ag.erroSessaoInvalida(error))
    return "Sua sessão expirou. Entre novamente para salvar.";
  return error?.message || String(error);
}

function gerarLinkProfissional(idProfissional, login = false) {
  const baseUrl = Capacitor.isNativePlatform()
    ? URL_PUBLICA
    : window.location.origin;
  const parametros = new URLSearchParams({ profissional: String(idProfissional) });
  if (login) parametros.set("login", "1");
  return `${baseUrl}/?${parametros.toString()}`;
}

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch (error) {
      console.warn("Clipboard API indisponível; tentando cópia compatível.", error);
    }
  }

  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  const copiado = document.execCommand("copy");
  campo.remove();

  if (!copiado) {
    throw new Error("Não foi possível copiar o texto para a área de transferência.");
  }
}

// Temas disponíveis para profissionais e para os clientes verem no agendamento.
const themeOptions = [
  {
    value: "feminino",
    label: "Rosa",
    primary: "#db2777",
    secondary: "#ec4899",
    background: "#fff5fa",
    border: "#fbcfe8",
  },
  {
    value: "masculino",
    label: "Azul",
    primary: "#2563eb",
    secondary: "#1d4ed8",
    background: "#eff6ff",
    border: "#93c5fd",
  },
  {
    value: "verde",
    label: "Verde",
    primary: "#16a34a",
    secondary: "#22c55e",
    background: "#ecfdf5",
    border: "#86efac",
  },
  {
    value: "laranja",
    label: "Laranja",
    primary: "#f97316",
    secondary: "#fb923c",
    background: "#fff7ed",
    border: "#fed7aa",
  },
  {
    value: "roxo",
    label: "Roxo",
    primary: "#8b5cf6",
    secondary: "#a78bfa",
    background: "#f3e8ff",
    border: "#d8b4fe",
  },
  {
    value: "cinza",
    label: "Cinza",
    primary: "#374151",
    secondary: "#6b7280",
    background: "#f3f4f6",
    border: "#9ca3af",
  },
  {
    value: "preto",
    label: "Preto",
    primary: "#000000",
    secondary: "#333333",
    background: "#f5f5f5",
    border: "#555555",
  },
];

function getThemeConfig(value) {
  return themeOptions.find((item) => item.value === value) || themeOptions[0];
}

const iconOptions = [
  { value: "🎂", label: "Bolo" },
  { value: "🍰", label: "Bolo de fatia" },
  { value: "🧁", label: "Cupcake" },
  { value: "💇🏻", label: "Cabelo" },
  { value: "💈", label: "Barbearia" },
  { value: "💅🏻", label: "Beleza" },
  { value: "🐶", label: "Pets" },
  { value: "💄", label: "Maquiagem" },
  { value: "🐾", label: "Pet" },
  { value: "🩺", label: "Saúde" },
  { value: "🖋️​", label: "Tatuagem" },
];

// Converte os ícones antigos (sem tom de pele) para as novas versões, para
// que perfis que já salvaram o ícone antes também passem a exibir o novo.
function normalizarIcone(icone) {
  if (icone === "💇") return "💇🏻";
  if (icone === "💅") return "💅🏻";
  return icone || "";
}
 
// Cria uma lista de datas mensais a partir da data inicial, repetindo o mesmo
// dia e horário a cada mês. Ex.: dataInicial de janeiro com 3 meses => jan, fev, mar.
// Dias inválidos (ex.: 31/01 + 1 mês) são ajustados para o último dia do mês.
function datasParaMeses(dataInicial, quantidadeMeses) {
  const quantidadeValida =
    Number.isFinite(Number(quantidadeMeses)) && Number(quantidadeMeses) >= 1
      ? Number(quantidadeMeses)
      : 1;

  const partes = dataInicial.split("-").map(Number);
  const anoInicial = partes[0];
  const mesInicial = partes[1]; // 1 a 12
  const diaInicial = partes[2];

  const datas = [];

  for (let i = 0; i < quantidadeValida; i++) {
    const primeiroDoMesAlvo = new Date(anoInicial, mesInicial - 1 + i, 1);
    const ultimoDiaDoMes = new Date(
      primeiroDoMesAlvo.getFullYear(),
      primeiroDoMesAlvo.getMonth() + 1,
      0
    ).getDate();
    const diaAlvo = Math.min(diaInicial, ultimoDiaDoMes);

    const dataFormatada =
      primeiroDoMesAlvo.getFullYear() +
      "-" +
      String(primeiroDoMesAlvo.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(diaAlvo).padStart(2, "0");

    datas.push(dataFormatada);
  }

  return datas;
}

// Cria uma lista de datas semanais a partir da data inicial, repetindo o mesmo
// dia da semana e horário a cada 7 dias. Ex.: dataInicial + 3 semanas => +7, +14, +21.
function datasParaSemanas(dataInicial, quantidadeSemanas) {
  const quantidadeValida =
    Number.isFinite(Number(quantidadeSemanas)) && Number(quantidadeSemanas) >= 1
      ? Number(quantidadeSemanas)
      : 1;

  const partes = dataInicial.split("-").map(Number);
  const anoInicial = partes[0];
  const mesInicial = partes[1] - 1; // 0 a 11 (mês do JavaScript)
  const diaInicial = partes[2];

  const datas = [];

  for (let i = 0; i < quantidadeValida; i++) {
    const dataAlvo = new Date(anoInicial, mesInicial, diaInicial + i * 7);
    const dataFormatada =
      dataAlvo.getFullYear() +
      "-" +
      String(dataAlvo.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dataAlvo.getDate()).padStart(2, "0");

    datas.push(dataFormatada);
  }

  return datas;
}

// Meses em que o agendamento feito pelo CLIENTE precisa da aprovação do
// profissional antes de virar um agendamento confirmado. Ex.: dezembro (12).
const MESES_QUE_EXIGEM_APROVACAO = [12];

// True quando uma data cai em um mês que exige aprovação do profissional.
// `exigirAprovacao` vem do perfil do profissional (coluna
// `exigir_aprovacao_dezembro`). Se não vier (coluna antiga no banco),
// o padrão é exigir a aprovação.
function precisaAprovacaoProfissional(dataISO, exigirAprovacao) {
  if (exigirAprovacao === false) return false;
  const partes = String(dataISO || "").split("-").map(Number);
  return MESES_QUE_EXIGEM_APROVACAO.includes(partes[1]);
}

// Cria uma linha vazia de serviço + dia + horário (tela do CLIENTE).
// `em_promocao` marca as linhas escolhidas dentro do seletor de promoções.
function novoItemCliente() {
  return {
    servico: "",
    data: "",
    horario: "",
    valor: 0,
    em_promocao: false,
    promo_id: null,
  };
}

// ---------- Regra de PROMOÇÕES ----------
// Nomes dos meses (índice 0 = janeiro), usados no painel do profissional.
const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// Diz se uma promoção está ativa para a data (mês + semana + dias da semana).
// Sem data, usa hoje. `dias_semana` vazio/ausente = vale todos os dias.
function promocaoAtivaEm(
  promo,
  dataReferencia,
  { ignorarDiaSemana = false } = {}
) {
  if (!promo || promo.ativo === false) return false;
  const data =
    typeof dataReferencia === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)
      ? new Date(
          Number(dataReferencia.slice(0, 4)),
          Number(dataReferencia.slice(5, 7)) - 1,
          Number(dataReferencia.slice(8, 10))
        )
      : dataReferencia
      ? new Date(dataReferencia)
      : new Date();
  const mes = data.getMonth() + 1;
  if (!Array.isArray(promo.meses) || !promo.meses.map(Number).includes(mes)) {
    return false;
  }
  const finalSemana = promo.semanas || {};
  const confSemanas = finalSemana[String(mes)];
  if (Array.isArray(confSemanas)) {
    const indiceSemana = Math.floor((data.getDate() - 1) / 7); // 0..4 (1ª..5ª semana)
    if (confSemanas[indiceSemana] === false) return false;
  }
  // Dia da semana permitido? (dias_semana vazio/ausente = todos os dias)
  if (
    !ignorarDiaSemana &&
    Array.isArray(promo.dias_semana) &&
    promo.dias_semana.length > 0
  ) {
    if (!promo.dias_semana.map(Number).includes(data.getDay())) return false;
  }
  return true;
}

// Nomes dos meses de uma promoção (para exibir no card da promoção).
function mesesDaPromocao(promo) {
  return (promo?.meses || [])
    .map(Number)
    .map((m) => NOMES_MESES[m - 1])
    .filter(Boolean);
}

// Nomes dos dias da semana escolhidos numa promoção (para exibir no card).
// Vazio = todos os dias.
function diasDaPromocao(promo) {
  const dias = Array.isArray(promo?.dias_semana)
    ? promo.dias_semana.map(Number)
    : [];
  if (dias.length === 0) return [];
  return [...new Set(dias)]
    .sort((a, b) => a - b)
    .map((d) => diasSemanaPorIndice[d])
    .filter(Boolean)
    .map((nome) => nome.charAt(0).toUpperCase() + nome.slice(1));
}

// Duração de uma linha de agendamento — respeita a duração da PROMOÇÃO
// quando a linha é um serviço em promoção (senão usa a duração do serviço).
function duracaoHorasDeItem(item, catalogoServicos, profissionalId, promosAtivas) {
  if (!item) return 0;
  if (item.em_promocao && item.promo_id && Array.isArray(promosAtivas)) {
    const promo = promosAtivas.find((p) => Number(p.id) === Number(item.promo_id));
    if (promo && promo.duracao) {
      const horasPromo = parsearDuracaoHoras(promo.duracao);
      if (horasPromo > 0) return horasPromo;
    }
  }
  return duracaoHorasDeServicio(item.servico, catalogoServicos, profissionalId);
}

// Linha vazia usada no formulário do PROFISSIONAL ("Agendar por um cliente"),
// que também pode repetir por vários meses ou semanas (frequência mensal ou semanal).
function novoItemAgendarCliente() {
  return {
    servico: "",
    data: "",
    horario: "",
    valor: 0,
    em_promocao: false,
    promo_id: null,
    meses: 1,
    frequencia: "mensal",
  };
}

// ---------- Regra de DURAÇÃO dos serviços ----------
// Converte o texto de duração de um serviço ("2 horas", "1h30", "90 min",
// "1 hora e 30 min"...) em horas (número decimal). Devolve 0 quando não reconhece.
function parsearDuracaoHoras(textoDuracao) {
  if (!textoDuracao) return 0;
  const texto = String(textoDuracao).toLowerCase().trim().replace(",", ".");
  let horas = 0;

  // Forma compacta: "2h30", "1h30m", "2 h 30 min"
  const compacto = texto.match(
    /(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:y\s*)?(\d+(?:\.\d+)?)\s*(?:m(?:in(?:utos?)?)?)?/
  );
  if (compacto) {
    horas = Number(compacto[1]) + Number(compacto[2]) / 60;
    return Math.round(horas * 100) / 100;
  }

  // "2 horas", "1h", "1 hora", "1.5h"
  const parteHoras = texto.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|oras?)?/);
  if (parteHoras) {
    horas += Number(parteHoras[1]);
  }

  // "30 min", "45 minutos", "90min"
  const parteMinutos = texto.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utos?)?)?/);
  if (parteMinutos) {
    horas += Number(parteMinutos[1]) / 60;
  }

  return Math.round(horas * 100) / 100;
}

// "13:00" -> minutos desde meia-noite (780). Devolve -1 se inválido.
function horarioAMinutos(horario) {
  if (!horario) return -1;
  const partes = String(horario).split(":").map(Number);
  if (Number.isNaN(partes[0])) return -1;
  return partes[0] * 60 + (Number.isNaN(partes[1]) ? 0 : partes[1]);
}

// Suma horas a um horário "13:00" e devolve "HH:MM" (ex.: 13:00 + 2 -> 15:00).
function sumarHoras(horario, horas) {
  if (!horario) return "";
  const inicio = horarioAMinutos(horario);
  if (inicio < 0) return horario;
  const total = inicio + Math.max(0, Math.round((Number(horas) || 0) * 60));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Procura a duração (em horas) de um serviço no catálogo. `profissionalId`
// é opcional e evita confundir serviços que tenham o mesmo nome.
function duracaoHorasDeServicio(nomeServico, catalogoServicos, profissionalId) {
  if (!nomeServico) return 0;
  const catalogo = Array.isArray(catalogoServicos) ? catalogoServicos : [];
  const encontrado = catalogo.find(
    (s) =>
      s.nome === nomeServico &&
      (!profissionalId ||
        !s.profissional_id ||
        s.profissional_id === profissionalId)
  );
  return parsearDuracaoHoras(encontrado ? encontrado.duracao : "");
}

// Dado um início e uma duração (em horas), devolve os horários (slots) que o
// agendamento ocupa: todos entre [início, início + duração). Sem duração: só o slot.
function slotsQueOcupa(horarioInicio, horas, slotsDelDia) {
  const inicio = horarioAMinutos(horarioInicio);
  if (inicio < 0) return [];
  const duracionMin = Math.round((Number(horas) || 0) * 60);
  if (duracionMin <= 0) return [horarioInicio];
  const fin = inicio + duracionMin;
  return slotsDelDia.filter((slot) => {
    const min = horarioAMinutos(slot);
    return min >= inicio && min < fin;
  });
}

// Duas franjas [inicio, fin) se cruzan quando uma entra no intervalo da outra.
function franjasSolapan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && inicioB < finA;
}

// Nomes dos dias da semana na ordem do Date.getDay() (0 = domingo, 1 = segunda...).
const diasSemanaPorIndice = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

function formatarDiasAtendimentoPerfil(dias, ordemDias) {
  const nomesPorDia = {
    segunda: { plural: "segundas-feiras", singular: "segunda" },
    terça: { plural: "terças-feiras", singular: "terça" },
    quarta: { plural: "quartas-feiras", singular: "quarta" },
    quinta: { plural: "quintas-feiras", singular: "quinta" },
    sexta: { plural: "sextas-feiras", singular: "sexta" },
    sábado: { plural: "sábados", singular: "sábado" },
    domingo: { plural: "domingos", singular: "domingo" },
  };
  const selecionados = ordemDias.filter((dia) => dias.includes(dia));
  if (selecionados.length === ordemDias.length) return "todos os dias";

  const grupos = [];
  for (const dia of selecionados) {
    const grupoAtual = grupos[grupos.length - 1];
    const indiceDia = ordemDias.indexOf(dia);
    const indiceAnterior = ordemDias.indexOf(grupoAtual?.[grupoAtual.length - 1]);

    if (grupoAtual && indiceDia === indiceAnterior + 1) {
      grupoAtual.push(dia);
    } else {
      grupos.push([dia]);
    }
  }

  const partes = grupos.map((grupo) => {
    if (grupo.length > 1) {
      return `de ${nomesPorDia[grupo[0]].singular} a ${
        nomesPorDia[grupo[grupo.length - 1]].singular
      }`;
    }

    const dia = grupo[0];
    const preposicao = dia === "sábado" || dia === "domingo" ? "aos" : "às";
    return `${preposicao} ${nomesPorDia[dia].plural}`;
  });

  if (partes.length < 2) return partes[0] || "";
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

// Devolve o nome (minúsculo) do dia da semana de uma data no formato "AAAA-MM-DD".
function diaSemanaDaData(dataISO) {
  return dataISO
    ? diasSemanaPorIndice[new Date(dataISO + "T00:00:00").getDay()]
    : "";
}

// Busca os dias marcados como FOLGA de um profissional. A folga fica guardada
// na tabela "horarios_trabalho" como uma linha especial com horario = "FOLGA"
// (não é um horário real de atendimento, é só a marcação de folga do dia).
async function buscarDiasFolga(idProfissional) {
  const { data, error } = await supabase
    .from("horarios_trabalho")
    .select("dia_semana")
    .eq("profissional_id", idProfissional)
    .eq("horario", "FOLGA");

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((linha) => linha.dia_semana);
}

// Busca as datas específicas marcadas como folga de um profissional.
// Ficam na tabela "folgas" (uma linha por data, ex.: "2026-12-21").
async function buscarFolgasDatas(idProfissional) {
  const { data, error } = await supabase
    .from("folgas")
    .select("data")
    .eq("profissional_id", idProfissional);

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((linha) => linha.data);
}

// Junta os agendamentos que fazem parte da MESMA recorrência mensal de um pedido
// (mesmo profissional, cliente, serviço e horário, em meses consecutivos).
function mesesDaRecorrencia(pedidoReferencia, lista, idProfissional) {
  const diffMesesEntre = (dataA, dataB) => {
    const [anoA, mesA] = dataA.split("-").map(Number);
    const [anoB, mesB] = dataB.split("-").map(Number);
    return (anoA - anoB) * 12 + (mesA - mesB);
  };

  const semelhantes = Array.isArray(lista)
    ? lista.filter(
        (item) =>
          item.profissional_id === idProfissional &&
          item.status === "Agendado" &&
          item.nome === pedidoReferencia.nome &&
          item.profissional_id === pedidoReferencia.profissional_id &&
          item.whatsapp === pedidoReferencia.whatsapp &&
          item.servico === pedidoReferencia.servico &&
          item.horario === pedidoReferencia.horario
      )
    : [];

  if (semelhantes.length === 0) {
    return [pedidoReferencia];
  }

  const ordenados = semelhantes.slice().sort((a, b) => (a.data < b.data ? -1 : 1));

  // Union-find simples para agrupar meses consecutivos da mesma recorrência.
  const pai = ordenados.map((_, indice) => indice);
  const achar = (x) => {
    if (pai[x] !== x) {
      pai[x] = achar(pai[x]);
    }
    return pai[x];
  };
  const unir = (a, b) => {
    pai[achar(a)] = achar(b);
  };

  for (let indice = 1; indice < ordenados.length; indice++) {
    if (diffMesesEntre(ordenados[indice].data, ordenados[indice - 1].data) === 1) {
      unir(indice, indice - 1);
    }
  }

  const indiceClicado = ordenados.findIndex((item) => item.id === pedidoReferencia.id);
  const raizGrupo = indiceClicado >= 0 ? achar(indiceClicado) : -1;

  if (indiceClicado < 0) {
    return [pedidoReferencia];
  }

  return ordenados.filter((item, indice) => achar(indice) === raizGrupo);
}

console.log("ESTOU NO ARQUIVO CERTO 999");
console.log("Supabase:", supabase);
console.log("ESTOU NO APP JSX CERTO");

// A senha de administrador (opcoes de gerenciamento) NAO fica mais no codigo.
// Ela vive como secret do Supabase (ADMIN_SENHA_OPCOES) e e validada pela
// Edge Function "verify-admin-opcoes" via desbloquearAdminSeguro().
const SENHA_ADMIN_OPCOES_REMOVIDA = true;

// ==========================================
// PACOTE MENSAL — dias de uso do profissional
// Cada profissional novo começa com 30 dias. O admin pode adicionar dias,
// tornar o plano permanente (ilimitado) ou a conta desativa sozinha quando
// o prazo chega a zero.
// ==========================================
const DIAS_PADRAO_PLANO = 30; // pacote mensal padrão
const MS_DIA = 24 * 60 * 60 * 1000; // 1 dia em milissegundos

// True quando o plano é permanente (nunca expira).
function ehPlanoIlimitado(profissional) {
  return Boolean(profissional?.plano_ilimitado);
}

// Data de validade do plano em ms, ou null quando não há validade cadastrada.
function validadePlanoMs(profissional) {
  if (!profissional?.validade_plano) return null;
  const ms = new Date(profissional.validade_plano).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Dias inteiros que ainda faltam para vencer (arredondado para cima).
// Retorna null quando é permanente ou ainda não há plano cadastrado.
function diasRestantesPlano(profissional) {
  if (ehPlanoIlimitado(profissional)) return null;
  const validade = validadePlanoMs(profissional);
  if (validade == null) return null;
  return Math.max(0, Math.ceil((validade - Date.now()) / MS_DIA));
}

// True quando o plano já venceu (a conta deve ser desativada automaticamente).
function planoExpirado(profissional) {
  // O administrador nunca expira e nunca é afetado pela desativação automática.
  if (profissional?.tipo === "super_admin") return false;
  if (ehPlanoIlimitado(profissional)) return false;
  const validade = validadePlanoMs(profissional);
  if (validade == null) return false; // sem plano cadastrado => não expira sozinho
  return validade <= Date.now();
}

// Texto e estilo do plano para exibir no perfil do admin.
// A implementação fica em `src/lib/planos.js` (fonte única de verdade):
// import { informacaoPlano } from "./lib/planos";

// Formata a data da validade no padrão brasileiro (dd/mm/aaaa).
function formatarDataPlano(profissional) {
  const validade = validadePlanoMs(profissional);
  if (validade == null) return "";
  const data = new Date(validade);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}



// ============================================================
// PROTECTOR CONTRA "PANTALLA BLANCA"
// Se um erro acontece durante o render (por exemplo em algum
// navegador de celular, com dados com formatos raros), em lugar
// de deixar a página totalmente branca, mostra uma tarjeta com
// o erro e um botón de recargar. Também guarda o erro em
// localStorage ("ultimo_errro_app") para poder diagnosticar.
// ============================================================
class ProtectorDeErrores extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(error) {
    const texto = String(
      (error && error.message) || error || "Erro desconhecido"
    );
    try {
      localStorage.setItem("ultimo_errro_app", texto);
    } catch {
      // localStorage pode não estar disponível; ignoramos
    }
    return { erro: texto };
  }

  render() {
    if (this.state.erro) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#ffffff",
            padding: "28px",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <h2>😵 Oops — ocorreu um erro inesperado</h2>
          <p style={{ color: "#c0392b" }}>{this.state.erro}</p>
          <div style={{ marginTop: "16px" }}>
            <button
              style={{
                padding: "10px 18px",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                background: "#2563eb",
                color: "#fff",
                fontSize: "14px",
              }}
              onClick={() => window.location.reload()}
            >
              🔄 Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Colunas liberadas para leitura pública em `profissionais` (pós-blindagem).
// NUNCA usar select("*") em profissionais: o Supabase nega o "*" quando há privilégio
// por coluna (senha/senha_hash escondidas).
const COLUNAS_PERFIL =
  "id,nome,tipo,ativo,tema,icone,status_atendimento,horarios_disponiveis," +
  "validade_plano,plano_ilimitado,exigir_aprovacao_dezembro," +
  "chave_pix,banco_pix,nome_pix," +
  "endereco_rua,endereco_numero,endereco_cep,mostrar_endereco," +
  "horario_funcionamento_inicio,horario_funcionamento_fim," +
  "mostrar_horario_funcionamento,dias_atendimento_perfil," +
  "seletor_promocoes_habilitado";

function lerSessaoSalvaInicial() {
  try {
    const parametros = new URLSearchParams(window.location.search);
    // Link público do cliente: nunca restaura sessão nesse caso.
    if (Number(parametros.get("profissional"))) return null;
    const salvo = JSON.parse(localStorage.getItem("profissionalLogado") || "null");
    return salvo?.id ? salvo : null;
  } catch {
    return null;
  }
}

function App() {
  const [tela, setTela] = useState(() => {
    const parametros = new URLSearchParams(window.location.search);
    // Link público do cliente: entra direto na agenda, sem login.
    if (Number(parametros.get("profissional"))) return "cliente";
    const sessao = lerSessaoSalvaInicial();
    if (!sessao) return "login";
    return sessao.tipo === "super_admin" ? "admin" : "profissional";
  });

const [credenciaisLembradas, setCredenciaisLembradas] = useState(() => {
  try {
    const armazenadas = JSON.parse(
      localStorage.getItem("credenciais_profissional") || "null"
    );
    const lista = Array.isArray(armazenadas)
      ? armazenadas
      : [armazenadas];
    return lista.filter(
      (credencial) =>
        typeof credencial?.nome === "string" &&
        typeof credencial?.senha === "string"
    );
  } catch (error) {
    console.error("Falha ao ler o login salvo:", error);
    return [];
  }
});
const [senha, setSenha] = useState(() => credenciaisLembradas[0]?.senha || "");
const [loginNome, setLoginNome] = useState(
  () => credenciaisLembradas[0]?.nome || ""
);
const [lembrarLogin, setLembrarLogin] = useState(
  () => credenciaisLembradas.length > 0
);
  console.log("APP ESTÁ RODANDO");
console.log("EU EDITEI ESTE ARQUIVO AGORA 123456");

const [profissionalLogado, setProfissionalLogado] = useState(() => lerSessaoSalvaInicial());
const [profissionalCliente, setProfissionalCliente] = useState(null);
const [dadosProfissionalCliente, setDadosProfissionalCliente] = useState(null);
const [carregandoPerfil, setCarregandoPerfil] = useState(() => {
  const parametros = new URLSearchParams(window.location.search);
  return Boolean(Number(parametros.get("profissional"))) && parametros.get("login") !== "1";
});
const [temaNovo, setTemaNovo] = useState("feminino");
const [servicos, setServicos] = useState([]);
const [novoServico, setNovoServico] = useState("");
const [novoValor, setNovoValor] = useState("");
const [novaDuracao, setNovaDuracao] = useState("");
const [servicoEditandoId, setServicoEditandoId] = useState(null);
const [editaNome, setEditaNome] = useState("");
const [editaValor, setEditaValor] = useState("");
const [editaDuracao, setEditaDuracao] = useState("");
const [meusServicos, setMeusServicos] = useState([]);
const [profissionais, setProfissionais] = useState([]);
const [totalAgendamentos, setTotalAgendamentos] = useState(0);
const [mostrarSenha, setMostrarSenha] = useState(false);
const [novoNome, setNovoNome] = useState("");

const [novaSenha, setNovaSenha] = useState("");
const [profissionalEditando, setProfissionalEditando] = useState(null);

const [editarNome, setEditarNome] = useState("");

const [editarSenha, setEditarSenha] = useState("");
const [whatsapp, setWhatsapp] = useState("");

const [mensagem, setMensagem] = useState("");
const [tipoMensagem, setTipoMensagem] = useState("");
const [mensagemProfissional, setMensagemProfissional] = useState("");
const [mensagemLogin, setMensagemLogin] = useState("");
const [mensagemErroProfissional, setMensagemErroProfissional] = useState("");

// Configuração global: permite versão gratuita após o plano expirar.
// Quando false, profissionais com plano vencido são automaticamente desativados.
const [versaoGratuitaHabilitada, setVersaoGratuitaHabilitada] = useState(true);
const [carregandoConfigSistema, setCarregandoConfigSistema] = useState(false);

const [pedido, setPedido] = useState(null);
const [pedidos, setPedidos] = useState([]);
const [pedidoEditandoValor, setPedidoEditandoValor] = useState(null);
const [valorAgendamentoEditando, setValorAgendamentoEditando] = useState("");
const [salvandoValorAgendamento, setSalvandoValorAgendamento] = useState(false);

// IDs dos agendamentos de amanhã cujo lembrete já foi enviado.
// Fica no localStorage para não voltarem à lista ao recarregar a página.
const [lembretesEnviados, setLembretesEnviados] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("lembretes_amanha_enviados") || "[]");
  } catch (e) {
    return [];
  }
});

const [dataSelecionada, setDataSelecionada] = useState(new Date());
const [nome, setNome] = useState("");

// Aba ativa da lista "Serviços cadastrados" ("normais" | "promocao").
const [abaServicos, setAbaServicos] = useState("normais");

const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
// Aba ativa dentro do painel de Configurações.
const [abaConfiguracoes, setAbaConfiguracoes] = useState("perfil");
 
// Pix de pagamento cadastrado pelo profissional (chave + banco).
const [pixChave, setPixChave] = useState("");
const [pixBanco, setPixBanco] = useState("");
const [pixNome, setPixNome] = useState("");
// Feedback de "copiada" na tela do cliente.
const [pixCopiada, setPixCopiada] = useState(false);
// Mensagem de feedback do salvamento do Pix (aparece ao lado do botão).
const [pixMensagem, setPixMensagem] = useState("");
const [pixMensagemTipo, setPixMensagemTipo] = useState("");
// Endereço do local cadastrado pelo profissional (rua + número + CEP).
const [enderecoRua, setEnderecoRua] = useState("");
const [enderecoNumero, setEnderecoNumero] = useState("");
const [enderecoCep, setEnderecoCep] = useState("");
// O profissional decide se o endereço aparece (ou não) na página do cliente.
const [mostrarEndereco, setMostrarEndereco] = useState(false);
const [horarioFuncionamentoInicio, setHorarioFuncionamentoInicio] = useState("");
const [horarioFuncionamentoFim, setHorarioFuncionamentoFim] = useState("");
const [mostrarHorarioFuncionamento, setMostrarHorarioFuncionamento] = useState(false);
const [diasAtendimentoPerfil, setDiasAtendimentoPerfil] = useState([]);
// Mensagem de feedback do salvamento do endereço.
const [enderecoMensagem, setEnderecoMensagem] = useState("");
const [enderecoMensagemTipo, setEnderecoMensagemTipo] = useState("");
// Mensagens inline dos botões "Salvar cor" e "Salvar ícone".
const [corMensagem, setCorMensagem] = useState("");
const [corMensagemTipo, setCorMensagemTipo] = useState("");
const [iconeMensagem, setIconeMensagem] = useState("");
const [iconeMensagemTipo, setIconeMensagemTipo] = useState("");
 
const [temaSelecionado, setTemaSelecionado] = useState(() => lerSessaoSalvaInicial()?.tema || "feminino");
const [iconeSelecionado, setIconeSelecionado] = useState(() => {
  const sessao = lerSessaoSalvaInicial();
  return normalizarIcone(sessao?.icone) || (sessao?.tema === "masculino" ? "💈" : "💅");
});
const [mostrarSaldo, setMostrarSaldo] = useState(true);
 
const [statusAtendimento, setStatusAtendimento] = useState("Aberto");
const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
const [mostrarDiasAgendados, setMostrarDiasAgendados] = useState(false);
const [mostrarAprovacoes, setMostrarAprovacoes] = useState(false);
const [selecionarParaExcluir, setSelecionarParaExcluir] = useState(false);
const [diasSelecionadosExclusao, setDiasSelecionadosExclusao] = useState([]);
const [saldoHabilitado, setSaldoHabilitado] = useState(false);
const [periodoSaldo, setPeriodoSaldo] = useState("semanal");
const [inicioSaldoPersonalizado, setInicioSaldoPersonalizado] = useState(
  () => new Date().toLocaleDateString("sv-SE")
);
const [notificacaoNovoAgendamento, setNotificacaoNovoAgendamento] = useState(null);
const [mostrarAgendarCliente, setMostrarAgendarCliente] = useState(false);
const [mensagemAgendarCliente, setMensagemAgendarCliente] = useState("");
const [tipoMensagemAgendarCliente, setTipoMensagemAgendarCliente] = useState("");
const [mostrarAnuncioPosAgendamento, setMostrarAnuncioPosAgendamento] = useState(false);
  // Anúncio mostrado ao CLIENTE na página pública: banner no rodapé da tela
  // e intersticial logo depois que o pedido é enviado com sucesso.
  const [mostrarAnuncioCliente, setMostrarAnuncioCliente] = useState(false);
// Múltiplos serviços num mesmo agendamento (botão "➕").
const [itensCliente, setItensCliente] = useState(() => [novoItemCliente()]);
const [horariosPorLinhaCliente, setHorariosPorLinhaCliente] = useState({});
const [itensAgendarCliente, setItensAgendarCliente] = useState(() => [
  novoItemAgendarCliente(),
]);
const [horariosPorLinhaAgendarCliente, setHorariosPorLinhaAgendarCliente] =
  useState({});

// Promoções do mês (serviços marcados com 💲 pelo profissional).
const [promocoes, setPromocoes] = useState([]);
const [mensagemPromo, setMensagemPromo] = useState("");
const [mensagemPromoTipo, setMensagemPromoTipo] = useState("");
// Checkbox "Sim/Não" na barrinha de criar serviço: JÁ coloca em promoção.
const [promoAoCriarServico, setPromoAoCriarServico] = useState(false);
// Edição de uma promoção (campos do formulário).
const [promoEditandoId, setPromoEditandoId] = useState(null);
const [promoEditValor, setPromoEditValor] = useState("");
const [promoEditDuracao, setPromoEditDuracao] = useState("");
const [promoEditMeses, setPromoEditMeses] = useState({});
const [promoEditSemanas, setPromoEditSemanas] = useState({});
// Dias da semana permitidos (0 = domingo ... 6 = sábado; vazio = todos).
const [promoEditDias, setPromoEditDias] = useState({});
const [promoEditAtivo, setPromoEditAtivo] = useState(true);

// Reagendamento (remarcar dia/horário) dentro da agenda do profissional.
const [reagendandoPedido, setReagendandoPedido] = useState(null);
const [novaDataReagendamento, setNovaDataReagendamento] = useState("");
const [novoHorarioReagendamento, setNovoHorarioReagendamento] = useState("");
const [horariosReagendamento, setHorariosReagendamento] = useState([]);
const [mensagemReagendamento, setMensagemReagendamento] = useState("");
const [tipoMensagemReagendamento, setTipoMensagemReagendamento] = useState("");
const pedidosVistosRef = useRef(new Set());
const primeiraCargaRef = useRef(true);
const [notificacoesAtivas, setNotificacoesAtivas] = useState(false);
const [mensagemNotificacaoSistema, setMensagemNotificacaoSistema] = useState("");
const notificacoesAtivasRef = useRef(false);
const notificarAgendamentoRef = useRef(null);
const abrirCalendarioNotificacaoRef = useRef(null);
const profissionalPushRef = useRef(null);
profissionalPushRef.current = profissionalLogado;
const [pushConfigurado, setPushConfigurado] = useState(false);
const abrirNotificacaoPendente = (idProfissional) => {
  try {
    const pendente = JSON.parse(
      localStorage.getItem("agenda_pro_notificacao_pendente") || "null"
    );
    if (Number(pendente?.profissional_id) !== Number(idProfissional)) return;

    const data = new Date(`${pendente.data}T00:00:00`);
    if (Number.isNaN(data.getTime())) return;

    setDataSelecionada(data);
    setTela("profissional");
    localStorage.removeItem("agenda_pro_notificacao_pendente");
  } catch (error) {
    console.error("Falha ao abrir o dia do agendamento notificado:", error);
  }
};
const [mostrarListaAdmin, setMostrarListaAdmin] = useState(null);
const [desbloqueadoAdmin, setDesbloqueadoAdmin] = useState(false);
const [senhaOpcoesAdmin, setSenhaOpcoesAdmin] = useState("");
// Dias digitados pelo admin para adicionar ao plano (um valor por profissional).
const [diasParaAdicionarPorProfissional, setDiasParaAdicionarPorProfissional] = useState({});

const temaAtivo = profissionalLogado?.tema || dadosProfissionalCliente?.tema || temaNovo || "feminino";

// O profissional pode ativar ou desativar (no perfil dele) a exigência de
// aprovação para agendamentos de dezembro. Padrão: ativado.
const exigirAprovacaoDezembro =
  profissionalLogado?.exigir_aprovacao_dezembro !== false;
const temaConfig = getThemeConfig(temaAtivo);
const appStyles = {
  "--cor-primaria": temaConfig.primary,
  "--cor-secundaria": temaConfig.secondary,
  "--fundo": temaConfig.background,
  "--cor-borda": temaConfig.border,
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
};

const iconeAtivo =
  normalizarIcone(profissionalLogado?.icone) ||
  normalizarIcone(dadosProfissionalCliente?.icone) ||
  (temaAtivo === "masculino" ? "💈" : "💅🏻");

// Na página pública do cliente, os anúncios aparecem quando o profissional
// do link está no plano GRATUITO (sem plano válido / plano ilimitado).
// Profissional premium (pago) não mostra nenhum anúncio para o cliente.
const clienteVeAnuncios = !!dadosProfissionalCliente && ehFree(dadosProfissionalCliente);

const iconeCliente = ["cinza", "preto", "verde", "masculino"].includes(temaAtivo) ? "🧔" : "👩🏻";

const abrirCalendarioDoAgendamento = (agendamento) => {
  if (!agendamento?.data) return;
  const idProfissional = Number(agendamento.profissional_id);
  if (!idProfissional) return;

  const data = new Date(`${agendamento.data}T00:00:00`);
  if (Number.isNaN(data.getTime())) return;

  if (Number(profissionalLogado?.id) === idProfissional) {
    setDataSelecionada(data);
    setTela("profissional");
    return;
  }

  if (!profissionalLogado) {
    try {
      localStorage.setItem(
        "agenda_pro_notificacao_pendente",
        JSON.stringify(agendamento)
      );
    } catch (error) {
      console.error("Falha ao guardar o agendamento da notificação:", error);
    }
    setTela("login");
    supabase
      .from("profissionais")
      .select("nome")
      .eq("id", idProfissional)
      .maybeSingle()
      .then(({ data: profissional, error }) => {
        if (error) {
          console.error("Falha ao localizar o profissional da notificação:", error);
          return;
        }
        if (profissional?.nome) setLoginNome(profissional.nome);
      });
    return;
  }

  setMensagemNotificacaoSistema(
    "Entre na conta do profissional deste agendamento para abrir o dia."
  );
};
abrirCalendarioNotificacaoRef.current = abrirCalendarioDoAgendamento;

const notificarNovoAgendamento = async (agendamento) => {
  setNotificacaoNovoAgendamento(agendamento);
  if (!notificacoesAtivasRef.current) return;
  const plataformaNotificacao = Capacitor.isNativePlatform() ? "android" : "web";
  if (
    localStorage.getItem(
      `agenda_pro_push_registrado_${plataformaNotificacao}`
    ) === "1"
  ) {
    return;
  }

  const texto = `${agendamento.servico || "Serviço"} · ${formatarDataCompleta(
    agendamento.data
  )} às ${agendamento.horario || ""}`;

  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now() % 2147483647,
            title: "Novo agendamento",
            body: texto,
            schedule: { at: new Date(Date.now() + 500) },
            extra: { agendamento },
          },
        ],
      });
      return;
    }

    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("Novo agendamento", {
        body: texto,
        icon: "/favicon.svg",
        tag: `agenda-pro-${agendamento.id}`,
      });
      notification.onclick = () => {
        window.focus();
        abrirCalendarioNotificacaoRef.current?.(agendamento);
        notification.close();
      };
    }
  } catch (error) {
    console.error("Falha ao exibir a notificação do novo agendamento:", error);
    setMensagemNotificacaoSistema(
      "Não foi possível exibir a notificação. Verifique as permissões do dispositivo."
    );
  }
};
notificarAgendamentoRef.current = notificarNovoAgendamento;
notificacoesAtivasRef.current = notificacoesAtivas;

const ativarNotificacoes = async () => {
  try {
    let permitido = false;
    if (Capacitor.isNativePlatform()) {
      const permissaoAtual = await PushNotifications.checkPermissions();
      const permissao =
        permissaoAtual.receive === "granted"
          ? permissaoAtual
          : await PushNotifications.requestPermissions();
      permitido = permissao.receive === "granted";
      if (permitido) {
        // Canal de alta prioridade para os agendamentos. Sem criar o canal,
        // no Android 8+ o push pode cair em canal de importancia baixa e nao
        // aparecer (ou nao tocar) com o app fechado / tela desligada.
        // NOTA: id "agendamentos_v3" (novo). Canais do Android travam som/vibracao
        // apos criados; usar um id novo garante um canal com SOM desde o inicio.
        await PushNotifications.createChannel({
          id: "agendamentos_v3",
          name: "Agendamentos",
          description: "Avisos de novos agendamentos e confirmacoes",
          importance: 5, // ImportanceMax
          visibility: 1, // PUBLIC: mostra na tela de bloqueio
          vibration: true,
        }).catch((error) => {
          console.error("Falha ao criar o canal de notificacoes:", error);
        });
        await PushNotifications.register();
      }
    } else if ("Notification" in window) {
      permitido = (await Notification.requestPermission()) === "granted";
      if (permitido) {
        const registration = await navigator.serviceWorker.register("/push-sw.js");
        const subscription =
          (await registration.pushManager.getSubscription()) ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: chaveVapidParaBytes(CHAVE_PUBLICA_VAPID),
          }));
        await salvarAssinaturaPush("web", subscription.toJSON());
      }
    } else {
      setMensagemNotificacaoSistema(
        "Este navegador não oferece suporte a notificações do sistema."
      );
      return;
    }

    setNotificacoesAtivas(permitido);
    if (permitido && profissionalLogado?.id) {
      localStorage.setItem(
        `agenda_pro_notificacoes_${profissionalLogado.id}_${Capacitor.isNativePlatform() ? "app" : "web"}`,
        "1"
      );
    }
    if (!permitido) {
      setMensagemNotificacaoSistema(
        "Permita notificações nas configurações do dispositivo para receber os avisos."
      );
    } else if (Capacitor.isNativePlatform()) {
      setMensagemNotificacaoSistema(
        "Permissão concedida. Registrando este aparelho no serviço de notificações..."
      );
    }
  } catch (error) {
    console.error("Falha ao solicitar permissão para notificações:", error);
    setMensagemNotificacaoSistema(
      "Não foi possível ativar as notificações neste dispositivo."
    );
  }
};

function msgErroPush(error) {
  const msg = String(error?.message || error || "");
  const baixo = msg.toLowerCase();
  if (baixo.includes("could not find the function") || baixo.includes("push_verify_token") || baixo.includes("schema cache"))
    return "Função de push desatualizada no servidor. Rode o SQL _blindagem_perfil.sql e faça deploy de manage-push-device.";
  if (baixo.includes("invalid device registration") || baixo.includes("invalid push"))
    return "Registro recusado pelo servidor. Saia e entre de novo, depois toque em Ativar notificações.";
  if (baixo.includes("invalid professional credentials"))
    return "Sua sessão expirou. Saia e entre de novo para registrar este aparelho.";
  if (baixo.includes("firebase") || baixo.includes("fcm"))
    return "Falha no Firebase (token inválido ou secret ausente). Reative as notificações neste aparelho.";
  if (baixo.includes("network") || baixo.includes("fetch") || baixo.includes("failed"))
    return "Sem conexão com o servidor de push. Confira a internet e tente de novo.";
  return msg || "Não foi possível registrar este aparelho no servidor.";
}

const salvarAssinaturaPush = async (plataforma, assinatura, tentativa = 1) => {
  const profissional = profissionalPushRef.current;
  if (!profissional?.id) {
    throw new Error("Entre na área profissional para registrar este dispositivo.");
  }
  const token = ag.getToken();
  // TOLERANTE: sem token (sessão restaurada antiga) ainda tenta registrar.
  // A função no servidor aceita senha como fallback durante a transição;
  // se falhar, guardamos o token FCM para reenviar após o próximo login.
  let idDispositivo = localStorage.getItem("agenda_pro_push_dispositivo");
  if (!idDispositivo) {
    idDispositivo = crypto.randomUUID();
    localStorage.setItem("agenda_pro_push_dispositivo", idDispositivo);
  }
  try {
    localStorage.setItem(
      `agenda_pro_push_pendente_${plataforma}`,
      JSON.stringify({ assinatura, quando: Date.now() })
    );
  } catch { /* ignora */ }

  const corpo = {
    action: "register",
    deviceId: idDispositivo,
    profissionalId: profissional.id,
    plataforma,
    ...(plataforma === "android"
      ? { tokenFcm: assinatura }
      : { assinaturaWeb: assinatura }),
  };
  if (token) corpo.profissionalToken = token;
  else if (profissional.senha) corpo.profissionalSenha = profissional.senha;

  const { error } = await supabase.functions.invoke("manage-push-device", {
    body: corpo,
  });
  if (error) {
    // 1ª falha pode ser função velha em cache: tenta 1x de novo antes de avisar.
    if (tentativa === 1) {
      await new Promise((r) => setTimeout(r, 1500));
      return salvarAssinaturaPush(plataforma, assinatura, 2);
    }
    throw new Error(msgErroPush(error));
  }
  try {
    localStorage.removeItem(`agenda_pro_push_pendente_${plataforma}`);
  } catch { /* ignora */ }
  setPushConfigurado(true);
  localStorage.setItem(`agenda_pro_push_registrado_${plataforma}`, "1");
  setMensagemNotificacaoSistema(
    "Este dispositivo foi registrado para receber avisos."
  );
};

// Quando o profissional entra, reenvia o registro pendente (FCM novo ou
// falha anterior) sem precisar tocar em "Ativar" de novo.
const reenviarPushPendente = async () => {
  try {
    const plataforma = Capacitor.isNativePlatform() ? "android" : "web";
    const pendente = localStorage.getItem(`agenda_pro_push_pendente_${plataforma}`);
    if (!pendente) return;
    const { assinatura } = JSON.parse(pendente);
    if (!assinatura) return;
    await salvarAssinaturaPush(plataforma, assinatura);
  } catch (error) {
    console.error("Push pendente não pôde ser reenviado agora:", error);
  }
};

const desativarNotificacoes = () => {
  const removerPush = async () => {
    try {
      const plataforma = Capacitor.isNativePlatform() ? "android" : "web";
      const idDispositivo = localStorage.getItem("agenda_pro_push_dispositivo");
      const profissional = profissionalPushRef.current;
      if (idDispositivo) {
        const token = ag.getToken();
        if (!profissional?.id || !token) {
          throw new Error("Entre novamente para remover este dispositivo.");
        }
        const { error } = await supabase.functions.invoke(
          "manage-push-device",
          {
            body: {
              action: "remove",
              deviceId: idDispositivo,
              profissionalId: profissional.id,
              profissionalToken: token,
            },
          }
        );
        if (error) throw error;
      }
      if (plataforma === "web") {
        const registration =
          await navigator.serviceWorker.getRegistration("/push-sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        await subscription?.unsubscribe();
      } else {
        await PushNotifications.unregister();
      }
      localStorage.setItem(
        `agenda_pro_notificacoes_${profissionalLogado?.id}_${plataforma}`,
        "0"
      );
      localStorage.removeItem(`agenda_pro_push_registrado_${plataforma}`);
      setPushConfigurado(false);
      notificacoesAtivasRef.current = false;
      setNotificacoesAtivas(false);
      setMensagemNotificacaoSistema("Alertas desativados neste dispositivo.");
    } catch (error) {
      console.error("Falha ao desativar notificações neste dispositivo:", error);
      setMensagemNotificacaoSistema(
        "Não foi possível desativar neste dispositivo."
      );
    }
  };
  removerPush();
};

useEffect(() => {
  let ativo = true;
  if (!profissionalLogado?.id) {
    return () => {
      ativo = false;
    };
  }

  const atualizarPermissao = async () => {
    try {
      const permissaoSistema = Capacitor.isNativePlatform()
        ? (await PushNotifications.checkPermissions()).receive === "granted"
        : "Notification" in window && Notification.permission === "granted";
      const preferenciaSalva = localStorage.getItem(
        `agenda_pro_notificacoes_${profissionalLogado.id}_${Capacitor.isNativePlatform() ? "app" : "web"}`
      );
      const permitido = permissaoSistema && preferenciaSalva !== "0";
      if (ativo) setNotificacoesAtivas(permitido);
      if (ativo) {
        setPushConfigurado(
          localStorage.getItem(
            `agenda_pro_push_registrado_${Capacitor.isNativePlatform() ? "android" : "web"}`
          ) === "1"
        );
      }
    } catch (error) {
      console.error("Falha ao verificar permissão para notificações:", error);
    }
  };

  atualizarPermissao();
  return () => {
    ativo = false;
  };
}, [profissionalLogado]);

useEffect(() => {
  if (!Capacitor.isNativePlatform()) return;

  // Garante que o canal de alta prioridade exista desde a abertura do app,
  // mesmo antes de o usuario tocar em "Ativar notificacoes". Assim, pushes que
  // chegarem com o app fechado sempre cairao neste canal e serao exibidos.
  // id "agendamentos_v3" garante canal novo com som (canais Android travam apos criados).
  PushNotifications.createChannel({
    id: "agendamentos_v3",
    name: "Agendamentos",
    description: "Avisos de novos agendamentos e confirmacoes",
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch((error) => {
    console.error("Falha ao criar o canal de notificacoes:", error);
  });

  let ativo = true;
  const listeners = [];
  const registrarListener = (promessa) => {
    promessa
      .then((listener) => {
        if (ativo) listeners.push(listener);
        else listener.remove();
      })
      .catch((error) => {
        console.error("Falha ao registrar evento de notificação:", error);
      });
  };
  registrarListener(
    PushNotifications.addListener("registration", ({ value }) => {
      salvarAssinaturaPush("android", value).catch((error) => {
        console.error("Falha ao salvar o token push do Android:", error);
        setMensagemNotificacaoSistema(String(error?.message || "Permissão concedida, mas não foi possível registrar o aparelho no servidor."));
      });
    })
  );
  registrarListener(
    PushNotifications.addListener("registrationError", (error) => {
      console.error("Falha ao registrar o aparelho no Firebase:", error);
      setMensagemNotificacaoSistema(
        "Não foi possível registrar o aparelho no Firebase. Confira a configuração e tente novamente."
      );
    })
  );
  registrarListener(
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (evento) => {
        const dados = evento.notification.data;
        abrirCalendarioNotificacaoRef.current?.({
          data: dados?.data,
          profissional_id: dados?.profissional_id,
        });
      }
    )
  );
  registrarListener(
    PushNotifications.addListener("pushNotificationReceived", (evento) => {
      if (evento.title || evento.body) {
        LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title: evento.title || "Novo agendamento",
              body: evento.body || "Um cliente agendou um horário.",
              schedule: { at: new Date(Date.now() + 250) },
              extra: evento.data,
            },
          ],
        }).catch((error) => {
          console.error("Falha ao apresentar a notificação recebida:", error);
        });
      }
    })
  );
  registrarListener(
    LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (evento) => {
        abrirCalendarioNotificacaoRef.current?.(evento.notification.extra);
      }
    )
  );

  return () => {
    ativo = false;
    listeners.forEach((listener) => listener.remove());
  };
}, []);

useEffect(() => {
  if (!profissionalLogado?.id || !notificacoesAtivas) return;
  // Ao entrar, tenta reenviar registro pendente (modo tolerante).
  reenviarPushPendente();
  const idDispositivo = localStorage.getItem("agenda_pro_push_dispositivo");
  const profissional = profissionalPushRef.current;
  const token = ag.getToken();
  if (!idDispositivo) return;
  const corpo = {
    action: "associate",
    deviceId: idDispositivo,
    profissionalId: profissional.id,
  };
  if (token) corpo.profissionalToken = token;
  else if (profissional.senha) corpo.profissionalSenha = profissional.senha;
  else return;
  supabase.functions
    .invoke("manage-push-device", {
      body: corpo,
    })
    .then(({ error }) => {
      if (error) {
        console.error("Falha ao associar o push à conta profissional:", error);
        setMensagemNotificacaoSistema(String(msgErroPush(error)));
      }
    });
}, [profissionalLogado, notificacoesAtivas]);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const profissionalId = Number(params.get("pushProfessional"));
  const data = params.get("pushDate");
  if (!profissionalId || !data) return;

  let timer = null;
  try {
    localStorage.setItem(
      "agenda_pro_notificacao_pendente",
      JSON.stringify({ profissional_id: profissionalId, data })
    );
    if (profissionalLogado?.id) {
      timer = window.setTimeout(
        () => abrirNotificacaoPendente(profissionalLogado.id),
        0
      );
    }
    window.history.replaceState({}, "", window.location.pathname);
  } catch (error) {
    console.error("Falha ao processar o link da notificação web:", error);
  }
  return () => {
    if (timer !== null) window.clearTimeout(timer);
  };
}, [profissionalLogado]);

useEffect(() => {
  const root = document.documentElement;
  root.style.setProperty("--cor-primaria", temaConfig.primary);
  root.style.setProperty("--cor-secundaria", temaConfig.secondary);
  root.style.setProperty("--fundo", temaConfig.background);
  root.style.setProperty("--cor-borda", temaConfig.border);
}, [temaConfig]);

useEffect(() => {

async function carregarHorariosProfissional(){

if(!profissionalLogado) return;



const { data: resultado, error } = await supabase
.from("profissionais")
.select("horarios_disponiveis, status_atendimento")
.eq("id", profissionalLogado.id)
.single();


if(error){
console.error(error);
return;
}


setHorariosDisponiveis(
  resultado.horarios_disponiveis || []
);


setStatusAtendimento(
resultado.status_atendimento || "Aberto"
);


}


carregarHorariosProfissional();


}, [profissionalLogado]);

useEffect(() => {
  async function carregarDiasFolga() {
    if (!profissionalLogado) {
      setDiasFolga([]);
      return;
    }
    const dias = await buscarDiasFolga(profissionalLogado.id);
    setDiasFolga(dias);
  }

  carregarDiasFolga();
}, [profissionalLogado]);

// Carrega as datas específicas de folga do profissional logado.
useEffect(() => {
  async function carregarFolgasDatas() {
    if (!profissionalLogado) {
      setFolgasDatas([]);
      return;
    }
    const datas = await buscarFolgasDatas(profissionalLogado.id);
    setFolgasDatas(datas);
  }

  carregarFolgasDatas();
}, [profissionalLogado]);

// Quando o profissional abre as Configurações, carrega do banco os dados
// atuais do Pix (chave + banco) cadastrados no perfil dele.
useEffect(() => {
  if (!mostrarConfiguracoes || !profissionalLogado?.id) return;

  supabase
    .from("profissionais")
    .select("chave_pix, banco_pix, nome_pix")
    .eq("id", profissionalLogado.id)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error(error);
        return;
      }
      setPixChave(data?.chave_pix || "");
      setPixBanco(data?.banco_pix || "");
      setPixNome(data?.nome_pix || "");
    });

  // Endereço: carregado por separado para que, se as colunas ainda não
  // existem na base (migração pendente), o PIX continua funcionando normal.
  supabase
    .from("profissionais")
    .select("endereco_rua, endereco_numero, endereco_cep, mostrar_endereco, horario_funcionamento_inicio, horario_funcionamento_fim, mostrar_horario_funcionamento, dias_atendimento_perfil")
    .eq("id", profissionalLogado.id)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error(error);
        return;
      }
      setEnderecoRua(data?.endereco_rua || "");
      setEnderecoNumero(data?.endereco_numero || "");
      setEnderecoCep(data?.endereco_cep || "");
      setMostrarEndereco(data?.mostrar_endereco === true);
      setHorarioFuncionamentoInicio(data?.horario_funcionamento_inicio || "");
      setHorarioFuncionamentoFim(data?.horario_funcionamento_fim || "");
      setMostrarHorarioFuncionamento(data?.mostrar_horario_funcionamento === true);
      setDiasAtendimentoPerfil(
        Array.isArray(data?.dias_atendimento_perfil)
          ? data.dias_atendimento_perfil.filter((dia) => diasSemana.includes(dia))
          : []
      );
    });
}, [mostrarConfiguracoes, profissionalLogado?.id]);

const diasSemana = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo"
];
const diasAtendimentoPerfilTexto = formatarDiasAtendimentoPerfil(
  Array.isArray(dadosProfissionalCliente?.dias_atendimento_perfil)
    ? dadosProfissionalCliente.dias_atendimento_perfil
    : [],
  diasSemana
);
const [diaSelecionado, setDiaSelecionado] = useState("segunda");

const [horariosTrabalho, setHorariosTrabalho] = useState([]);

const [periodoHorario, setPeriodoHorario] = useState("todos");

// Dias da semana marcados como FOLGA (ninguém consegue agendar nesses dias).
const [diasFolga, setDiasFolga] = useState([]);
// Dias de folga vistos na tela do CLIENTE (do profissional que está agendando).
const [diasFolgaCliente, setDiasFolgaCliente] = useState([]);
const [profissionalDiasFolgaClienteCarregados, setProfissionalDiasFolgaClienteCarregados] =
  useState(null);
// Datas específicas de folga (um dia no mês) do profissional logado.
const [folgasDatas, setFolgasDatas] = useState([]);
// Datas específicas de folga vistas na tela do CLIENTE.
const [folgasDatasCliente, setFolgasDatasCliente] = useState([]);
// Data escolhida no seletor de folga (configurar horários).
const [dataFolga, setDataFolga] = useState("");
// Mensagem inline da seção de folgas em datas específicas.
const [folgaDataMensagem, setFolgaDataMensagem] = useState("");
const [folgaDataMensagemTipo, setFolgaDataMensagemTipo] = useState("");
// Mensagem inline do botão "copiar horários para todos os dias".
const [copiarHorariosMensagem, setCopiarHorariosMensagem] = useState("");
const [copiarHorariosMensagemTipo, setCopiarHorariosMensagemTipo] = useState("");


const tema = 
dadosProfissionalCliente?.tema === "masculino"
? "masculino"
: "feminino";


const listaHorarios = [
  "00:00",
  "00:30",
  "01:00",
  "01:30",
  "02:00",
  "02:30",
  "03:00",
  "03:30",
  "04:00",
  "04:30",
  "05:00",
  "05:30",
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
  "23:30"
];
const horariosFiltrados = listaHorarios.filter((hora) => {

  const horaNumero = parseInt(hora.split(":")[0]);


  if (periodoHorario === "madrugada") {
    return horaNumero >= 0 && horaNumero < 7;
  }


  if (periodoHorario === "manha") {
    return horaNumero >= 7 && horaNumero < 12;
  }


  if (periodoHorario === "tarde") {
    return horaNumero >= 12 && horaNumero < 18;
  }


  if (periodoHorario === "noite") {
    return horaNumero >= 18 && horaNumero <= 23;
  }


  return true;

});
async function marcarPeriodo(periodo){

let horariosDoPeriodo = listaHorarios.filter((hora)=>{

const h = parseInt(hora.split(":")[0]);

if(periodo === "madrugada")
return h >= 0 && h < 7;

if(periodo === "manha")
return h >= 7 && h < 12;

if(periodo === "tarde")
return h >= 12 && h < 18;

if(periodo === "noite")
return h >= 18 && h <= 23;

return true;

});

// Se TODOS os horários do período já estão marcados, desmarca tudo.
// Caso contrário, marca os que faltam.
const jaMarcadosCompletos = horariosDoPeriodo.every(
  (hora) => horariosTrabalho.includes(hora)
);

if (jaMarcadosCompletos) {

// Desmarcar: remove do banco e da lista
const { error } = await supabase
.from("horarios_trabalho")
.delete()
.eq("profissional_id", profissionalLogado.id)
.eq("dia_semana", diaSelecionado)
.in("horario", horariosDoPeriodo);

if(error){
console.error(error);
alert("Erro ao desmarcar horários: " + error.message);
return;
}

setHorariosTrabalho((prev) =>
  prev.filter((hora) => !horariosDoPeriodo.includes(hora))
);

} else {

const novosHorarios = horariosDoPeriodo.filter(
  (hora) => !horariosTrabalho.includes(hora)
);

if(novosHorarios.length > 0){

const { error } = await supabase
.from("horarios_trabalho")
.insert(
novosHorarios.map((hora)=>({
  profissional_id: profissionalLogado.id,
  dia_semana: diaSelecionado,
  horario: hora
}))
);

if(error){
console.error(error);
alert("Erro ao marcar horários: " + error.message);
return;
}

}

setHorariosTrabalho([
  ...new Set([
    ...horariosTrabalho,
    ...horariosDoPeriodo
  ])
]);

}
}

// Copia os horários marcados no dia atual para TODOS os dias da semana,
// substituindo os horários dos outros dias (as folgas continuam intactas).
async function copiarHorariosParaTodosDias() {

if (!profissionalLogado?.id) return;

if (horariosTrabalho.length === 0) {
setCopiarHorariosMensagem(
  "Marque pelo menos um horário no dia atual para poder copiar."
);
setCopiarHorariosMensagemTipo("erro");
return;
}

const diasAlvo = diasSemana.filter((dia) => dia !== diaSelecionado);

const confirmou = window.confirm(
  `Definir os ${horariosTrabalho.length} horários de "${diaSelecionado}" para TODOS os dias da semana?\n\nOs horários atuais dos outros dias serão substituídos.`
);

if (!confirmou) return;

// Apaga os horários reais dos outros dias (mantém as marcações de FOLGA).
const { error: erroApagar } = await supabase
.from("horarios_trabalho")
.delete()
.eq("profissional_id", profissionalLogado.id)
.in("dia_semana", diasAlvo)
.neq("horario", "FOLGA");

if (erroApagar) {
console.error(erroApagar);
setCopiarHorariosMensagem("❌ Erro ao copiar os horários: " + erroApagar.message);
setCopiarHorariosMensagemTipo("erro");
return;
}

// Insere os horários do dia atual em todos os outros dias.
const linhas = [];

for (const dia of diasAlvo) {
for (const hora of horariosTrabalho) {
linhas.push({
  profissional_id: profissionalLogado.id,
  dia_semana: dia,
  horario: hora,
});
}
}

if (linhas.length > 0) {
const { error: erroInserir } = await supabase
  .from("horarios_trabalho")
  .insert(linhas);

if (erroInserir) {
  console.error(erroInserir);
  setCopiarHorariosMensagem("❌ Erro ao copiar os horários: " + erroInserir.message);
  setCopiarHorariosMensagemTipo("erro");
  return;
}
}

setCopiarHorariosMensagem(
  `✅ ${horariosTrabalho.length} horários copiados para ${diasAlvo.length} dia(s) da semana!`
);
setCopiarHorariosMensagemTipo("sucesso");

}

useEffect(() => {
  let cancelado = false;

  async function carregarHorariosCliente() {
    if (!profissionalCliente) {
      setHorariosPorLinhaCliente({});
      setDiasFolgaCliente([]);
      setFolgasDatasCliente([]);
      setProfissionalDiasFolgaClienteCarregados(null);
      return;
    }

    const mapa = {};

    // Dias de folga do profissional que o cliente está vendo.
    const diasFolgaDoProfissional = profissionalCliente
      ? await buscarDiasFolga(profissionalCliente)
      : [];
    if (cancelado) return;
    setDiasFolgaCliente(diasFolgaDoProfissional);

    // Datas específicas de folga do profissional que o cliente está vendo.
    const folgasDatasDoProfissional = profissionalCliente
      ? await buscarFolgasDatas(profissionalCliente)
      : [];
    if (cancelado) return;
    setFolgasDatasCliente(folgasDatasDoProfissional);
    setProfissionalDiasFolgaClienteCarregados(profissionalCliente);

    for (let i = 0; i < itensCliente.length; i++) {
      const item = itensCliente[i];

      if (!item.data) {
        mapa[i] = [];
        continue;
      }

      const promocaoDaLinha = item.em_promocao
        ? promocoes.find((promo) => Number(promo.id) === Number(item.promo_id))
        : null;
      if (
        item.em_promocao &&
        (!promocaoDaLinha || !promocaoAtivaEm(promocaoDaLinha, item.data))
      ) {
        mapa[i] = [];
        continue;
      }

      const dataEscolhida = new Date(item.data + "T00:00:00");

      const diaSemana = diasSemanaPorIndice[dataEscolhida.getDay()];

      // Dia de folga: nenhum horário fica disponível para o cliente.
      if (diasFolgaDoProfissional.includes(diaSemana)) {
        mapa[i] = [];
        continue;
      }

      // Data específica de folga: nenhum horário disponível também.
      if (folgasDatasDoProfissional.includes(item.data)) {
        mapa[i] = [];
        continue;
      }

      const { data: horarios, error } = await supabase
        .from("horarios_trabalho")
        .select("horario")
        .eq("profissional_id", profissionalCliente)
        .eq("dia_semana", diaSemana);

      if (error) {
        console.error(error);
        continue;
      }
      if (cancelado) return;

      const hojeData = new Date();

      const hoje =
        hojeData.getFullYear() +
        "-" +
        String(hojeData.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(hojeData.getDate()).padStart(2, "0");

      const agora = new Date();

      const slotsDelDia = (horarios || []).map((linha) => linha.horario);

      // Ocupados: agendamentos ativos do dia + horários escolhidos nas outras linhas,
      // respetando a DURAÇÃO de cada serviço (ex.: 13:00 com 2h ocupa 13:00 e 14:00).
      const ocupados = new Set();

      const marcarOcupados = (horarioOcupado, nomeServicio) => {
        if (!horarioOcupado) return;
        const horas = duracaoHorasDeServicio(
          nomeServicio,
          servicos,
          profissionalCliente
        );
        slotsQueOcupa(horarioOcupado, horas, slotsDelDia).forEach((slot) =>
          ocupados.add(slot)
        );
      };

      pedidos
        .filter((ped) => ped.data === item.data)
        .filter(
          (ped) => ped.status === "Agendado" && ped.horario_liberado !== true
        )
        .forEach((ped) => marcarOcupados(ped.horario, ped.servico));

      itensCliente.forEach((outro, outroIndice) => {
        if (outroIndice !== i && outro.data === item.data && outro.horario) {
          marcarOcupados(outro.horario, outro.servico);
        }
      });

      // A linha atual também tem que "caber" com a própria duração:
      // um serviço de 2h às 13:00 só fica livre se 13:00 E 14:00 estiverem livres.
      const horasServicioLinha = duracaoHorasDeItem(
        item,
        servicos,
        profissionalCliente,
        promocoes
      );

      const horariosDisponiveisFiltrados = (horarios || [])
        .map((linha) => linha.horario)
        .filter((hora) =>
          slotsQueOcupa(hora, horasServicioLinha, slotsDelDia).every(
            (slot) => !ocupados.has(slot)
          )
        )
        .filter((hora) => {
          // Se não for hoje, mantém todos
          if (item.data !== hoje) {
            return true;
          }

          const [horaSlot, minutoSlot] = hora.split(":").map(Number);

          const horaAtual = agora.getHours();
          const minutoAtual = agora.getMinutes();

          // Bloqueia horários que já passaram
          if (
            horaSlot < horaAtual ||
            (horaSlot === horaAtual && minutoSlot <= minutoAtual)
          ) {
            return false;
          }

          return true;
        });

      mapa[i] = horariosDisponiveisFiltrados;
    }

    if (!cancelado) setHorariosPorLinhaCliente(mapa);
  }

  carregarHorariosCliente();
  return () => {
    cancelado = true;
  };
}, [profissionalCliente, itensCliente, pedidos, servicos, promocoes]);

// Horários livres para AGENDAR POR um cliente (formulário dentro da área profissional).
useEffect(() => {
  let cancelado = false;

  async function carregarHorariosAgendarCliente() {
    if (!profissionalLogado || !mostrarAgendarCliente) {
      setHorariosPorLinhaAgendarCliente({});
      return;
    }

    const mapa = {};

    // Dias de folga do profissional logado.
    const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);
    if (cancelado) return;
    const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalLogado.id);
    if (cancelado) return;

    for (let i = 0; i < itensAgendarCliente.length; i++) {
      const item = itensAgendarCliente[i];

      if (!item.data) {
        mapa[i] = [];
        continue;
      }

      const promocaoDaLinha = item.em_promocao
        ? promocoes.find((promo) => Number(promo.id) === Number(item.promo_id))
        : null;
      if (
        item.em_promocao &&
        (!promocaoDaLinha || !promocaoAtivaEm(promocaoDaLinha, item.data))
      ) {
        mapa[i] = [];
        continue;
      }

      const dataEscolhida = new Date(item.data + "T00:00:00");

      const diaSemana = diasSemanaPorIndice[dataEscolhida.getDay()];

      // Dia de folga: nenhum horário fica disponível.
      if (diasFolgaDoProfissional.includes(diaSemana)) {
        mapa[i] = [];
        continue;
      }

      // Data específica de folga: nenhum horário disponível também.
      if (folgasDatasDoProfissional.includes(item.data)) {
        mapa[i] = [];
        continue;
      }

      const { data: horarios, error } = await supabase
        .from("horarios_trabalho")
        .select("horario")
        .eq("profissional_id", profissionalLogado.id)
        .eq("dia_semana", diaSemana);

      if (error) {
        console.error(error);
        continue;
      }
      if (cancelado) return;

      const agora = new Date();

      const hoje =
        agora.getFullYear() +
        "-" +
        String(agora.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(agora.getDate()).padStart(2, "0");

      const slotsDelDia = (horarios || []).map((linha) => linha.horario);

      // Ocupados: agendamentos ativos do dia + horários escolhidos nas outras linhas,
      // respetando a DURAÇÃO de cada serviço (ex.: 13:00 com 2h ocupa 13:00 e 14:00).
      const ocupados = new Set();

      const marcarOcupados = (horarioOcupado, nomeServicio) => {
        if (!horarioOcupado) return;
        const horas = duracaoHorasDeServicio(
          nomeServicio,
          meusServicos,
          profissionalLogado.id
        );
        slotsQueOcupa(horarioOcupado, horas, slotsDelDia).forEach((slot) =>
          ocupados.add(slot)
        );
      };

      pedidos
        .filter((ped) => ped.data === item.data)
        .filter(
          (ped) => ped.status === "Agendado" && ped.horario_liberado !== true
        )
        .forEach((ped) => marcarOcupados(ped.horario, ped.servico));

      itensAgendarCliente.forEach((outro, outroIndice) => {
        if (outroIndice !== i && outro.data === item.data && outro.horario) {
          marcarOcupados(outro.horario, outro.servico);
        }
      });

      // A linha atual também tem que "caber" com a própria duração.
      const horasServicioLinha = duracaoHorasDeItem(
        item,
        meusServicos,
        profissionalLogado.id,
        promocoes
      );

      const horariosLivres = (horarios || [])
        .map((linha) => linha.horario)
        .filter((hora) =>
          slotsQueOcupa(hora, horasServicioLinha, slotsDelDia).every(
            (slot) => !ocupados.has(slot)
          )
        )
        .filter((hora) => {
          // Se não for hoje, mantém todos os horários
          if (item.data !== hoje) return true;

          const [horaSlot, minutoSlot] = hora.split(":").map(Number);

          const horaAtual = agora.getHours();
          const minutoAtual = agora.getMinutes();

          if (
            horaSlot < horaAtual ||
            (horaSlot === horaAtual && minutoSlot <= minutoAtual)
          ) {
            return false;
          }

          return true;
        });

      mapa[i] = horariosLivres;
    }

    if (!cancelado) setHorariosPorLinhaAgendarCliente(mapa);
  }

  carregarHorariosAgendarCliente();
  return () => {
    cancelado = true;
  };
}, [profissionalLogado, mostrarAgendarCliente, itensAgendarCliente, pedidos, meusServicos, promocoes]);

// Horários livres para REAGENDAR um agendamento (formulário dentro da agenda).
// Usa a mesma regra de ocupação da agenda: bloqueia apenas agendamentos ativos,
// ignorando o próprio agendamento que está sendo remarcado.
useEffect(() => {
  async function carregarHorariosReagendamento() {
    if (!profissionalLogado || !reagendandoPedido || !novaDataReagendamento) {
      setHorariosReagendamento([]);
      return;
    }

    const dataEscolhida = new Date(novaDataReagendamento + "T00:00:00");

    // Dia de folga: nenhum horário fica livre para reagendar.
    const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);

    if (
      diasFolgaDoProfissional.includes(
        diasSemanaPorIndice[dataEscolhida.getDay()]
      )
    ) {
      setHorariosReagendamento([]);
      return;
    }

    // Data específica de folga: nenhum horário livre para reagendar.
    const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalLogado.id);
    if (folgasDatasDoProfissional.includes(novaDataReagendamento)) {
      setHorariosReagendamento([]);
      return;
    }

    const diaSemana = diasSemanaPorIndice[dataEscolhida.getDay()];

    const { data: horarios, error } = await supabase
      .from("horarios_trabalho")
      .select("horario")
      .eq("profissional_id", profissionalLogado.id)
      .eq("dia_semana", diaSemana);

    if (error) {
      console.error(error);
      return;
    }

    const agora = new Date();

    const hoje =
      agora.getFullYear() +
      "-" +
      String(agora.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(agora.getDate()).padStart(2, "0");

    const slotsDelDia = horarios.map((linha) => linha.horario);

    // Regra de duración: um agendamento ocupa [inicio, inicio + duração).
    // Aquí também se respeita a duração do serviço que está sendo reagendado.
    const ocupados = new Set();

    const marcarOcupados = (horarioOcupado, nomeServicio) => {
      if (!horarioOcupado) return;
      const horas = duracaoHorasDeServicio(
        nomeServicio,
        meusServicos,
        profissionalLogado.id
      );
      slotsQueOcupa(horarioOcupado, horas, slotsDelDia).forEach((slot) =>
        ocupados.add(slot)
      );
    };

    pedidos
      .filter((item) => item.data === novaDataReagendamento)
      .filter(
        (item) =>
          item.status === "Agendado" &&
          item.horario_liberado !== true &&
          item.id !== reagendandoPedido.id
      )
      .forEach((item) => marcarOcupados(item.horario, item.servico));

    // O serviço reagendado também ocupa toda a sua duración na nova data.
    const horasServicioReagendado = duracaoHorasDeServicio(
      reagendandoPedido.servico,
      meusServicos,
      profissionalLogado.id
    );

    const horariosLivres = horarios
      .map((item) => item.horario)
      .filter((hora) =>
        slotsQueOcupa(hora, horasServicioReagendado, slotsDelDia).every(
          (slot) => !ocupados.has(slot)
        )
      )
      .filter((hora) => {
        // Se não for hoje, mantém todos os horários
        if (novaDataReagendamento !== hoje) return true;

        const [horaSlot, minutoSlot] = hora.split(":").map(Number);

        const horaAtual = agora.getHours();
        const minutoAtual = agora.getMinutes();

        if (
          horaSlot < horaAtual ||
          (horaSlot === horaAtual && minutoSlot <= minutoAtual)
        ) {
          return false;
        }

        return true;
      });

    setHorariosReagendamento(horariosLivres);
  }

  carregarHorariosReagendamento();
}, [profissionalLogado, reagendandoPedido, novaDataReagendamento, pedidos, meusServicos]);

const params = new URLSearchParams(window.location.search);

console.log("URL COMPLETA:", window.location.href);
console.log("PARAMETRO PROFISSIONAL:", params.get("profissional"));

const profissionalIdLink = Number(params.get("profissional"));

console.log("ID FINAL:", profissionalIdLink);

useEffect(() => {

  if (profissionalIdLink && params.get("login") === "1") {
    // Link do profissional: abre direto a tela de login da área profissional.
    setCarregandoPerfil(false);

    // Se já existe uma sessão salva deste mesmo profissional, entra direto.
    let sessao = null;
    try {
      const dados = JSON.parse(localStorage.getItem("profissionalLogado") || "");
      if (dados?.id === profissionalIdLink) sessao = dados;
    } catch (e) {}

    if (sessao) {
      setProfissionalLogado(sessao);
      abrirNotificacaoPendente(sessao.id);
      setTemaSelecionado(sessao.tema || "feminino");
      setIconeSelecionado(normalizarIcone(sessao.icone) || (sessao.tema === "masculino" ? "💈" : "💅🏻"));
      setTela(sessao.tipo === "super_admin" ? "admin" : "profissional");
    } else {
      setTela("login");

      // Já preenche o nome do profissional do link para facilitar o login.
      supabase
        .from("profissionais")
        .select("nome")
        .eq("id", profissionalIdLink)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.nome) {
            setLoginNome(data.nome);
          }
        })
        .catch(() => {});
    }
  } else if (profissionalIdLink) {
    setCarregandoPerfil(true);
    setProfissionalCliente(profissionalIdLink);
    setTela("cliente");
  }

}, []);

// Deep link no app Android: quando o link de um profissional é tocado, o app
// abre direto na tela certa — agenda do cliente (?profissional=ID) ou área
// profissional com o nome preenchido (?profissional=ID&login=1).
useEffect(() => {
  let listener = null;

  // Mesmo comportamento do link normal aberto no navegador.
  function abrirAgendaDoProfissional(url) {
    try {
      const dadosUrl = new URL(url);
      const idLink = Number(dadosUrl.searchParams.get("profissional"));
      if (!idLink) return;

      // Link do profissional (?profissional=ID&login=1): abre a área
      // profissional com o nome já preenchido, faltando só a senha.
      if (dadosUrl.searchParams.get("login") === "1") {
        setCarregandoPerfil(false);

        // Se já existe uma sessão salva deste mesmo profissional, entra direto.
        let sessao = null;
        try {
          const salvo = JSON.parse(
            localStorage.getItem("profissionalLogado") || ""
          );
          if (salvo?.id === idLink) sessao = salvo;
        } catch (e) {
          console.error("Falha ao ler a sessão salva:", e);
        }

        if (sessao) {
          setProfissionalLogado(sessao);
          abrirNotificacaoPendente(sessao.id);
          setTemaSelecionado(sessao.tema || "feminino");
          setIconeSelecionado(
            normalizarIcone(sessao.icone) || (sessao.tema === "masculino" ? "💈" : "💅🏻")
          );
          setTela(sessao.tipo === "super_admin" ? "admin" : "profissional");
          return;
        }

        setTela("login");

        // Já preenche o nome do profissional do link para facilitar o login.
        supabase
          .from("profissionais")
          .select("nome")
          .eq("id", idLink)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.nome) {
              setLoginNome(data.nome);
            }
          })
          .catch(() => {});

        return;
      }

      // Link de agendamento do cliente: abre direto a agenda do profissional.
      // Lembra o profissional neste aparelho para que, a partir da segunda
      // vez, abrir o app já caia direto na agenda dele (sem tocar no link).
      try {
        localStorage.setItem("profissionalClienteUltimo", String(idLink));
      } catch (e) {
        console.error("Falha ao salvar o profissional neste aparelho:", e);
      }

      setCarregandoPerfil(true);
      setProfissionalCliente(idLink);
      setTela("cliente");
    } catch (e) {
      console.error("Erro ao abrir link do profissional:", e);
    }
  }

  // App aberto pelo link (o app estava fechado).
  let lancamento = null;
  try {
    lancamento = CapacitorApp.getLaunchUrl();
  } catch (e) {
    console.error("Falha ao ler o link de abertura do app:", e);
  }

  if (lancamento && typeof lancamento.then === "function") {
    lancamento
      .then((resultado) => {
        if (resultado?.url) abrirAgendaDoProfissional(resultado.url);
      })
      .catch(() => {});
  } else if (lancamento?.url) {
    abrirAgendaDoProfissional(lancamento.url);
  }

  // App já estava aberto e o link foi tocado.
  CapacitorApp.addListener("appUrlOpen", (evento) => {
    if (evento?.url) abrirAgendaDoProfissional(evento.url);
  })
    .then((handle) => {
      listener = handle;
    })
    .catch(() => {});

  return () => {
    if (listener && typeof listener.remove === "function") {
      listener.remove();
    }
  };
}, []);

// Acesso do cliente é SOMENTE via link (?profissional=ID).
// Sem auto-restore do último cliente: sem sessão o app abre no login.
useEffect(() => {
  return;
}, []);

// Colunas liberadas para leitura pública em `profissionais` (pós-blindagem).
// NUNCA usar select("*") aqui: o Supabase nega o "*" quando há privilégio
// por coluna (senha/senha_hash escondidas) e isso apagava a sessão salva.
// Manter sincronizado com as colunas usadas pelo app.
const COLUNAS_PERFIL =
  "id,nome,tipo,ativo,tema,icone,status_atendimento,horarios_disponiveis," +
  "validade_plano,plano_ilimitado,exigir_aprovacao_dezembro," +
  "chave_pix,banco_pix,nome_pix," +
  "endereco_rua,endereco_numero,endereco_cep,mostrar_endereco," +
  "horario_funcionamento_inicio,horario_funcionamento_fim," +
  "mostrar_horario_funcionamento,dias_atendimento_perfil," +
  "seletor_promocoes_habilitado";

// Entra direto na área com os dados salvos (modo offline / falha de rede),
// sem apagar a sessão. Só apaga quando o perfil realmente não existe mais.
async function entrarComSessaoSalva(salvo) {
  // Verifica se o plano expirou e a versao gratuita esta desativada.
  if (planoExpirado(salvo) && salvo.tipo !== "super_admin") {
    try {
      const { data: cfgData } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "permitir_versao_gratuita_apos_expiracao")
        .maybeSingle();
      if (cfgData?.valor !== "true") {
        await supabase
          .from("profissionais")
          .update({ ativo: false })
          .eq("id", salvo.id);
        localStorage.removeItem("profissionalLogado");
        setTela("login");
        setMensagemLogin(
          "Seu plano expirou e a versão gratuita está desativada. Entre em contato com o administrador."
        );
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }
  setProfissionalLogado(salvo);
  try {
    abrirNotificacaoPendente(salvo.id);
  } catch {}
  setTemaSelecionado(salvo.tema || "feminino");
  setIconeSelecionado(
    normalizarIcone(salvo.icone) || (salvo.tema === "masculino" ? "💈" : "💅🏻")
  );
  setTela(salvo.tipo === "super_admin" ? "admin" : "profissional");
}

// Restaura a sessão do profissional ao atualizar a página (F5),
// sem precisar logar novamente. Valida no banco se ainda está ativo.
useEffect(() => {
  const paramsUrl = new URLSearchParams(window.location.search);
  const idLink = Number(paramsUrl.get("profissional"));

  // Em páginas de link público do cliente, não restaura a sessão.
  if (idLink) return;

  const salvo = localStorage.getItem("profissionalLogado");
  if (!salvo) return;

  async function restaurarSessao() {
    let dados = null;
    try {
      dados = JSON.parse(salvo);
    } catch {
      localStorage.removeItem("profissionalLogado");
      return;
    }
    if (!dados?.id) {
      localStorage.removeItem("profissionalLogado");
      return;
    }

    try {
    // Sem token de sessão válido neste aparelho, mantém a tela inicial
    // mas NÃO apaga os dados salvos (o token pode ter sido limpo sem logout).
    if (!ag.getToken()) {
      entrarComSessaoSalva(dados);
      return;
    }

    let atual = null;
    let error = null;
    try {
      const resposta = await supabase
        .from("profissionais")
        .select(COLUNAS_PERFIL)
        .eq("id", dados.id)
        .maybeSingle();
      atual = resposta.data;
      error = resposta.error;
    } catch (e) {
      // Sem internet / falha de rede ao reabrir o app: entra com os dados
      // salvos em vez de apagar a sessão e mostrar "perfil excluído".
      console.error("Falha de rede ao validar sessão salva:", e);
      entrarComSessaoSalva(dados);
      return;
    }

    if (error) {
      const codigo = String(error.code || "");
      const mensagem = String(error.message || "").toLowerCase();
      const ehPermissaoOuRede =
        codigo === "42501" ||
        mensagem.includes("permission denied") ||
        mensagem.includes("sem permiss") ||
        mensagem.includes("network") ||
        mensagem.includes("fetch") ||
        mensagem.includes("failed") ||
        mensagem.includes("timeout");
      if (ehPermissaoOuRede) {
        // Coluna nova ainda sem grant, RLS ou app offline: não apaga a sessão.
        console.error("Sessão mantida (falha ao validar no banco):", error);
        entrarComSessaoSalva(dados);
        return;
      }
      // Erro real de banco: pede login de novo, mas mostra msg genérica.
      console.error("Erro ao validar sessão salva:", error);
      setTela("login");
      setMensagemLogin("Não foi possível validar sua sessão. Entre novamente.");
      return;
    }

    if (!atual) {
      // Aqui sim: o perfil foi excluído / não existe mais no banco.
      localStorage.removeItem("profissionalLogado");
      ag.setToken(null);
      setTela("login");
      setMensagemLogin("Este perfil não existe mais ou foi excluído.");
      return;
    }

      // Verifica se o plano expirou e a versao gratuita esta desativada.
      // Nesse caso, bloqueia o login imediatamente, sem entrar na agenda.
      if (planoExpirado(atual)) {
        const { data: cfgData } = await supabase
          .from("configuracoes_sistema")
          .select("valor")
          .eq("chave", "permitir_versao_gratuita_apos_expiracao")
          .maybeSingle();
        const versaoGratuitaAtual = cfgData?.valor === "true";
        if (!versaoGratuitaAtual) {
          await supabase
            .from("profissionais")
            .update({ ativo: false })
            .eq("id", atual.id);
          localStorage.removeItem("profissionalLogado");
          setTela("login");
          setMensagemLogin(
            "Seu plano expirou e a versão gratuita está desativada. Entre em contato com o administrador."
          );
          return;
        }
      }


      if (!atual.ativo) {
        if (planoExpirado(atual)) {
          // Plano expirou: depende da configuracao global de versao gratuita.
            const { data: cfgData } = await supabase
              .from("configuracoes_sistema")
              .select("valor")
              .eq("chave", "permitir_versao_gratuita_apos_expiracao")
              .maybeSingle();
            const versaoGratuitaAtual = cfgData?.valor === "true";

          if (versaoGratuitaAtual) {
            // Reativa automaticamente para versao gratuita com anuncios.
            await supabase
              .from("profissionais")
              .update({ ativo: true })
              .eq("id", atual.id);
            const { data: atualizado } = await supabase
              .from("profissionais")
              .select(COLUNAS_PERFIL)
              .eq("id", atual.id)
              .maybeSingle();
            if (atualizado) {
              atual = atualizado;
            }
          } else {
            // Versao gratuita desabilitada: mantem bloqueado e avisa.
            localStorage.removeItem("profissionalLogado");
            setTela("login");
            setMensagemLogin(
              "Seu plano expirou e a versão gratuita está desativada. Entre em contato com o administrador."
            );
            return;
          }
        } else {
          // Perfil foi desativado manualmente pelo administrador.
          localStorage.removeItem("profissionalLogado");
          setTela("login");
          setMensagemLogin("Este perfil foi desativado pelo administrador.");
          return;
        }
      }

      // Plano expirado nao bloqueia mais o login: o profissional entra
      // na versao gratuita com anuncios. O admin pode adicionar dias depois.
      localStorage.setItem("profissionalLogado", JSON.stringify(atual));
      setProfissionalLogado(atual);
      abrirNotificacaoPendente(atual.id);
      setTemaSelecionado(atual.tema || "feminino");
      setIconeSelecionado(normalizarIcone(atual.icone) || (atual.tema === "masculino" ? "💈" : "💅🏻"));
      setTela(atual.tipo === "super_admin" ? "admin" : "profissional");
    } catch (e) {
      // Erro inesperado: mantém a sessão salva e entra offline.
      console.error("Falha inesperada ao restaurar sessão:", e);
      try {
        const dadosSalvos = JSON.parse(salvo);
        if (dadosSalvos?.id) {
          entrarComSessaoSalva(dadosSalvos);
          return;
        }
      } catch {}
      localStorage.removeItem("profissionalLogado");
    }
  }

  restaurarSessao();
}, []);

// Carrega a configuração global de versão gratuita do sistema.
async function carregarConfiguracaoVersaoGratuita() {
  setCarregandoConfigSistema(true);
  try {
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "permitir_versao_gratuita_apos_expiracao")
      .maybeSingle();
    if (error) {
      console.error("Erro ao carregar configuração de versão gratuita:", error);
      return;
    }
    setVersaoGratuitaHabilitada(data?.valor === "true");
  } catch (e) {
    console.error("Falha ao carregar configuração de versão gratuita:", e);
  } finally {
    setCarregandoConfigSistema(false);
  }
}

// Salva a configuração global de versão gratuita no sistema.
async function salvarConfiguracaoVersaoGratuita(valor) {
  try {
    const { error } = await supabase
      .from("configuracoes_sistema")
      .upsert({
        chave: "permitir_versao_gratuita_apos_expiracao",
        valor: String(valor),
        atualizado_em: new Date().toISOString(),
      })
      .select();
    if (error) {
      console.error("Erro ao salvar configuração de versão gratuita:", error);
      alert("Erro ao salvar a configuração. Tente novamente.");
      return;
    }
    setVersaoGratuitaHabilitada(valor);
    alert(
      valor
        ? "✅ Versão gratuita HABILITADA: após o plano expirar, o profissional continua na versão grátis com anúncios."
        : "✅ Versão gratuita DESABILITADA: após o plano expirar, o perfil do profissional será desativado automaticamente."
    );
  } catch (e) {
    console.error("Falha ao salvar configuração de versão gratuita:", e);
    alert("Erro ao salvar a configuração. Tente novamente.");
  }
}

// Ao entrar no painel do admin, carrega a lista de profissionais e a configuração
// global de versão gratuita. Se a versão gratuita estiver desabilitada, desativa
// automaticamente quem estiver com o plano vencido.
useEffect(() => {
  if (tela === "admin") {
    carregarProfissionaisAdmin();
    carregarConfiguracaoVersaoGratuita();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tela]);

// Vigia o plano enquanto o profissional está logado: se o prazo zerar com o
// app aberto e a versao gratuita estiver DESABILITADA, desativa a conta.
// Se a versao gratuita estiver HABILITADA, apenas continua com anuncios.
useEffect(() => {
  if (!profissionalLogado || profissionalLogado.tipo === "super_admin") return;

  const verificarPlano = async () => {
    try {
      const { data } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "permitir_versao_gratuita_apos_expiracao")
        .maybeSingle();
      const versaoGratuitaAtual = data?.valor === "true";
      if (!planoExpirado(profissionalLogado)) return;

      if (!versaoGratuitaAtual) {
      // Desativa automaticamente porque a versao gratuita nao esta permitida.
      await supabase
        .from("profissionais")
        .update({ ativo: false })
        .eq("id", profissionalLogado.id);
      localStorage.removeItem("profissionalLogado");
      setTela("login");
      setMensagemLogin(
        "Seu plano expirou e a versão gratuita está desativada. Entre em contato com o administrador."
      );
      return;
    }
    // Versao gratuita habilitada: apenas continua com anuncios, nada a fazer.
    } catch (e) {
      console.error("Falha ao verificar plano:", e);
    }
  };

  verificarPlano();
  const intervalo = setInterval(verificarPlano, 60 * 1000);
  return () => clearInterval(intervalo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [profissionalLogado, tela, versaoGratuitaHabilitada]);

useEffect(() => {

async function carregarProfissionalCliente(){

if(!profissionalCliente) return;


const { data, error } = await supabase
.from("profissionais")
.select(COLUNAS_PERFIL)
.eq("id", profissionalCliente)
.maybeSingle();


if(error){
console.error(error);
setCarregandoPerfil(false);
// Falha de permissão/rede (pós-blindagem): não derruba a tela do cliente.
return;
}
if (!data) {
  setCarregandoPerfil(false);
  alert("Este profissional está indisponível.");
  // Nao derruba o login do profissional que esta logado.
  if (!profissionalLogado) setTela("login");
  return;
}
if (!data.ativo) {
  setCarregandoPerfil(false);
  alert("Este profissional está indisponível.");
  if (!profissionalLogado) setTela("login");
  return;
}

setDadosProfissionalCliente(data);
setCarregandoPerfil(false);

setStatusAtendimento(
  data.status_atendimento || "Aberto"
);

console.log("TEMA DO PROFISSIONAL:", data.tema);

}


carregarProfissionalCliente();


}, [profissionalCliente, tela]);

useEffect(() => {
if (profissionalLogado?.tema) {
  setTemaSelecionado(profissionalLogado.tema);
}
// Expõe o id para o modo de compatibilidade (banco antigo sem token).
try {
  if (profissionalLogado?.id) window.__profissionalLogadoId = profissionalLogado.id;
  else delete window.__profissionalLogadoId;
} catch { /* ignora */ }
}, [profissionalLogado]);

useEffect(() => {

  async function carregarPedidos() {


    const idProfissional = profissionalLogado?.id || profissionalCliente;


if (!profissionalLogado && !profissionalCliente) {
  console.log("SEM PROFISSIONAL AINDA");
  return;
}

    let resultado;
    try {
      resultado = profissionalLogado
        ? await ag.listar()
        : await ag.listarPublico(profissionalCliente);
    } catch (error) {
      console.error(error);
      if (profissionalLogado && ag.erroSessaoInvalida(error)) {
        const msg = String(error?.message || "").toLowerCase();
        const ehRede =
          msg.includes("network") ||
          msg.includes("fetch") ||
          msg.includes("failed") ||
          msg.includes("timeout") ||
          !navigator.onLine;
        if (!ehRede) {
          localStorage.removeItem("profissionalLogado");
          ag.setToken(null);
          setProfissionalLogado(null);
          setTela("login");
          setMensagemLogin("Sua sessão expirou. Entre novamente.");
        }
        // Se for só falha de rede, mantém a sessão salva e tenta de novo depois.
      }
      return;
    }


    setPedidos(resultado)

  }


  carregarPedidos();


}, [tela, profissionalLogado, profissionalCliente, pedido]);

// Mantém os agendamentos (e os contadores "Hoje" / "Ativos") atualizados
// em tempo real quando um cliente agenda, mesmo estando em outro navegador.
// Usa o realtime do Supabase e, como garantia, recarrega a cada 20s.
useEffect(() => {
  const idProfissional = profissionalLogado?.id;
  if (!idProfissional) return;

  let canal = null;
  let intervalo = null;

  // Reinicia o controle de "já vistos" para este profissional,
  // evitando notificar agendamentos antigos a cada novo login.
  primeiraCargaRef.current = true;
  pedidosVistosRef.current = new Set();

  const atualizarPedidos = async () => {
    let resultado;
    try {
      resultado = await ag.listar();
    } catch (error) {
      console.error(error);
      if (profissionalLogado && ag.erroSessaoInvalida(error) && navigator.onLine !== false) {
        const msg = String(error?.message || "").toLowerCase();
        const ehRede =
          msg.includes("network") ||
          msg.includes("fetch") ||
          msg.includes("failed") ||
          msg.includes("timeout");
        if (!ehRede) {
          localStorage.removeItem("profissionalLogado");
          ag.setToken(null);
          setProfissionalLogado(null);
          setTela("login");
          setMensagemLogin("Sua sessão expirou. Entre novamente.");
        }
      }
      return;
    }

    if (Array.isArray(resultado)) {
      // Na primeira carga só guarda os agendamentos que já existem,
      // para não notificar os antigos quando o profissional entrar.
      if (primeiraCargaRef.current) {
        primeiraCargaRef.current = false;
      } else {
        const novos = resultado.filter(
          (p) =>
            (p.status === "Agendado" || p.status === "Pendente") &&
            !pedidosVistosRef.current.has(p.id)
        );

        if (novos.length > 0) {
          notificarAgendamentoRef.current?.(novos[0]);
        }
      }

      pedidosVistosRef.current = new Set(resultado.map((p) => p.id));
      setPedidos(resultado);
    }
  };

  const processarEventoAgendamento = (payload) => {
    // Mantido apenas para compatibilidade: com RLS ligado, o Realtime não
    // recebe mais eventos desta tabela. A sincronização é por polling.
    atualizarPedidos();
  };
  void processarEventoAgendamento;

  // Sincronização imediata: os agendamentos que já existem entram na lista
  // de "já vistos" e não disparam notificação.
  atualizarPedidos();

  // OBS: com o RLS ligado em `agendamentos`, o canal Realtime (postgres_changes)
  // deixa de receber eventos da tabela para a chave pública. A sincronização
  // passa a ser feita pelo polling abaixo (a cada 20s), que continua funcionando.

  intervalo = setInterval(atualizarPedidos, 20000);

  return () => {
    if (canal) supabase.removeChannel(canal);
    if (intervalo) clearInterval(intervalo);
  };
}, [profissionalLogado]);

// Carga a preferência do saldo de trabalhos guardada neste dispositivo.
useEffect(() => {
  if (profissionalLogado?.id) {
    setSaldoHabilitado(
      localStorage.getItem(`saldo_habilitado_${profissionalLogado.id}`) === "1"
    );
    const dataInicioSalva = localStorage.getItem(
      `saldo_data_inicio_${profissionalLogado.id}`
    );
    if (dataInicioSalva) {
      setInicioSaldoPersonalizado(dataInicioSalva);
    }
  }
}, [profissionalLogado]);

useEffect(() => {
  async function carregarServicos() {
    const { data: resultado, error } = await supabase
      .from("servicos")
      .select("*")
      .order("nome");

    if (error) {
      console.error(error);
      return;
    }

    setServicos(resultado)
  }

  carregarServicos();
}, []);

useEffect(() => {

  async function carregarMeusServicos() {

    if (!profissionalLogado) return;


    const { data: resultado, error } = await supabase
      .from("servicos")
      .select("*")
      .eq("profissional_id", profissionalLogado.id)
      .order("id", { ascending: false });


    if (error) {
      console.error(error);
      return;
    }


   setMeusServicos(resultado);

  }


  carregarMeusServicos();

}, [profissionalLogado]);

// Carrega todas as promoções do banco (usadas pelo profissional e pelo cliente).
useEffect(() => {
  async function carregarPromocoes() {
    const { data, error } = await supabase
      .from("promocoes")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setPromocoes(data || []);
  }

  carregarPromocoes();
}, [tela]);

// Promoções do profissional logado (calculadas direto no render, sem estado).
const minhasPromocoes = profissionalLogado?.id
  ? promocoes.filter(
      (p) => Number(p.profissional_id) === Number(profissionalLogado.id)
    )
  : [];

// Promoções que o CLIENTE vê neste momento (seletor ativo pelo profissional
// + promoção ativa no mês/semana atuais + o serviço da promoção está ATIVO).
// O dia da semana é validado depois, contra a data escolhida no agendamento.
const promocoesParaCliente = promocoes.filter(
  (p) =>
    Number(p.profissional_id) === Number(profissionalCliente) &&
    dadosProfissionalCliente?.seletor_promocoes_habilitado !== false &&
    promocaoAtivaEm(p, undefined, { ignorarDiaSemana: true }) &&
    servicos.some(
      (s) =>
        Number(s.profissional_id) === Number(profissionalCliente) &&
        s.nome === p.servico &&
        s.ativo
    )
);

// Linhas do cliente que são serviços em promoção (para renderizar no bloco).
// Quando não existe nenhuma, o "seletor abaixo do seletor normal" é mostrado
// como um `<select>` placeholder (a primeira escolha já adiciona a linha).
const linhasPromoCliente = itensCliente.filter((item) => item.em_promocao);
const dataStatusPerfilCliente =
  itensCliente.find((item) => item.data)?.data ||
  new Date().toLocaleDateString("sv-SE");
const statusPerfilClienteFechado =
  !statusAtendimentoAberto(statusAtendimento) ||
  (profissionalDiasFolgaClienteCarregados === profissionalCliente &&
    (diasFolgaCliente.includes(diaSemanaDaData(dataStatusPerfilCliente)) ||
      folgasDatasCliente.includes(dataStatusPerfilCliente)));

// Promoções que o PROFESSIONAL pode usar no formulário "Agendar por um cliente"
// (mesmas regras do cliente: seletor habilitado + promoção ativa no mês/semana
// + o serviço da promoção está ATIVO).
const promocoesParaAgendarCliente = profissionalLogado?.id
  ? promocoes.filter(
      (p) =>
        Number(p.profissional_id) === Number(profissionalLogado.id) &&
        dadosProfissionalCliente?.seletor_promocoes_habilitado !== false &&
        promocaoAtivaEm(p, undefined, { ignorarDiaSemana: true }) &&
        meusServicos.some((s) => s.nome === p.servico && s.ativo)
    )
  : [];

// Linhas do formulário "Agendar por un cliente" que são serviços em promoção.
const linhasPromoAgendarCliente = itensAgendarCliente.filter(
  (item) => item.em_promocao
);

console.log("PEDIDOS DETALHADOS:", pedidos);
async function carregarHorariosTrabalho(){

  if(!profissionalLogado) return;


  const { data: resultado, error } = await supabase
    .from("horarios_trabalho")
    .select("*")
    .eq("profissional_id", profissionalLogado.id)
    .eq("dia_semana", diaSelecionado);


  if(error){
    console.error(error);
    return;
  }


setHorariosTrabalho(
  resultado
    .filter((item) => item.horario !== "FOLGA")
    .map((item) => item.horario)
);

}
useEffect(() => {

  if(profissionalLogado){
    carregarHorariosTrabalho();
  }

}, [diaSelecionado, profissionalLogado]);
const dataSelecionadaFormatada = dataSelecionada
  .toLocaleDateString("sv-SE");

const pedidosDoDia = pedidos.filter(
  (pedido) => pedido.data === dataSelecionadaFormatada
);

// Dias que possuem agendamento ativo, ordenados do mais próximo ao mais distante.
const diasAgendados = [...new Set(
  pedidos
    .filter((pedido) => pedido.status === "Agendado")
    .map((pedido) => pedido.data)
)].sort();

// Saldo de trabalhos concluídos (diário / semanal / quinzenal / mensal).
const diasPeriodoSaldo = {
  diario: 0,
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};
const hojeSaldo = new Date();
const hojeSaldoString = hojeSaldo.toLocaleDateString("sv-SE");
const limiteSaldoDate = new Date();
const diasSaldo = diasPeriodoSaldo[periodoSaldo] ?? 30;
limiteSaldoDate.setDate(limiteSaldoDate.getDate() - diasSaldo);
const limiteSaldoString = limiteSaldoDate.toLocaleDateString("sv-SE");
const inicioPeriodoSaldo =
  periodoSaldo === "personalizado"
    ? inicioSaldoPersonalizado
    : limiteSaldoString;
const fimPeriodoSaldo = hojeSaldoString;

// Datas de conclusão guardadas localmente neste navegador.
// São usadas enquanto a coluna `dataconcluido` ainda não existe no banco,
// para o saldo contar um trabalho marcado como concluído sempre no dia em
// que ele foi FINALIZADO (e não no dia em que foi agendado).
function pegarDatasConclusaoLocais() {
  try {
    const bruto = JSON.parse(
      localStorage.getItem("datas_conclusao_agendamentos") || "{}"
    );
    return typeof bruto === "object" && bruto !== null ? bruto : {};
  } catch {
    return {};
  }
}
const datasConclusaoLocais = pegarDatasConclusaoLocais();

const trabalhosConcluidos = pedidos
  .filter((pedido) => {
    if (pedido.status !== "Concluído") return false;
    // Conta pelo dia EM QUE O TRABALHO FOI FINALIZADO (dataconcluido).
    // Preferência: coluna no banco → data local deste navegador → dia agendado.
    const dataConcluido =
      pedido.dataconcluido || datasConclusaoLocais[pedido.id] || pedido.data;
    return (
      inicioPeriodoSaldo <= fimPeriodoSaldo &&
      dataConcluido >= inicioPeriodoSaldo &&
      dataConcluido <= fimPeriodoSaldo
    );
  })
  .reduce((soma, pedido) => soma + (Number(pedido.valor_servico) || 0), 0);

function formatarDiaAgendado(dia) {
  const d = new Date(dia + "T00:00:00");
  const nomesDias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  return `${nomesDias[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatarDataCompleta(dia) {
  const d = new Date(dia + "T00:00:00");
  return `${formatarDiaAgendado(dia)}/${d.getFullYear()}`;
}

// Exibe uma data no formato brasileiro: DD/MM/AAAA (ex.: 11/12/2026).
// Não altera o valor original (o banco guarda AAAA-MM-DD).
function formatarDataBR(dia) {
  if (!dia) return "";
  const [ano, mes, diaNum] = String(dia).split("-");
  if (!ano || !mes || !diaNum) return String(dia);
  return `${diaNum}/${mes}/${ano}`;
}

// Abre o WhatsApp com a mensagem de lembrete prontinha para o cliente.
// Sem custo e sem API: o profissional só toca em "enviar" no WhatsApp.
function abrirLembreteWa(pedido, onEnviado) {
  const numero = String(pedido.whatsapp || "").replace(/\D/g, "");
  if (numero.length < 10) {
    alert("Número de WhatsApp do cliente inválido.");
    return;
  }
  const mensagem =
    `Olá, ${pedido.nome}! 👋🏻 Passando para lembrar do seu agendamento:\n\n` +
    `📅 ${formatarDataBR(pedido.data)} às ⏰ ${pedido.horario}\n` +
    `✅ ${pedido.servico}\n\n` +
    `Qualquer dúvida é só chamar! 😉`;
  window.open(
    `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`,
    "_blank",
    "noopener,noreferrer"
  );
  if (typeof onEnviado === "function") {
    onEnviado(pedido);
  }
}

if (carregandoPerfil) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <p style={{ color: "#555" }}>Carregando…</p>
    </div>
  );
}

// Busca os profissionais no banco.
// Se a versao gratuita estiver DESABILITADA, profissionais com plano vencido
// sao automaticamente DESATIVADOS (ativo = false).
// Se estiver HABILITADA, eles continuam ativos na versao gratuita (com anuncios).
async function carregarProfissionaisAdmin() {
  const { data, error } = await supabase.from("profissionais").select(COLUNAS_PERFIL);
  if (error) console.error("Erro ao carregar profissionais:", error);
  if (!data) return;

  const expirados = data.filter(
    (p) =>
      p.tipo !== "super_admin" &&
      !ehPlanoIlimitado(p) &&
      validadePlanoMs(p) != null &&
      validadePlanoMs(p) <= Date.now()
  );

  if (expirados.length > 0) {
    if (versaoGratuitaHabilitada) {
      // Reativa automaticamente para versao gratuita com anuncios.
      const { error: erroReativar } = await supabase
        .from("profissionais")
        .update({ ativo: true })
        .in("id", expirados.map((p) => p.id));
      if (erroReativar) console.error("Erro ao reativar planos expirados:", erroReativar);
    } else {
      // Versao gratuita desabilitada: desativa profissionais com plano vencido.
      const { error: erroDesativar } = await supabase
        .from("profissionais")
        .update({ ativo: false })
        .in("id", expirados.map((p) => p.id));
      if (erroDesativar) console.error("Erro ao desativar planos expirados:", erroDesativar);
    }

    const { data: atualizado } = await supabase.from("profissionais").select(COLUNAS_PERFIL);
    setProfissionais(atualizado || data);
    return;
  }

  setProfissionais(data);
}

// Adiciona dias de uso ao plano (renova a partir de hoje se já expirou) e
// reativa a conta automaticamente.
async function adicionarDiasPlano(profissional, dias) {
  if (profissional.tipo === "super_admin") return;

  const quantidade = Math.floor(Number(dias));
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    alert("Digite uma quantidade de dias válida (número inteiro maior que 0).");
    return;
  }

  let base = validadePlanoMs(profissional);
  if (base == null || base < Date.now()) base = Date.now();
  const novaValidade = new Date(base + quantidade * MS_DIA).toISOString();

  const { error } = await supabase
    .from("profissionais")
    .update({ validade_plano: novaValidade, plano_ilimitado: false, ativo: true })
    .eq("id", profissional.id);

  if (error) {
    console.error(error);
    alert("Erro ao adicionar dias ao plano: " + error.message);
    return;
  }

  alert(`✅ ${quantidade} dia(s) de uso adicionado(s)! O profissional foi reativado.`);
  await carregarProfissionaisAdmin();
}

// Remove dias de uso do plano. Se o prazo zerar, a conta é desativada na hora.
async function removerDiasPlano(profissional, dias) {
  if (profissional.tipo === "super_admin") return;

  const quantidade = Math.floor(Number(dias));
  if (!Number.isFinite(quantidade) || quantidade < 1) {
    alert("Digite uma quantidade de dias válida (número inteiro maior que 0).");
    return;
  }

  // Parte do prazo atual; se não houver validade, conta a partir de hoje.
  let base = validadePlanoMs(profissional);
  if (base == null) base = Date.now();
  const novaValidade = base - quantidade * MS_DIA;

  const { error } = await supabase
    .from("profissionais")
    .update({
      validade_plano: new Date(novaValidade).toISOString(),
      plano_ilimitado: false,
      // Se o prazo zerou (ou passou), desativa automaticamente.
      ativo: novaValidade > Date.now(),
    })
    .eq("id", profissional.id);

  if (error) {
    console.error(error);
    alert("Erro ao remover dias do plano: " + error.message);
    return;
  }

  if (novaValidade > Date.now()) {
    alert(`✅ ${quantidade} dia(s) removido(s) do plano.`);
  } else {
    alert(
      `⚠️ ${quantidade} dia(s) removido(s). O prazo zerou e a conta foi desativada automaticamente. Adicione dias para reativar.`
    );
  }
  await carregarProfissionaisAdmin();
}

// Torna o plano permanente (nunca expira) e reativa a conta.
async function ativarPlanoIlimitado(profissional) {
  if (profissional.tipo === "super_admin") return;

  const { error } = await supabase
    .from("profissionais")
    .update({ plano_ilimitado: true, ativo: true })
    .eq("id", profissional.id);

  if (error) {
    console.error(error);
    alert("Erro ao ativar o plano permanente: " + error.message);
    return;
  }

  alert("✅ Plano permanente ativado! O profissional nunca mais será desativado por validade.");
  await carregarProfissionaisAdmin();
}

// Remove o plano permanente. Como o profissional volta a ter prazo, define
// uma nova validade de 30 dias a partir de hoje.
async function removerPlanoIlimitado(profissional) {
  if (profissional.tipo === "super_admin") return;

  const novaValidade = new Date(Date.now() + DIAS_PADRAO_PLANO * MS_DIA).toISOString();

  const { error } = await supabase
    .from("profissionais")
    .update({ plano_ilimitado: false, validade_plano: novaValidade, ativo: true })
    .eq("id", profissional.id);

  if (error) {
    console.error(error);
    alert("Erro ao remover o plano permanente: " + error.message);
    return;
  }

  alert(`✅ Plano permanente removido. O plano agora vence em ${DIAS_PADRAO_PLANO} dias.`);
  await carregarProfissionaisAdmin();
}

async function alternarAtivoProfissional(profissional) {

  if (profissional.tipo === "super_admin") {
    alert("O administrador não pode ser desativado.");
    return;
  }

  // Ao tentar ativar manualmente um profissional com plano expirado, pede
  // para renovar o plano em vez de deixar a conta sem cobertura.
  if (!profissional.ativo && planoExpirado(profissional)) {
    alert("O plano deste profissional está expirado. Adicione dias ou torne o plano permanente para ativá-lo.");
    return;
  }

  const { error } = await supabase
    .from("profissionais")
    .update({
      ativo: !profissional.ativo
    })
    .eq("id", profissional.id);

  if (error) {
    console.error(error);
    alert("Erro ao alterar o status do profissional: " + error.message);
    return;
  }

  const { data } = await supabase
    .from("profissionais")
    .select(COLUNAS_PERFIL);

  if (data) setProfissionais(data);

}

// Remarca (reagenda) um cliente para um novo dia e/ou horário.
async function salvarReagendamento() {
  if (!reagendandoPedido) return;

  setMensagemReagendamento("");
  setTipoMensagemReagendamento("");

  if (!novaDataReagendamento || !novoHorarioReagendamento) {
    setMensagemReagendamento("Escolha o novo dia e horário.");
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Cliente não mudou de dia nem de horário.
  if (
    novaDataReagendamento === reagendandoPedido.data &&
    novoHorarioReagendamento === reagendandoPedido.horario
  ) {
    setMensagemReagendamento("Este cliente já está neste dia e horário.");
    setTipoMensagemReagendamento("erro");
    return;
  }

  const hojeData = new Date();

  const hoje =
    hojeData.getFullYear() +
    "-" +
    String(hojeData.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(hojeData.getDate()).padStart(2, "0");

  if (novaDataReagendamento < hoje) {
    setMensagemReagendamento(
      "Não é possível reagendar para uma data que já passou."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Não permite reagendar para um dia de folga.
  const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);
  if (diasFolgaDoProfissional.includes(diaSemanaDaData(novaDataReagendamento))) {
    setMensagemReagendamento(
      "Este dia é folga. Escolha outra data para reagendar."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Também não permite reagendar para uma data específica de folga.
  const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalLogado.id);
  if (folgasDatasDoProfissional.includes(novaDataReagendamento)) {
    setMensagemReagendamento(
      "Este dia é folga. Escolha outra data para reagendar."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  const agora = new Date();

  const dataHoraEscolhida = new Date(
    `${novaDataReagendamento}T${novoHorarioReagendamento}:00`
  );

  if (dataHoraEscolhida < agora) {
    setMensagemReagendamento("Esse horário já passou.");
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Regra de duración: o novo horário ocupa [inicio, inicio + duração) do serviço.
  const inicioReagendado = horarioAMinutos(novoHorarioReagendamento);
  const duracionReagendada =
    Math.round(
      duracaoHorasDeServicio(
        reagendandoPedido.servico,
        meusServicos,
        profissionalLogado.id
      ) * 60
    ) || 60;
  const finReagendado = inicioReagendado + duracionReagendada;

  // Confere se o novo dia/horário já está ocupado por outro agendamento ativo.
  let agendamentosDia;
  try {
    agendamentosDia = await ag.listar();
  } catch (erroBusca) {
    console.error(erroBusca);
    setMensagemReagendamento(
      "Ocorreu um erro ao conferir o horário. Tente novamente."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }
  agendamentosDia = (agendamentosDia || []).filter(
    (existente) =>
      existente.data === novaDataReagendamento &&
      existente.status === "Agendado" &&
      existente.id !== reagendandoPedido.id
  );

  const ocupadoReagendamento = (agendamentosDia || []).some((existente) => {
    if (existente.horario_liberado === true) return false;
    const inicioExistente = horarioAMinutos(existente.horario);
    if (inicioExistente < 0) return false;
    const duracionExistente =
      Math.round(
        duracaoHorasDeServicio(
          existente.servico,
          meusServicos,
          profissionalLogado.id
        ) * 60
      ) || 60;
    return franjasSolapan(
      inicioReagendado,
      finReagendado,
      inicioExistente,
      inicioExistente + duracionExistente
    );
  });

  if (ocupadoReagendamento) {
    setMensagemReagendamento(
      "Esse dia e horário já estão ocupados por outro agendamento. Escolha outro."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  try {
    await ag.atualizar(reagendandoPedido.id, {
      data: novaDataReagendamento,
      horario: novoHorarioReagendamento,
    });
  } catch (error) {
    if (ag.erroHorarioOcupado(error)) {
      setMensagemReagendamento(
        "Esse horário acabou de ser reservado por outra pessoa. Escolha outro."
      );
      setTipoMensagemReagendamento("erro");
      return;
    }

    console.error(error);
    setMensagemReagendamento("Ocorreu um erro ao reagendar. Tente novamente.");
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Recarrega a agenda com os dados atualizados.
  try {
    const recarga = await ag.listar();
    setPedidos(recarga);
  } catch (erroRecarga) {
    console.error(erroRecarga);
  }

  setMensagemProfissional(
    `${reagendandoPedido.nome} remarcado(a) para ${formatarDataCompleta(novaDataReagendamento)} às ${novoHorarioReagendamento}!`
  );
  setMensagemErroProfissional("");

  setReagendandoPedido(null);
  setNovaDataReagendamento("");
  setNovoHorarioReagendamento("");
  setHorariosReagendamento([]);
  setMensagemReagendamento("");
  setTipoMensagemReagendamento("");
}

// ---------------- Linhas de serviço (tela do CLIENTE) ----------------
function atualizarLinhaCliente(indice, campo, valor) {
  setItensCliente((prev) =>
    prev.map((item, i) => {
      if (i !== indice) return item;
      const atualizado = { ...item, [campo]: valor };
      if (campo === "data" || campo === "servico") {
        atualizado.horario = "";
      }
      if (campo === "servico") {
        const servicoEncontrado = servicos.find(
          (s) =>
            s.nome === valor &&
            s.profissional_id === profissionalCliente &&
            s.ativo
        );
        atualizado.valor = servicoEncontrado?.valor || 0;
        atualizado.promo_id = null;
        if (item.em_promocao) {
          // Linha do seletor de promoções: usa o valor (e a duração) da promoção.
          const promo = promocoesParaCliente.find((p) => p.servico === valor);
          if (promo) {
            atualizado.valor = promo.valor || 0;
            atualizado.promo_id = promo.id;
          } else {
            atualizado.promo_id = null;
          }
        }
      }
      return atualizado;
    })
  );
}

function adicionarLinhaCliente() {
  setItensCliente((prev) => [...prev, novoItemCliente()]);
}

function removerLinhaCliente(indice) {
  setItensCliente((prev) =>
    prev.length > 1 ? prev.filter((_, i) => i !== indice) : prev
  );
}

// Linhas do seletor de SERVIÇOS EM PROMOÇÃO (a linha inicial de promoção
// só aparece quando o profissional tem promoções ativas).
function adicionarLinhaPromoCliente() {
  setItensCliente((prev) => [
    ...prev,
    { ...novoItemCliente(), em_promocao: true },
  ]);
}

// Usada pelo seletor placeholder: escolheu o serviço? Já cria a linha
// completa da promoção (com valor e promo_id corretos).
function adicionarLinhaPromoClienteComServico(valor) {
  setItensCliente((prev) => {
    const promo = promocoesParaCliente.find((p) => p.servico === valor);
    return [
      ...prev,
      {
        ...novoItemCliente(),
        em_promocao: true,
        servico: valor,
        valor: promo?.valor || 0,
        promo_id: promo?.id || null,
      },
    ];
  });
}

function removerLinhaPromoCliente(indice) {
  setItensCliente((prev) => prev.filter((_, i) => i !== indice));
}

// ---------------- Promoções (painel do PROFISSIONAL) ----------------
// Ativa/desativa o seletor de promoções inteiro (some da tela do cliente).
async function alternarSeletorPromocoes() {
  if (!profissionalLogado?.id) return;
  const atual = profissionalLogado.seletor_promocoes_habilitado !== false;
  const novo = !atual;

  try {
    await cat.promoSeletor(novo);
  } catch (error) {
    console.error(error);
    alert("Erro ao salvar o seletor de promoções: " + msgErroCatalogo(error));
    return;
  }
  setProfissionalLogado((prev) => ({
    ...prev,
    seletor_promocoes_habilitado: novo,
  }));
  setMensagemPromo(
    novo
      ? "🎉 Seletor de promoções ATIVADO — os clientes verão o seletor de serviços em promoção."
      : "🚫 Seletor de promoções DESATIVADO — os clientes não verão as promoções."
  );
  setMensagemPromoTipo("sucesso");
}

// Botão 💲 no card do serviço: coloca/remove o serviço no seletor de promoções.
async function alternarPromocaoDoServico(servico) {
  if (!profissionalLogado) return;
  const existente = minhasPromocoes.find((p) => p.servico === servico.nome);

  if (existente) {
    if (!window.confirm(`Remover "${servico.nome}" das promoções?`)) return;
    try {
      await cat.promoExcluir(existente.id);
    } catch (error) {
      console.error(error);
      alert("Erro ao remover: " + msgErroCatalogo(error));
      return;
    }

    setPromocoes((prev) => prev.filter((p) => Number(p.id) !== Number(existente.id)));
    setMensagemPromo(`"${servico.nome}" saiu das promoções.`);
    setMensagemPromoTipo("sucesso");
    return;
  }

  let criada;
  try {
    criada = await cat.promoCriar({
      servico: servico.nome,
      valor: servico.valor || 0,
      duracao: servico.duracao || "",
    });
  } catch (error) {
    console.error(error);
    alert("Erro ao adicionar: " + msgErroCatalogo(error));
    return;
  }

  setPromocoes((prev) => [criada, ...prev]);
  setMensagemPromo(
    `💲 "${servico.nome}" entrou no seletor de promoções. Configure os meses, valor e duração abaixo.`
  );
  setMensagemPromoTipo("sucesso");
}

function iniciarEdicaoPromocao(promo) {
  setPromoEditandoId(promo.id);
  setPromoEditValor(
    promo.valor === null || promo.valor === undefined
      ? ""
      : String(promo.valor)
  );
  setPromoEditDuracao(String(promo.duracao || ""));
  const mesesObj = {};
  (promo.meses || []).forEach((m) => (mesesObj[Number(m)] = true));
  setPromoEditMeses(mesesObj);
  setPromoEditSemanas({ ...(promo.semanas || {}) });
  // Dias da semana: sem valor salvo = todos marcados (vale todos os dias).
  const diasObj = {};
  const diasSalvos = Array.isArray(promo.dias_semana)
    ? promo.dias_semana.map(Number)
    : [];
  (diasSalvos.length > 0 ? diasSalvos : [0, 1, 2, 3, 4, 5, 6]).forEach(
    (d) => (diasObj[Number(d)] = true)
  );
  setPromoEditDias(diasObj);
  setPromoEditAtivo(promo.ativo !== false);
  setMensagemPromo("");
}

function cancelarEdicaoPromocao() {
  setPromoEditandoId(null);
  setMensagemPromo("");
}

function alternarMesPromo(mes) {
  const marcado = !promoEditMeses[mes];
  setPromoEditMeses((prev) => ({ ...prev, [mes]: marcado }));
  if (!marcado) {
    setPromoEditSemanas((prev) => {
      const novo = { ...prev };
      delete novo[String(mes)];
      return novo;
    });
  }
}

function alternarSemanaPromo(mes, semana) {
  setPromoEditSemanas((prev) => {
    const atual = Array.isArray(prev[String(mes)])
      ? prev[String(mes)]
      : [true, true, true, true, true];
    const novo = [...atual];
    novo[semana - 1] = !(novo[semana - 1] !== false);
    return { ...prev, [String(mes)]: novo };
  });
}

function alternarDiaPromo(dia) {
  setPromoEditDias((prev) => ({ ...prev, [dia]: !prev[dia] }));
}

// Aplica os MESES/SEMANAS/DIAS que estão sendo editados para TODAS as outras
// promoções do profissional de uma vez (evita ter que configurar uma por uma).
// Valor e duração de cada produto NÃO são copiados — cada serviço mantém o seu.
async function aplicarAgendaParaTodasPromocoes() {
  if (!profissionalLogado || promoEditandoId == null) return;

  const outras = minhasPromocoes.filter(
    (p) => Number(p.id) !== Number(promoEditandoId)
  );
  if (outras.length === 0) {
    alert("Não há outras promoções para aplicar.");
    return;
  }

  if (
    !window.confirm(
      `Aplicar os MESES, SEMANAS e DIAS desta promoção para as outras ${outras.length} promoções?\n\nSó os períodos (meses/semanas/dias) serão copiados. Valor e duração de cada produto continuam os mesmos.`
    )
  )
    return;

  const meses = Object.keys(promoEditMeses)
    .filter((m) => promoEditMeses[m])
    .map(Number);
  const semanas = {};
  Object.keys(promoEditSemanas).forEach((mes) => {
    if (promoEditMeses[Number(mes)]) semanas[mes] = promoEditSemanas[mes];
  });
  // Dias da semana permitidos. Ninguém marcado ou todos marcados = [] = todos.
  const diasMarcados = Object.keys(promoEditDias)
    .filter((d) => promoEditDias[d])
    .map(Number);
  const diasSemana = diasMarcados.length >= 7 ? [] : diasMarcados;

  const ids = outras.map((p) => p.id);

  // Salva meses/semanas/dias via RPC (a coluna dias_semana é garantida pelo
  // _blindagem_servicos_promocoes.sql).
  try {
    await cat.promoAtualizarVarios(ids, {
      meses,
      semanas,
      dias_semana: diasSemana,
    });
  } catch (error) {
    console.error(error);
    alert("Erro ao aplicar: " + msgErroCatalogo(error));
    return;
  }

  setPromocoes((prev) =>
    prev.map((p) =>
      ids.some((id) => Number(id) === Number(p.id))
        ? { ...p, meses, semanas, dias_semana: diasSemana }
        : p
    )
  );

  setMensagemPromo(
    `📋 Meses, semanas e dias aplicados para as outras ${outras.length} promoções!`
  );
  setMensagemPromoTipo("sucesso");
}

async function salvarPromocao() {
  if (!profissionalLogado || promoEditandoId == null) return;
  const promo = minhasPromocoes.find(
    (p) => Number(p.id) === Number(promoEditandoId)
  );
  if (!promo) return;

  const meses = Object.keys(promoEditMeses)
    .filter((m) => promoEditMeses[m])
    .map(Number);
  const semanas = {};
  Object.keys(promoEditSemanas).forEach((mes) => {
    if (promoEditMeses[Number(mes)]) semanas[mes] = promoEditSemanas[mes];
  });

  // Dias da semana permitidos. Ninguém marcado ou todos marcados = [] = todos.
  const diasMarcados = Object.keys(promoEditDias)
    .filter((d) => promoEditDias[d])
    .map(Number);
  const diasSemana = diasMarcados.length >= 7 ? [] : diasMarcados;

  const dadosPromo = {
    valor: promoEditValor || 0,
    duracao: promoEditDuracao,
    meses,
    semanas,
    ativo: promoEditAtivo,
    dias_semana: diasSemana,
  };

  // Salva via RPC (a coluna dias_semana é garantida pelo
  // _blindagem_servicos_promocoes.sql).
  try {
    await cat.promoAtualizar(promo.id, dadosPromo);
  } catch (error) {
    console.error(error);
    alert("Erro ao salvar: " + msgErroCatalogo(error));
    return;
  }

  setPromocoes((prev) =>
    prev.map((p) =>
      Number(p.id) === Number(promo.id) ? { ...p, ...dadosPromo } : p
    )
  );
  setPromoEditandoId(null);
  setMensagemPromo("💾 Promoção salva!");
  setMensagemPromoTipo("sucesso");
}

async function excluirPromocao(promo) {
  if (!window.confirm(`Excluir a promoção de "${promo.servico}"?`)) return;
  try {
    await cat.promoExcluir(promo.id);
  } catch (error) {
    console.error(error);
    alert("Erro ao excluir: " + msgErroCatalogo(error));
    return;
  }

  setPromocoes((prev) =>
    prev.filter((p) => Number(p.id) !== Number(promo.id))
  );
  setMensagemPromo(`Promoção de "${promo.servico}" excluída.`);
  setMensagemPromoTipo("sucesso");
}

// Botão🚫 Desativar / ▶ Ativar direto no card da promoção. Salva na hora no
// banco e o cliente deixa de ver (ou volta a ver) a promoção.
async function alternarAtivoPromocao(promo) {
  const novo = promo.ativo === false;
  try {
    await cat.promoAtualizar(promo.id, { ativo: novo });
  } catch (error) {
    console.error(error);
    alert("Erro ao alterar: " + msgErroCatalogo(error));
    return;
  }

  setPromocoes((prev) =>
    prev.map((p) =>
      Number(p.id) === Number(promo.id) ? { ...p, ativo: novo } : p
    )
  );
  setMensagemPromo(
    novo
      ? `💲 Promoção de "${promo.servico}" ATIVADA — o cliente volta a ver.`
      : `🚫 Promoção de "${promo.servico}" DESATIVADA — o cliente não vê mais.`
  );
  setMensagemPromoTipo("sucesso");
}

// ---------------- Enviar pedido (tela do CLIENTE) ----------------
async function enviarPedidoCliente() {
  setMensagem("");
  setTipoMensagem("");

  if (!nome || !whatsapp) {
    setMensagem("Preencha seu nome e WhatsApp.");
    setTipoMensagem("erro");
    return;
  }

  // Linhas vazias (sem serviço escolhido) são apenas placeholders do botão
  // "➕ Adicionar outro serviço" e são IGNORADAS na validação. Assim o cliente
  // consegue enviar o pedido usando SÓLO o seletor de "Serviços em promoção"
  // mesmo quando a linha da aba de serviços normais ficou vazia — essa linha
  // não precisa ser preenchida porque já está sendo usada a promoção.
  const linhasClienteConServicio = itensCliente.filter((item) => item.servico);

  if (linhasClienteConServicio.length === 0) {
    setMensagem("Escolha pelo menos um serviço.");
    setTipoMensagem("erro");
    return;
  }

  // Linhas NORMALES já escolhidas precisam também de data e horário.
  if (
    linhasClienteConServicio.some(
      (item) => !item.em_promocao && (!item.data || !item.horario)
    )
  ) {
    setMensagem("Preencha todos os campos de cada serviço.");
    setTipoMensagem("erro");
    return;
  }

  // Linhas de promoção escolhidas (com serviço) precisam de data e horário.
  if (
    linhasClienteConServicio.some(
      (item) => item.em_promocao && (!item.data || !item.horario)
    )
  ) {
    setMensagem("Preencha a data e o horário de cada serviço em promoção.");
    setTipoMensagem("erro");
    return;
  }

  // A data escolhida de uma promoção precisa cair num dia da semana permitido.
  for (const item of linhasClienteConServicio) {
    if (!item.em_promocao || !item.promo_id) continue;
    const promo = promocoes.find(
      (p) => Number(p.id) === Number(item.promo_id)
    );
    if (promo && !promocaoAtivaEm(promo, item.data)) {
      setMensagem(
        `📅 Esta promoção só vale em: ${diasDaPromocao(promo).join(
          ", "
        )}. Escolha uma data permitida.`
      );
      setTipoMensagem("erro");
      return;
    }
  }

  const numeroLimpo = whatsapp.replace(/\D/g, "");
  if (numeroLimpo.length !== 11) {
    setMensagem("Digite um WhatsApp válido com 11 números.");
    setTipoMensagem("erro");
    return;
  }

  const hojeData = new Date();
  const hoje =
    hojeData.getFullYear() +
    "-" +
    String(hojeData.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(hojeData.getDate()).padStart(2, "0");

  const diasFolgaDoProfissional = await buscarDiasFolga(profissionalCliente);
  const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalCliente);

  for (const item of itensCliente) {
    // Linhas de promoção vazias são ignoradas nas validações de data.
    if (!item.servico) continue;

    if (item.data < hoje) {
      setMensagem("Não é possível agendar uma data que já passou.");
      setTipoMensagem("erro");
      return;
    }
    if (
      diasFolgaDoProfissional.includes(diaSemanaDaData(item.data)) ||
      folgasDatasDoProfissional.includes(item.data)
    ) {
      setMensagem("Este dia é folga do profissional. Escolha outra data.");
      setTipoMensagem("erro");
      return;
    }
    if (new Date(`${item.data}T${item.horario}:00`) < new Date()) {
      setMensagem("Esse horário já passou.");
      setTipoMensagem("erro");
      return;
    }
  }

  // Regra de duración: cada linha ocupa de [horario, horario + duração do serviço).
  // Ex.: serviço de 2h às 13:00 ocupa 13:00 e 14:00 (até 15:00).
  // Promoções usam a DURAÇÃO da promoção, quando informada.
  const spanDeLinhaCliente = (item) => {
    if (!item.servico || !item.horario) return { inicio: -1, fin: -1 };
    const inicio = horarioAMinutos(item.horario);
    if (inicio < 0) return { inicio: -1, fin: -1 };
    const duracion =
      Math.round(
        duracaoHorasDeItem(item, servicos, profissionalCliente, promocoes) * 60
      ) || 60; // sem duração => ocupa pelo menos sua franja de 1h
    return { inicio, fin: inicio + duracion };
  };

  // Dois serviços não podem ocupar franjas que se cruzan no mesmo dia.
  for (let a = 0; a < itensCliente.length; a++) {
    for (let b = a + 1; b < itensCliente.length; b++) {
      const itemA = itensCliente[a];
      const itemB = itensCliente[b];
      if (itemA.data !== itemB.data) continue;
      const spanA = spanDeLinhaCliente(itemA);
      if (spanA.inicio < 0) continue;
      const spanB = spanDeLinhaCliente(itemB);
      if (spanB.inicio < 0) continue;
      if (franjasSolapan(spanA.inicio, spanA.fin, spanB.inicio, spanB.fin)) {
        setMensagem(
          "Dois serviços não podem ficar no mesmo dia e horário. Escolha horários diferentes."
        );
        setTipoMensagem("erro");
        return;
      }
    }
  }

  const pedidosSalvos = [];
  const cacheAgendamentosDia = {};

  for (const item of itensCliente) {
    // Linhas de promoção vazias (sem serviço escolhido) são ignoradas.
    if (!item.servico || !item.horario) continue;

    const spanNuevo = spanDeLinhaCliente(item);

    // Busca uma única vez todos os agendamentos ativos do mesmo dia e depois
    // compara usando a REGRA DE DURACIÓN (cruza o intervalo ocupado pelo outro).
    if (!cacheAgendamentosDia[item.data]) {
      let agendamentosDia;
      try {
        agendamentosDia = await ag.listarPublico(profissionalCliente);
      } catch (erroBusca) {
        console.error(erroBusca);
        return;
      }

      cacheAgendamentosDia[item.data] = (agendamentosDia || []).filter(
        (existente) =>
          existente.data === item.data && existente.status === "Agendado"
      );
    }

    const ocupaExistente = (cacheAgendamentosDia[item.data] || []).some(
      (existente) => {
        if (existente.horario_liberado === true) return false;
        const inicioExistente = horarioAMinutos(existente.horario);
        if (inicioExistente < 0) return false;
        const duracionExistente =
          Math.round(
            duracaoHorasDeServicio(
              existente.servico,
              servicos,
              profissionalCliente
            ) * 60
          ) || 60;
        return franjasSolapan(
          spanNuevo.inicio,
          spanNuevo.fin,
          inicioExistente,
          inicioExistente + duracionExistente
        );
      }
    );

    if (ocupaExistente) {
      setMensagem("Esse horário já foi reservado. Escolha outro.");
      setTipoMensagem("erro");
      return;
    }

    let pedidoSalvo;
    try {
      pedidoSalvo = await ag.criarCliente({
        profissionalId: profissionalCliente,
        nome,
        whatsapp,
        servico: item.servico,
        valor: item.valor,
        data: item.data,
        horario: item.horario,
        status: precisaAprovacaoProfissional(
          item.data,
          dadosProfissionalCliente?.exigir_aprovacao_dezembro
        )
          ? "Pendente"
          : "Agendado",
      });
    } catch (error) {
      if (ag.erroHorarioOcupado(error)) {
        setMensagem("Esse horário acabou de ser reservado por outra pessoa.");
        setTipoMensagem("erro");
        return;
      }
      console.error(error);
      return;
    }

    pedidosSalvos.push(pedidoSalvo);
  }

  if (pedidosSalvos.length > 0) {
    setPedido(pedidosSalvos);
    const resultadosPush = await Promise.all(
      pedidosSalvos.map((agendamentoSalvo) =>
        supabase.functions.invoke("send-appointment-push", {
          body: { appointmentId: agendamentoSalvo.id },
        })
      )
    );
    const falhasPush = resultadosPush.filter((resultado) => resultado.error);
    if (falhasPush.length > 0) {
      falhasPush.forEach((resultado) =>
        console.error("Falha ao enviar push do novo agendamento:", resultado.error)
      );
      setMensagemNotificacaoSistema(
        "Agendamento salvo, mas não foi possível enviar o push. Confira a configuração do servidor."
      );
    }
  }

  setPedidos((prev) => [...prev, ...pedidosSalvos]);

  const algumPendente = pedidosSalvos.some(
    (p) => p.status === "Pendente"
  );

  setMensagem(
    algumPendente
      ? "📅 Dezembro: pedido enviado! Ele será confirmado após a aprovação do profissional."
      : ["cinza", "preto", "verde", "masculino"].includes(temaAtivo)
      ? "Agendamento realizado com sucesso! ✔️"
      : "Agendamento realizado com sucesso! ❤️"
  );
  setTipoMensagem("sucesso");
  setMensagemProfissional(algumPendente ? "Novo pedido de dezembro aguardando aprovação!" : "Novo pedido recebido!");
  setMensagemErroProfissional("");

  // O cliente acabou de agendar: mostra o anúncio intersticial (apenas quando
  // o profissional do link é do plano gratuito com anúncios).
  if (clienteVeAnuncios && pedidosSalvos.length > 0) {
    setMostrarAnuncioCliente(true);
  }

  setNome("");
  setWhatsapp("");
  setItensCliente([novoItemCliente()]);
}

// ---------------- Linhas de serviço (agendar por um CLIENTE) ----------------
function atualizarLinhaAgendarCliente(indice, campo, valor) {
  setItensAgendarCliente((prev) =>
    prev.map((item, i) => {
      if (i !== indice) return item;
      const atualizado = { ...item, [campo]: valor };
      if (campo === "data" || campo === "servico") {
        atualizado.horario = "";
      }
      if (campo === "servico") {
        const servicoEncontrado = meusServicos.find(
          (s) => s.nome === valor && s.ativo
        );
        atualizado.valor = servicoEncontrado?.valor || 0;
        atualizado.promo_id = null;
        if (item.em_promocao) {
          atualizado.frequencia = "mensal";
          atualizado.meses = 1;
          // Linha do seletor de promoções: usa o valor (e a duração) da promoção.
          const promo = promocoesParaAgendarCliente.find(
            (p) => p.servico === valor
          );
          if (promo) {
            atualizado.valor = promo.valor || 0;
            atualizado.promo_id = promo.id;
          } else {
            atualizado.promo_id = null;
          }
        }
      }
      return atualizado;
    })
  );
}

function adicionarLinhaAgendarCliente() {
  setItensAgendarCliente((prev) => [...prev, novoItemAgendarCliente()]);
}

function removerLinhaAgendarCliente(indice) {
  setItensAgendarCliente((prev) =>
    prev.length > 1 ? prev.filter((_, i) => i !== indice) : prev
  );
}

// Linhas do seletor de SERVIÇOS EM PROMOÇÃO (formulário "Agendar por um cliente").
function adicionarLinhaPromoAgendarCliente() {
  setItensAgendarCliente((prev) => [
    ...prev,
    { ...novoItemAgendarCliente(), em_promocao: true },
  ]);
}

// Usada pelo seletor placeholder: escolheu o serviço? Já cria a linha completa
// da promoção (com valor e promo_id corretos).
function adicionarLinhaPromoAgendarClienteComServico(valor) {
  setItensAgendarCliente((prev) => {
    const promo = promocoesParaAgendarCliente.find((p) => p.servico === valor);
    return [
      ...prev,
      {
        ...novoItemAgendarCliente(),
        em_promocao: true,
        servico: valor,
        valor: promo?.valor || 0,
        promo_id: promo?.id || null,
      },
    ];
  });
}

function removerLinhaPromoAgendarCliente(indice) {
  setItensAgendarCliente((prev) => prev.filter((_, i) => i !== indice));
}

// ---------------- Enviar pedido (formulário do PROFISSIONAL) ----------------
async function enviarPedidoAgendarCliente() {
  setMensagemAgendarCliente("");
  setTipoMensagemAgendarCliente("");

  if (!nome || !whatsapp) {
    setMensagemAgendarCliente("Preencha o nome e o WhatsApp do cliente.");
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  // Linhas vazias (sem serviço escolhido) são placeholders do botão
  // "➕ Adicionar outro serviço" — são ignoradas na validação.
  const linhasAgendarConServicio = itensAgendarCliente.filter(
    (item) => item.servico
  );

  if (linhasAgendarConServicio.length === 0) {
    setMensagemAgendarCliente("Escolha pelo menos um serviço.");
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  // Linhas NORMALES já escolhidas precisan também de data e horário.
  if (
    linhasAgendarConServicio.some(
      (item) => !item.em_promocao && (!item.data || !item.horario)
    )
  ) {
    setMensagemAgendarCliente("Preencha todos os campos de cada serviço.");
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  // Linhas de promoção escolhidas (com serviço) precisan de data e horário.
  if (
    linhasAgendarConServicio.some(
      (item) => item.em_promocao && (!item.data || !item.horario)
    )
  ) {
    setMensagemAgendarCliente(
      "Preencha a data e o horário de cada serviço em promoção."
    );
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  // A data escolhida de uma promoção precisa cair num dia da semana permitido.
  for (const item of linhasAgendarConServicio) {
    if (!item.em_promocao || !item.promo_id) continue;
    const promo = promocoes.find(
      (p) => Number(p.id) === Number(item.promo_id)
    );
    if (promo && !promocaoAtivaEm(promo, item.data)) {
      setMensagemAgendarCliente(
        `📅 Esta promoção só vale em: ${diasDaPromocao(promo).join(
          ", "
        )}. Escolha uma data permitida.`
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }
  }

  const numeroLimpo = whatsapp.replace(/\D/g, "");
  if (numeroLimpo.length !== 11) {
    setMensagemAgendarCliente("Digite um WhatsApp válido com 11 números.");
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  const hojeData = new Date();
  const hoje =
    hojeData.getFullYear() +
    "-" +
    String(hojeData.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(hojeData.getDate()).padStart(2, "0");

  const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);
  const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalLogado.id);

  for (const item of itensAgendarCliente) {
    // Linhas vazias (sem serviço) são placeholders "➕" e se ignoran nas datas.
    if (!item.servico) continue;

    if (item.data < hoje) {
      setMensagemAgendarCliente(
        "Não é possível agendar uma data que já passou."
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }
    if (
      diasFolgaDoProfissional.includes(diaSemanaDaData(item.data)) ||
      folgasDatasDoProfissional.includes(item.data)
    ) {
      setMensagemAgendarCliente(
        "Este dia é folga. Ninguém pode agendar nele. Escolha outra data."
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }
    if (new Date(`${item.data}T${item.horario}:00`) < new Date()) {
      setMensagemAgendarCliente("Esse horário já passou.");
      setTipoMensagemAgendarCliente("erro");
      return;
    }
  }

  // Regra de duración: cada linha ocupa de [horario, horario + duração do serviço).
  // Ex.: serviço de 2h às 13:00 ocupa 13:00 e 14:00 (até 15:00).
  const spanDeLinhaAgendar = (item) => {
    if (!item.servico || !item.horario) return { inicio: -1, fin: -1 };
    const inicio = horarioAMinutos(item.horario);
    if (inicio < 0) return { inicio: -1, fin: -1 };
    const duracion =
      Math.round(
        duracaoHorasDeItem(item, meusServicos, profissionalLogado.id, promocoes) *
          60
      ) || 60; // sem duração => ocupa pelo menos sua franja de 1h
    return { inicio, fin: inicio + duracion };
  };

  // Dois serviços não podem ocupar franjas que se cruzan no mesmo dia.
  for (let a = 0; a < itensAgendarCliente.length; a++) {
    for (let b = a + 1; b < itensAgendarCliente.length; b++) {
      const itemA = itensAgendarCliente[a];
      const itemB = itensAgendarCliente[b];
      if (itemA.data !== itemB.data) continue;
      const spanA = spanDeLinhaAgendar(itemA);
      if (spanA.inicio < 0) continue;
      const spanB = spanDeLinhaAgendar(itemB);
      if (spanB.inicio < 0) continue;
      if (franjasSolapan(spanA.inicio, spanA.fin, spanB.inicio, spanB.fin)) {
        setMensagemAgendarCliente(
          "Dois serviços não podem ficar no mesmo dia e horário. Escolha horários diferentes."
        );
        setTipoMensagemAgendarCliente("erro");
        return;
      }
    }
  }

  let totalCriados = 0;

  for (const item of itensAgendarCliente) {
    // Linhas vazias (sem serviço/horário) são placeholders "➕" e se ignoran.
    if (!item.servico || !item.horario) continue;

    const datasDaRecorrencia = item.em_promocao
      ? [item.data]
      : item.frequencia === "semanal"
      ? datasParaSemanas(item.data, item.meses)
      : datasParaMeses(item.data, item.meses);

    // Se alguma data da recorrência cai em folga (semana ou data específica),
    // bloqueia para não criar agendamento em dia de folga.
    const datasRecorrenciaComFolga = datasDaRecorrencia.filter(
      (dataAlvo) =>
        folgasDatasDoProfissional.includes(dataAlvo) ||
        diasFolgaDoProfissional.includes(diaSemanaDaData(dataAlvo))
    );
    if (datasRecorrenciaComFolga.length > 0) {
      setMensagemAgendarCliente(
        `Uma das datas da recorrência cai em dia de folga (${formatarDataCompleta(datasRecorrenciaComFolga[0])}). Ajuste a data ou a quantidade.`
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }

    const spanNuevo = spanDeLinhaAgendar(item);

    // Busca todos os agendamentos ativos da recorrência e compara usando a
    // REGRA DE DURACIÓN (cruza o intervalo ocupado pelo outro).
    let agendamentos;
    try {
      agendamentos = await ag.listar();
    } catch (erroBusca) {
      console.error(erroBusca);
      return;
    }
    agendamentos = (agendamentos || []).filter(
      (existente) =>
        datasDaRecorrencia.includes(existente.data) &&
        existente.status === "Agendado"
    );

    const conflito = (agendamentos || []).find((existente) => {
      if (!datasDaRecorrencia.includes(existente.data)) return false;
      if (existente.horario_liberado === true) return false;
      const inicioExistente = horarioAMinutos(existente.horario);
      if (inicioExistente < 0) return false;
      const duracionExistente =
        Math.round(
          duracaoHorasDeServicio(
            existente.servico,
            meusServicos,
            profissionalLogado.id
          ) * 60
        ) || 60;
      return franjasSolapan(
        spanNuevo.inicio,
        spanNuevo.fin,
        inicioExistente,
        inicioExistente + duracionExistente
      );
    });

    if (conflito) {
      setMensagemAgendarCliente(
        `Esse horário já está reservado em ${formatarDataCompleta(conflito.data)}. Escolha outro.`
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }

    const linhasAgendamento = datasDaRecorrencia.map((dataAlvo) => ({
      nome,
      whatsapp,
      servico: item.servico,
      valor_servico: item.valor,
      data: dataAlvo,
      horario: item.horario,
      status: "Agendado",
      horario_liberado: false,
      profissional_id: profissionalLogado.id,
    }));

    let pedidosCriados;
    try {
      pedidosCriados = await ag.criarProfissional(linhasAgendamento);
    } catch (error) {
      if (ag.erroHorarioOcupado(error)) {
        setMensagemAgendarCliente(
          "Esse horário acabou de ser reservado por outra pessoa."
        );
        setTipoMensagemAgendarCliente("erro");
        return;
      }
      console.error(error);
      return;
    }

    totalCriados += pedidosCriados?.length || 0;
  }

  try {
    const recarga = await ag.listar();
    setPedidos(recarga);
  } catch (erroRecarga) {
    console.error(erroRecarga);
  }

  setMensagemAgendarCliente(
    `Agendamento realizado com sucesso! ✔️ ${totalCriados} agendamento(s) criado(s).`
  );
  setTipoMensagemAgendarCliente("sucesso");

  // O profissional está na versão gratuita (com anúncios) => mostrar o
  // anúncio intersticial depois de agendar.
  // Usa `ehFree` (fonte única de verdade do freemium) e não `planoExpirado`,
  // porque um profissional SEM plano cadastrado também é free — antes ele
  // via o banner no rodapé mas nunca recebia o intersticial.
  if (profissionalLogado && ehFree(profissionalLogado)) {
    setMostrarAnuncioPosAgendamento(true);
  }

  setNome("");
  setWhatsapp("");
  setItensAgendarCliente([novoItemAgendarCliente()]);
}

// O download do app agora aparece SEMPRE (no navegador e dentro do app no celular).
// Usamos a URL absoluta do APK publicado no Vercel para o link
// funcionar também quando o site roda dentro do app (Capacitor).
// O parametro ?v= forca o navegador/CDN a baixar a versao mais recente
// do APK (evita servir copia antiga em cache).
const urlDownloadApk =
  "https://agenda-pro-gilt.vercel.app/agenda-pro.apk?v=2.7";


const blocoDownloadApp = (
  <div className="baixar-app-cliente">
    <h3>📲 Faça download do app</h3>
    <p>
      Tenha a Agenda no seu celular e agende com mais
      facilidade nas próximas vezes.
    </p>
    <a
      className="btn-baixar-app"
      href={urlDownloadApk}
      download="Agenda-Pro.apk"
    >
      📱 Baixar para Android
    </a>
    <small className="baixar-app-aviso">
      É grátis e rápido! Após baixar, toque no arquivo para
      instalar (o Android pede permissão — é só permitir).
    </small>
  </div>
);

  const desbloquearAdminSeguro = async () => {
    const { data, error } = await supabase.functions.invoke("verify-admin-opcoes", {
      body: { senha: senhaOpcoesAdmin },
    });
    const ok = !error && data && data.ok === true;
    if (ok) {
      setDesbloqueadoAdmin(true);
    } else {
      alert("Senha incorreta!");
    }
    setSenhaOpcoesAdmin("");
    return ok;
  };

  return (
  <ProtectorDeErrores>
  <div style={appStyles} className={`app-wrapper ${["cinza", "preto", "verde", "masculino"].includes(temaAtivo) ? "cor-masculina" : ""}`}>
    <div className="app-content">

{tela === "inicio" && (
  <div className="inicio-container">
    <div className="login-card inicio-card">
      <h2>
        Sua agenda organizada
        <br />
        de forma simples e rápida
      </h2>

      <div className="inicio-botoes">

        <button
          className="btn cadastrar"
          onClick={() => setTela("login")}
        >
          💼 Entrar na área profissional
        </button>

      </div>
    </div>
  </div>
)}
{tela === "login" && (
<div className="login-card">

<div className="login-icone">
  💼
</div>

<h1 className="login-titulo">
  Área Profissional
</h1>

<p className="login-descricao">
  Gerencie seus agendamentos com facilidade,
</p>

<input
  className="input-login"
  type="text"
  placeholder="Digite seu nome"
  list="logins-profissional-salvos"
  value={loginNome}
  onChange={(e) => {
    const nome = e.target.value;
    setLoginNome(nome);
    const credencial = [...credenciaisLembradas]
      .reverse()
      .find((item) => item.nome === nome);
    if (credencial) {
      setSenha(credencial.senha);
      setLembrarLogin(true);
    }
  }}
/>

<datalist id="logins-profissional-salvos">
  {[...new Set(credenciaisLembradas.map((credencial) => credencial.nome))].map(
    (nome) => <option key={nome} value={nome} />
  )}
</datalist>

<input
  className="input-login"
  type="password"
  placeholder="Digite a senha"
  value={senha}
  onChange={(e) => setSenha(e.target.value)}
/>

<label className="lembrar-login">
  <input
    type="checkbox"
    checked={lembrarLogin}
    onChange={(e) => {
      const lembrar = e.target.checked;
      setLembrarLogin(lembrar);
      if (!lembrar) {
        const credencialExiste = credenciaisLembradas.some(
          (credencial) =>
            credencial.nome === loginNome && credencial.senha === senha
        );
        if (!credencialExiste) return;

        const credenciaisAtualizadas = credenciaisLembradas.filter(
          (credencial) =>
            credencial.nome !== loginNome || credencial.senha !== senha
        );
        try {
          if (credenciaisAtualizadas.length > 0) {
            localStorage.setItem(
              "credenciais_profissional",
              JSON.stringify(credenciaisAtualizadas)
            );
          } else {
            localStorage.removeItem("credenciais_profissional");
          }
          setCredenciaisLembradas(credenciaisAtualizadas);
        } catch (error) {
          console.error("Falha ao remover o login salvo:", error);
          setLembrarLogin(true);
          alert("Não foi possível remover este login salvo neste aparelho.");
        }
      }
    }}
  />
  Lembrar senha e login neste aparelho
</label>

<button className="btn-login"
onClick={async () => {

if (profissionalLogado?.id) {
  setMensagemLogin("");
  if (profissionalLogado.tipo === "super_admin") {
    setTela("admin");
  } else {
    setTela("profissional");
  }
  return;
}

let sessao;
try {
  sessao = await ag.login(loginNome, senha);
} catch (erroLogin) {
  console.error("ERRO LOGIN:", erroLogin);
  setMensagemLogin("Não foi possível entrar. Tente novamente.");
  return;
}

console.log("RETORNO LOGIN:", sessao);

if (!sessao) {
  setMensagemLogin("Nome ou senha incorretos!");
  return;
}

const resultadoLogado = sessao.profissional;

// Plano expirado nao bloqueia mais o login: o profissional entra
// na versao gratuita com anuncios. O admin pode adicionar dias depois.

if (!resultadoLogado.ativo) {
  // Se o plano expirou, reativa automaticamente para versao gratuita com anuncios.
  if (planoExpirado(resultadoLogado)) {
    // Verifica se a versao gratuita esta habilitada no Supabase.
    const { data: cfgData } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "permitir_versao_gratuita_apos_expiracao")
      .maybeSingle();
    if (cfgData?.valor !== "true") {
      await supabase
        .from("profissionais")
        .update({ ativo: false })
        .eq("id", resultadoLogado.id);
      setMensagemLogin(
        "Seu plano expirou e a versão gratuita está desativada. Entre em contato com o administrador."
      );
      return;
    }
    await supabase
      .from("profissionais")
      .update({ ativo: true })
      .eq("id", resultadoLogado.id);
    // Busca os dados atualizados apos reativacao para nao ficar com ativo:false
    const { data: atualizado } = await supabase
      .from("profissionais")
      .select(COLUNAS_PERFIL)
      .eq("id", resultadoLogado.id)
      .maybeSingle();
    if (atualizado) {
      resultadoLogado.ativo = atualizado.ativo;
    }
  } else {
    setMensagemLogin("Este perfil está desativado.");
    return;
  }
}

if (lembrarLogin) {
  try {
    const credencialAtual = { nome: loginNome, senha };
    const credenciaisAtualizadas = [
      ...credenciaisLembradas.filter(
        (credencial) =>
          credencial.nome !== credencialAtual.nome ||
          credencial.senha !== credencialAtual.senha
      ),
      credencialAtual,
    ];
    localStorage.setItem(
      "credenciais_profissional",
      JSON.stringify(credenciaisAtualizadas)
    );
    setCredenciaisLembradas(credenciaisAtualizadas);
  } catch (error) {
    console.error("Falha ao salvar o login neste aparelho:", error);
    alert("Login realizado, mas não foi possível salvar os dados neste aparelho.");
  }
}

setProfissionalLogado(resultadoLogado);
abrirNotificacaoPendente(resultadoLogado.id);
localStorage.setItem("profissionalLogado", JSON.stringify(resultadoLogado));
// Remove os parâmetros do link de login da URL para a sessão valer no refresh.
window.history.replaceState({}, "", window.location.pathname);
setNotificacaoNovoAgendamento(null);
setTemaSelecionado(resultadoLogado.tema || "feminino");
setIconeSelecionado(normalizarIcone(resultadoLogado.icone) || (resultadoLogado.tema === "masculino" ? "💈" : "💅🏻"));

setMensagemLogin("");

if (resultadoLogado.tipo === "super_admin") {
  setTela("admin");
} else {
  setTela("profissional");
}

if (!lembrarLogin) {
  setSenha("");
  setLoginNome("");
}

}}
>
Entrar
</button>

<button className="btn-voltar"
  onClick={async () => {
   setMensagemLogin("");
   setLoginNome("");
    setTela("login");
  }}
>
  Voltar
</button>
{mensagemLogin && (
  <p className="erro-login">
    {mensagemLogin}
  </p>
)}

</div>
)}

{tela === "cliente" && (
<div className="cliente-card">



<div className="cliente-topo">
  <div className="cliente-icone">
      {iconeAtivo}
    </div>
    <h1>Agendar horário</h1>

  <p>
    Escolha o melhor horário para você
  </p>

  {console.log("PROFISSIONAL CLIENTE:", profissionalCliente)}

  <p className="status-text">
    {statusPerfilClienteFechado ? (
      <>
        <span aria-hidden="true">🔴</span> Fechado
      </>
    ) : (
      <>
        <span aria-hidden="true">🟢</span> Aberto
      </>
    )}
  </p>
  {dadosProfissionalCliente?.mostrar_horario_funcionamento &&
    dadosProfissionalCliente?.horario_funcionamento_inicio &&
    dadosProfissionalCliente?.horario_funcionamento_fim && (
      <p className="horario-funcionamento-cliente">
        {diasAtendimentoPerfilTexto
          ? `Olá! Atendemos ${diasAtendimentoPerfilTexto}, das `
          : "Olá, nosso horário de atendimento é das "}
        {dadosProfissionalCliente.horario_funcionamento_inicio} às{" "}
        {dadosProfissionalCliente.horario_funcionamento_fim}
      </p>
    )}
</div>




{mensagem && (
  <p style={{ color: tipoMensagem === "erro" ? "red" : "green" }}>
    {mensagem}
  </p>
)}

<label>Nome</label>

<input
  placeholder="Digite seu nome"
  value={nome}
  maxLength="20"
  onChange={(e) => {
    const somenteLetras = e.target.value.replace(/[0-9]/g, "");
    setNome(somenteLetras);
  }}
/>

<label>WhatsApp</label>

<input
  placeholder="(00) 00000-0000"
  value={whatsapp}
  maxLength="15"

onChange={(e) => {
  let numero = e.target.value.replace(/\D/g, "");

  if (numero.length > 11) {
    numero = numero.slice(0, 11);
  }

  if (numero.length <= 2) {
    setWhatsapp(numero);
  } 
  else if (numero.length <= 7) {
    setWhatsapp(
      `(${numero.slice(0,2)}) ${numero.slice(2)}`
    );
  }
  else {
    setWhatsapp(
      `(${numero.slice(0,2)}) ${numero.slice(2,7)}-${numero.slice(7)}`
    );
  }
}}
/>
{itensCliente.map((item, indice) =>
  !item.em_promocao ? (
  <div key={indice} className="linha-servico">
    <label>
      Serviço {indice + 1}
    </label>

    <select
      value={item.servico}
      onChange={(e) => {
        atualizarLinhaCliente(indice, "servico", e.target.value);
      }}
    >
      <option value="">
        Escolha o serviço
      </option>

      {servicos
        .filter(
          (s) =>
            s.profissional_id === profissionalCliente && s.ativo
        )
        .map((s) => (
          <option
            key={s.id}
            value={s.nome}
          >
            {iconeAtivo} {s.nome}{s.duracao ? ` - ⏰ ${s.duracao}` : ""}{s.valor ? ` - 💰 R$ ${s.valor}` : ""}
          </option>
        ))}
    </select>

    <label>Data</label>

    <input
      type="date"
      value={item.data}
      min={new Date().toLocaleDateString("sv-SE")}
      onChange={(e) => atualizarLinhaCliente(indice, "data", e.target.value)}
    />

    {(!item.data ||
      (!diasFolgaCliente.includes(diaSemanaDaData(item.data)) &&
        !folgasDatasCliente.includes(item.data))) && (
      <>
        <label>Horário</label>
        <select
          value={item.horario}
          onChange={(e) => atualizarLinhaCliente(indice, "horario", e.target.value)}
        >
          <option value="">
            Escolha o horário
          </option>

          {(horariosPorLinhaCliente[indice] || []).map((hora) => (
            <option
              key={hora}
              value={hora}
            >
              {hora}
            </option>
          ))}
        </select>
      </>
    )}

    {(() => {
      const horasServicio = duracaoHorasDeServicio(
        item.servico,
        servicos,
        profissionalCliente
      );
      const servicoDuracaoText = item.servico
        ? servicos.find(
            (s) =>
              s.profissional_id === profissionalCliente &&
              s.nome === item.servico &&
              s.ativo
          )?.duracao
        : "";
      return item.servico && item.horario && horasServicio > 0 ? (
        <small className="duracao-info">
          ⏰ {servicoDuracaoText} — {item.horario} até{" "}
          {sumarHoras(item.horario, horasServicio)}
        </small>
      ) : null;
    })()}

    {precisaAprovacaoProfissional(
      item.data,
      dadosProfissionalCliente?.exigir_aprovacao_dezembro
    ) &&
      (horariosPorLinhaCliente[indice] || []).length > 0 && (
        <small
          style={{
            color: "#dc2626",
            display: "block",
            marginTop: "6px",
            fontWeight: "bold",
            fontSize: "13px",
          }}
        >
          📅 Dezembro: este pedido será enviado para a aprovação do
          profissional antes de ser confirmado.
        </small>
      )}

    {item.data && (horariosPorLinhaCliente[indice] || []).length === 0 && (
      <small
        style={
          diasFolgaCliente.includes(diaSemanaDaData(item.data)) ||
          folgasDatasCliente.includes(item.data)
            ? { color: "#dc2626", fontWeight: "bold" }
            : undefined
        }
      >
        {diasFolgaCliente.includes(diaSemanaDaData(item.data)) ||
        folgasDatasCliente.includes(item.data)
          ? "🚫 Este dia é folga do profissional. Escolha outra data."
          : "Nenhum horário livre para este dia. Escolha outra data."}
      </small>
    )}

    {indice > 0 && (
      <button
        type="button"
        className="linha-remover"
        onClick={() => removerLinhaCliente(indice)}
      >
        ✖ Remover este serviço
      </button>
    )}
  </div>
  ) : null
)}

<button
  type="button"
  className="linha-adicionar"
  onClick={adicionarLinhaCliente}
>
  ➕ Adicionar outro serviço
</button>

{/* Seletor de SERVIÇOS EM PROMOÇÃO — aparece abaixo do seletor normal.
    Só mostra promoções ativas no mês/semana atuais e quando o profissional
    deixou o seletor de promoções ATIVADO. */}
{promocoesParaCliente.length > 0 && (
  <div className="promo-cliente">
    <h3>🎉 Serviços em promoção</h3>
    <p className="promo-cliente-dica">
      Escolha um serviço com preço de promoção (vale para este mês).
    </p>

    {linhasPromoCliente.length === 0 ? (
      <select
        className="promo-placeholder-select"
        value=""
        onChange={(e) => {
          if (e.target.value) {
            adicionarLinhaPromoClienteComServico(e.target.value);
          }
        }}
      >
        <option value="">
          Escolha o serviço em promoção
        </option>

        {promocoesParaCliente.map((promo) => (
          <option
            key={promo.id}
            value={promo.servico}
          >
            {promo.servico}{promo.duracao ? ` - ⏰ ${promo.duracao}` : ""}{Number(promo.valor) > 0 ? ` - 💰 R$ ${promo.valor}` : ""}
          </option>
        ))}
      </select>
    ) : (
    itensCliente.map((item, indice) =>
      item.em_promocao ? (
        <div key={indice} className="linha-servico promo-linha">
          <label>Serviço em promoção</label>

          <select
            value={item.servico}
            onChange={(e) => {
              atualizarLinhaCliente(indice, "servico", e.target.value);
            }}
          >
            <option value="">
              Escolha o serviço em promoção
            </option>

            {promocoesParaCliente.map((promo) => (
              <option
                key={promo.id}
                value={promo.servico}
              >
                {promo.servico}{promo.duracao ? ` - ⏰ ${promo.duracao}` : ""}{Number(promo.valor) > 0 ? ` - 💰 R$ ${promo.valor}` : ""}
              </option>
            ))}
          </select>

          <label>Data</label>

          <input
            type="date"
            value={item.data}
            min={new Date().toLocaleDateString("sv-SE")}
            onChange={(e) => atualizarLinhaCliente(indice, "data", e.target.value)}
          />

          <label>Horário</label>
          <select
            value={item.horario}
            disabled={
              !item.data ||
              !promocaoAtivaEm(
                promocoes.find(
                  (promo) => Number(promo.id) === Number(item.promo_id)
                ),
                item.data
              )
            }
            onChange={(e) => atualizarLinhaCliente(indice, "horario", e.target.value)}
          >
            <option value="">
              Escolha o horário
            </option>

            {(horariosPorLinhaCliente[indice] || []).map((hora) => (
              <option
                key={hora}
                value={hora}
              >
                {hora}
              </option>
            ))}
          </select>

          {(() => {
            const promoInfo = item.promo_id
              ? promocoes.find((p) => Number(p.id) === Number(item.promo_id))
              : null;
            const horasServicio = promoInfo?.duracao
              ? parsearDuracaoHoras(promoInfo.duracao)
              : duracaoHorasDeServicio(
                  item.servico,
                  servicos,
                  profissionalCliente
                );
            return item.servico && item.horario && horasServicio > 0 ? (
              <small className="duracao-info">
                ⏰ {promoInfo?.duracao || ""} — {item.horario} até{" "}
                {sumarHoras(item.horario, horasServicio)}
              </small>
            ) : null;
          })()}

          {(() => {
            if (item.data && item.promo_id) {
              const promoInfo = promocoes.find(
                (p) => Number(p.id) === Number(item.promo_id)
              );
              if (promoInfo && !promocaoAtivaEm(promoInfo, item.data)) {
                return (
                  <small
                    style={{
                      display: "block",
                      color: "#dc2626",
                      fontWeight: "bold",
                      marginTop: "6px",
                    }}
                  >
                    🚫 Esta promoção só vale em:{" "}
                    {diasDaPromocao(promoInfo).join(", ")}. Escolha uma data
                    permitida.
                  </small>
                );
              }
            }
            return null;
          })()}

          {item.data && (horariosPorLinhaCliente[indice] || []).length === 0 && (
            <small
              style={
                diasFolgaCliente.includes(diaSemanaDaData(item.data)) ||
                folgasDatasCliente.includes(item.data)
                  ? { color: "#dc2626", fontWeight: "bold" }
                  : undefined
              }
            >
              {diasFolgaCliente.includes(diaSemanaDaData(item.data)) ||
              folgasDatasCliente.includes(item.data)
                ? "🚫 Este dia é folga do profissional. Escolha outra data."
                : !promocaoAtivaEm(
                    promocoes.find(
                      (promo) =>
                        Number(promo.id) === Number(item.promo_id)
                    ),
                    item.data
                  )
                ? <span style={{ color: "#dc2626", fontWeight: "bold" }}>🚫 Esta promoção não está disponível nesta data. Escolha uma data permitida.</span>
                : "Nenhum horário livre para este dia. Escolha outra data."}
            </small>
          )}

          {linhasPromoCliente.length > 1 && (
            <button
              type="button"
              className="linha-remover"
              onClick={() => removerLinhaPromoCliente(indice)}
            >
              ✖ Remover esta promoção
            </button>
          )}
        </div>
      ) : null
    )
    )}

    {linhasPromoCliente.length > 0 && (
      <button
        type="button"
        className="linha-adicionar"
        onClick={adicionarLinhaPromoCliente}
      >
        ➕ Adicionar outro serviço em promoção
      </button>
    )}
  </div>
)}

<button
style={{
  backgroundColor: temaConfig.primary,
}}
onClick={enviarPedidoCliente}
>
Enviar pedido
</button>
  {dadosProfissionalCliente?.chave_pix && (
<div className="pix-cliente">
  <h3>💠 Pagamento via Pix</h3>

  {dadosProfissionalCliente.banco_pix && (
    <p>
      <strong>Banco:</strong> {dadosProfissionalCliente.banco_pix}
    </p>
  )}

  {dadosProfissionalCliente.nome_pix && (
    <p>
      <strong>Nome:</strong> {dadosProfissionalCliente.nome_pix}
    </p>
  )}

  <p className="pix-frase">Toque na chave para copiar:</p>

  <div
    className="pix-chave-copia"
    title="Clique para copiar"
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(
          dadosProfissionalCliente.chave_pix
        );
        setPixCopiada(true);
        setTimeout(() => setPixCopiada(false), 2000);
      } catch (e) {
        alert(dadosProfissionalCliente.chave_pix);
      }
    }}
  >
    {dadosProfissionalCliente.chave_pix}
  </div>

  <button
    type="button"
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(
          dadosProfissionalCliente.chave_pix
        );
        setPixCopiada(true);
        setTimeout(() => setPixCopiada(false), 2000);
      } catch (e) {
        alert(dadosProfissionalCliente.chave_pix);
      }
    }}
  >
    {pixCopiada ? "✅ Chave Pix copiada!" : "📋 Copiar chave Pix"}
  </button>
</div>
)}
  {dadosProfissionalCliente?.mostrar_endereco && (
    dadosProfissionalCliente?.endereco_rua ||
    dadosProfissionalCliente?.endereco_numero ||
    dadosProfissionalCliente?.endereco_cep
  ) && (
<div className="endereco-cliente">
  <h3>📍 Endereço</h3>

  {dadosProfissionalCliente.endereco_rua && (
    <p>
      <strong>Rua:</strong> {dadosProfissionalCliente.endereco_rua}
      {dadosProfissionalCliente.endereco_numero ? ` Nº ${dadosProfissionalCliente.endereco_numero}` : ""}
    </p>
  )}

  {!dadosProfissionalCliente.endereco_rua && dadosProfissionalCliente.endereco_numero && (
    <p>
      <strong>Nº:</strong> {dadosProfissionalCliente.endereco_numero}
    </p>
  )}

  {dadosProfissionalCliente.endereco_cep && (
    <p>
      <strong>CEP:</strong> {dadosProfissionalCliente.endereco_cep}
    </p>
  )}
</div>
)}

  {/* Banner de anúncio no meio da página pública do cliente (entre o
      formulário e a lista de pedidos). Fica oculto enquanto o intersticial
      está aberto para não exibir dois anúncios do mesmo slot ao mesmo tempo. */}
  {clienteVeAnuncios && !mostrarAnuncioCliente && (
    <AdMobBanner
      className="ad-banner--cliente-meio"
      slot={process.env.BUILD_TARGET === 'android' ? ADMOB_SLOT_CLIENT_MEIO : ADSENSE_SLOT_CLIENT_MEIO}
    />
  )}

  {pedido && (
<div>
    <h3>
      Pedido{pedido.length > 1 ? "s" : ""} salvo{pedido.length > 1 ? "s" : ""}:
    </h3>
    {pedido.map((p, indice) => (
      <div key={indice} className="pedido-salvo-linha">
        <p>Nome: {p.nome}</p>
        <p>WhatsApp: {p.whatsapp}</p>
        <p>Serviço: {iconeAtivo} {p.servico}</p>
        <p>Data: {formatarDataBR(p.data)}</p>
        <p>
          Horário: {p.horario}
          {(() => {
            const horasServicio = duracaoHorasDeServicio(
              p.servico,
              servicos,
              profissionalCliente
            );
            return horasServicio > 0
              ? ` até ${sumarHoras(p.horario, horasServicio)}`
              : "";
          })()}
        </p>
        {indice < pedido.length - 1 && <hr />}
      </div>
    ))}
</div>
)}

{profissionalLogado?.id &&
  Number(profissionalCliente) === Number(profissionalLogado.id) && (
  <button
    onClick={() => {
      setMensagem("");
      setTipoMensagem("");
      setTela(profissionalLogado.tipo === "super_admin" ? "admin" : "profissional");
    }}
  >
    💼 Voltar ao meu painel
  </button>
)}
{/* O link de download só aparece fora do app (navegador). Dentro do app instalado
    não faz sentido oferecer o download dele mesmo. Usamos isNativePlatform()
    porque window.Capacitor existe também no navegador (o core do Capacitor
    define essa variável global), o que faria o link sumir de todo lugar. */}
{!Capacitor.isNativePlatform() && blocoDownloadApp}

{/* Anúncio intersticial do CLIENTE: aparece logo depois que ele envia
    o pedido (agendamento salvo com sucesso). Só para profissionais
    do plano gratuito. */}
{mostrarAnuncioCliente && clienteVeAnuncios && (
  <AdInterstitial onFechar={() => setMostrarAnuncioCliente(false)} />
)}

{/* Banner de anúncio no rodapé da página pública do cliente.
    Fica oculto enquanto o intersticial está aberto para não exibir
    dois anúncios do mesmo slot ao mesmo tempo. */}
{clienteVeAnuncios && !mostrarAnuncioCliente && (
  <AdBanner className="ad-banner--cliente" slot={ADSENSE_SLOT_CLIENT} />
)}

</div>
)}
{tela === "admin" && (
  <div className="admin-area">
    <div className="admin-card">

    <div className="admin-header">

<p>
  
</p>

      <h1>
        Olá, {profissionalLogado?.nome}
      </h1>

      <small>
        Gerencie profissionais e configurações
      </small>

    </div>

    <div className="admin-senha-area">
      {!desbloqueadoAdmin ? (
        <>
          <p>🔒 Área protegida — digite a senha do administrador para acessar as opções (editar, desativar, excluir, ver senha).</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="password"
              placeholder="Senha do administrador"
              value={senhaOpcoesAdmin}
              onChange={(e) => setSenhaOpcoesAdmin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  desbloquearAdminSeguro();
                }
              }}
            />
            <button
              onClick={() => {
                desbloquearAdminSeguro();
              }}
            >
              🔓 Desbloquear opções
            </button>
          </div>
        </>
      ) : (
        <>
          <p>✅ Área desbloqueada — as opções estão liberadas.</p>
          <button
            onClick={() => {
              setDesbloqueadoAdmin(false);
              setProfissionalEditando(null);
              setMostrarSenha(false);
            }}
          >
            🔒 Bloquear opções
          </button>
        </>
      )}
    </div>

    <div className="tema-configuracao">
      <label>Cor do perfil</label>
      <div>
        <select
          value={temaSelecionado}
          onChange={(e) => setTemaSelecionado(e.target.value)}
        >
          {themeOptions.map((tema) => (
            <option key={tema.value} value={tema.value}>
              {tema.label}
            </option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (!profissionalLogado?.id) return;

            const { error } = await supabase
              .from("profissionais")
              .update({ tema: temaSelecionado })
              .eq("id", profissionalLogado.id);

            if (error) {
              console.error(error);
              alert("Erro ao salvar a cor do perfil.");
              return;
            }

            setProfissionalLogado({
              ...profissionalLogado,
              tema: temaSelecionado,
            });

            alert(`Cor atualizada para ${themeOptions.find((item) => item.value === temaSelecionado)?.label || "tema"}!`);
          }}
        >
          Salvar cor
        </button>
      </div>
    </div>

{desbloqueadoAdmin && (
    <div className="admin-secao-config-gratuita" style={{ marginBottom: "16px", padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid var(--cor-borda)" }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: "18px" }}>{versaoGratuitaHabilitada ? "🆓" : "🚫"} Versão gratuita após expiração do plano</h4>
      <button
        type="button"
        onClick={() => salvarConfiguracaoVersaoGratuita(!versaoGratuitaHabilitada)}
        disabled={carregandoConfigSistema}
        style={{
          padding: "12px 20px",
          background: versaoGratuitaHabilitada ? "#10b981" : "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
        }}
      >
        {carregandoConfigSistema ? "⏳ Salvando…" : versaoGratuitaHabilitada ? "✅ Versão gratuita ATIVADA" : "❌ Versão gratuita DESATIVADA"}
      </button>
      <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "#666" }}>
        {versaoGratuitaHabilitada
          ? "Quando o plano de um profissional expirar, ele continua na versão gratuita com anúncios."
          : "Quando o plano de um profissional expirar, seu perfil será DESATIVADO automaticamente (não poderá usar a agenda)."}
      </p>
    </div>
  )}
    <h3>Profissionais cadastrados</h3>

    <div className="resumo-dashboard">

  <div className="resumo-card">
    <h3>👥 Profissionais</h3>
    <p>{profissionais.length}</p>
  </div>


  <div
    className="resumo-card resumo-card-clicavel"
    onClick={() =>
      setMostrarListaAdmin(mostrarListaAdmin === "ativos" ? null : "ativos")
    }
  >
    <h3>🟢 Ativos</h3>
    <p>
      {
        profissionais.filter(
          (p) => p.ativo
        ).length
      }
    </p>
  </div>


  <div
    className="resumo-card resumo-card-clicavel"
    onClick={() =>
      setMostrarListaAdmin(mostrarListaAdmin === "desativados" ? null : "desativados")
    }
  >
    <h3>🔴 Desativados</h3>
    <p>
      {
        profissionais.filter(
          (p) => !p.ativo
        ).length
      }
    </p>
  </div>

</div>

{mostrarListaAdmin === "ativos" && (
  <div className="admin-sublista">
    <h4>🟢 Profissionais ativos</h4>
    {profissionais.filter((p) => p.ativo).length === 0 && (
      <p>Nenhum profissional ativo.</p>
    )}
    {profissionais.filter((p) => p.ativo).map((profissional) => (
      <div key={profissional.id} className="admin-sublista-item">
        <span>
          👤 {profissional.nome}{profissional.tipo === "super_admin" && " 👑"}
          {profissional.tipo !== "super_admin" && (
            <small className="plano-dias-pequeno">
              {" "}
              {profissional.plano_ilimitado
                ? "♾️ permanente"
                : diasRestantesPlano(profissional) != null
                ? `📅 ${diasRestantesPlano(profissional)} dia${diasRestantesPlano(profissional) === 1 ? "" : "s"}`
                : "❌ sem plano"}
            </small>
          )}
        </span>
        {desbloqueadoAdmin ? (
          profissional.tipo === "super_admin" ? (
            <small>👑</small>
          ) : (
            <button onClick={() => alternarAtivoProfissional(profissional)}>
              🚫 Desativar
            </button>
          )
        ) : (
          <small>🔒</small>
        )}
      </div>
    ))}
  </div>
)}

{mostrarListaAdmin === "desativados" && (
  <div className="admin-sublista">
    <h4>🔴 Profissionais bloqueados</h4>
    {profissionais.filter((p) => !p.ativo).length === 0 && (
      <p>Nenhum profissional bloqueado.</p>
    )}
    {profissionais.filter((p) => !p.ativo).map((profissional) => (
      <div key={profissional.id} className="admin-sublista-item">
        <span>
          👤 {profissional.nome}{profissional.tipo === "super_admin" && " 👑"}
          {profissional.tipo !== "super_admin" && (
            <small className="plano-dias-pequeno">
              {" "}
              {planoExpirado(profissional) ? "⏰ plano expirado" : "🚫 desativado manualmente"}
            </small>
          )}
        </span>
        {desbloqueadoAdmin ? (
          profissional.tipo === "super_admin" ? (
            <small>👑</small>
          ) : (
            <button onClick={() => alternarAtivoProfissional(profissional)}>
              ✅ Ativar
            </button>
          )
        ) : (
          <small>🔒</small>
        )}
      </div>
    ))}
  </div>
)}
    <div className="admin-secao">
    

<button
  onClick={async () => {

    // Carrega a lista e já desativa automaticamente quem tiver o plano vencido.
    await carregarProfissionaisAdmin();

    const count = await ag.contarAdmin();

setTotalAgendamentos(count);

  }}
>
  Carregar profissionais
</button>


{profissionais.map((profissional) => (
  <div 
    key={profissional.id}
    className="profissional-card"
  >

<div className="profissional-info">

<p>
  👤 {profissional.nome}
</p>

<p>
  🆔 ID: {profissional.id}
</p>

<p>
  Status: {profissional.ativo ? "🟢 Ativo" : "🔴 Inativo"}
</p>

{profissional.tipo !== "super_admin" && (
  <>
    <p className={`plano-status plano-status-${informacaoPlano(profissional).tipo}`}>
      {informacaoPlano(profissional).texto}
    </p>
    {!profissional.plano_ilimitado &&
      validadePlanoMs(profissional) != null &&
      validadePlanoMs(profissional) > Date.now() && (
        <p className="plano-vencimento">
          📅 Vence em: {formatarDataPlano(profissional)}
        </p>
      )}
  </>
)}

{
  profissionais.filter(
    (p) => p.nome === profissional.nome
  ).length > 1 && (
    <p style={{ color: "#d32f2f", fontWeight: "bold", marginTop: "8px" }}>
      ⚠️ Nome e senha duplicados! Ajuste um deles para evitar confusão no login.
    </p>
  )
}



</div>


{profissional.tipo !== "super_admin" && (
  <div className="link-profissional">
    <p>📅 Link do cliente — para o cliente agendar</p>
    <button
      onClick={async () => {
        const link = gerarLinkProfissional(profissional.id);
        try {
          await copiarTexto(link);
          alert("Link do cliente copiado!");
        } catch (err) {
          console.error("Falha ao copiar o link do cliente:", err);
          window.prompt("Copie o link do cliente:", link);
        }
      }}
    >
      📋 Copiar link do cliente
    </button>

    <p>💼 Link do profissional — para abrir o login direto</p>
    <button
      onClick={async () => {
        const link = gerarLinkProfissional(profissional.id, true);
        try {
          await copiarTexto(link);
          alert("Link do profissional copiado!");
        } catch (err) {
          console.error("Falha ao copiar o link do profissional:", err);
          window.prompt("Copie o link do profissional:", link);
        }
      }}
    >
      📋 Copiar link do profissional
    </button>
  </div>
)}


{desbloqueadoAdmin && (
  <div className="profissional-botoes">
    {profissional.tipo === "super_admin" ? (
      <button disabled style={{ background: "#6b7280", cursor: "not-allowed" }}>
        👑 Administrador
      </button>
    ) : (
      <>
        <button onClick={() => alternarAtivoProfissional(profissional)}>
          {profissional.ativo ? "Desativar" : "Ativar"}
        </button>

        <div className="plano-botoes">
          <button onClick={() => adicionarDiasPlano(profissional, DIAS_PADRAO_PLANO)}>
            ➕ Renovar +{DIAS_PADRAO_PLANO} dias
          </button>
          <button
            className="btn-remover-dias"
            onClick={() => removerDiasPlano(profissional, DIAS_PADRAO_PLANO)}
          >
            ➖ Remover {DIAS_PADRAO_PLANO} dias
          </button>

          <input
            type="number"
            min="1"
            placeholder="Dias"
            value={diasParaAdicionarPorProfissional[profissional.id] ?? ""}
            onChange={(e) =>
              setDiasParaAdicionarPorProfissional((prev) => ({
                ...prev,
                [profissional.id]: e.target.value,
              }))
            }
          />
          <button
            onClick={() =>
              adicionarDiasPlano(
                profissional,
                Number(diasParaAdicionarPorProfissional[profissional.id])
              )
            }
          >
            ➕ Adicionar dias
          </button>
          <button
            className="btn-remover-dias"
            onClick={() =>
              removerDiasPlano(
                profissional,
                Number(diasParaAdicionarPorProfissional[profissional.id])
              )
            }
          >
            ➖ Remover dias
          </button>

          {profissional.plano_ilimitado ? (
            <button onClick={() => removerPlanoIlimitado(profissional)}>
              🚫 Remover permanente
            </button>
          ) : (
            <button onClick={() => ativarPlanoIlimitado(profissional)}>
              ♾️ Tornar permanente
            </button>
          )}
        </div>
      </>
    )}
    {profissional.tipo !== "super_admin" && (
      <button
        onClick={async () => {

          if (profissional.tipo === "super_admin") {
            alert("O administrador não pode ser excluído.");
            return;
          }

          const confirmar = window.confirm(
            "Deseja realmente excluir este profissional?"
          );

          if (!confirmar) return;

          const { error } = await supabase
            .from("profissionais")
            .delete()
            .eq("id", profissional.id);

          if (error) {
            console.error(error);
            alert("Erro ao excluir profissional.");
            return;
          }

          const novosProfissionais = profissionais.filter(
            (item) => item.id !== profissional.id
          );

          setProfissionais(novosProfissionais);

          alert("Profissional excluído com sucesso!");

        }}
      >
        🗑️ Excluir perfil
      </button>
    )}

    <button
      className="btn-editar"
      onClick={() => {

        setProfissionalEditando(profissional);

        setEditarNome(profissional.nome);

        setEditarSenha("");

        setMostrarSenha(false);

      }}
    >
      ✏️ Editar
    </button>
  </div>
)}
 {profissionalEditando?.id === profissional.id && (
  <div style={{ marginTop: "10px" }}>

    <input
      placeholder="Novo nome"
      value={editarNome}
      onChange={(e) => setEditarNome(e.target.value)}
    />

<input
  type={mostrarSenha ? "text" : "password"}
  placeholder="Nova senha (deixe em branco para manter a atual)"
  value={editarSenha}
  onChange={(e) => setEditarSenha(e.target.value)}
/>

<button
  onClick={async () => {
    // A senha não vem mais no select * (blindada). Buscamos via RPC, que só
    // permite para super_admin autenticado.
    try {
      const senhaAtual = await ag.adminVerSenha(profissional.id);
      if (senhaAtual != null) setEditarSenha(senhaAtual);
      setMostrarSenha(true);
    } catch (error) {
      console.error(error);
      alert("Não foi possível carregar a senha. Verifique se você é administrador.");
    }
  }}
>
  👁️ Ver senha
</button>

<button
  onClick={async () => {

    // Só envia a senha se o admin preencheu uma nova; senão, mantém a atual.
    const mudouSenha = editarSenha.trim().length > 0;
    const dadosAtualizacao = mudouSenha
      ? { nome: editarNome, senha: editarSenha }
      : { nome: editarNome };

    const { error } = await supabase
      .from("profissionais")
      .update(dadosAtualizacao)
      .eq("id", profissional.id);

    if (error) {
      console.error(error);
      alert("Erro ao atualizar.");
      return;
    }

    const { data } = await supabase
      .from("profissionais")
      .select(COLUNAS_PERFIL);

   if (data) setProfissionais(data);

    setProfissionalEditando(null);

    setEditarNome("");
setEditarSenha("");

    alert("Profissional atualizado com sucesso!");

  }}
>
  Salvar
</button>

</div>
)}
  </div>
  
))}
</div>
    <p>
      Painel administrativo
    </p>


<input
  placeholder="Nome do profissional"
  value={novoNome}
  onChange={(e) => setNovoNome(e.target.value)}
/>

<input
  placeholder="Senha"
  type="password"
  value={novaSenha}
  onChange={(e) => setNovaSenha(e.target.value)}
/>

<label>
  Tema do perfil
</label>

<select
  value={temaNovo}
  onChange={(e) => setTemaNovo(e.target.value)}
>
  {themeOptions.map((tema) => (
    <option key={tema.value} value={tema.value}>
      {tema.label}
    </option>
  ))}
</select>


<button
  onClick={async () => {

        if (!novoNome || !novaSenha) {
          alert("Preencha nome e senha");
          return;
        }


        // Profissional novo já começa com o pacote mensal (30 dias de uso).
        const novaValidadePlano = new Date(Date.now() + DIAS_PADRAO_PLANO * MS_DIA).toISOString();

        const { error } = await supabase
          .from("profissionais")
          .insert([
            {
          nome: novoNome,
          senha: novaSenha,
          tipo: "profissional",
          ativo: true,
          status_atendimento: "Aberto",
          tema: temaNovo,
          validade_plano: novaValidadePlano,
          plano_ilimitado: false
        }
        ]);

        if (error) {
          console.error(error);
          alert("Erro ao cadastrar");
          return;
        }


        alert("Profissional criado com sucesso!");
        const { data } = await supabase
.from("profissionais")
.select(COLUNAS_PERFIL);

if (data) setProfissionais(data);

setNovoNome("");
setNovaSenha("");
setTemaNovo("feminino");

}}
>
Criar profissional
</button>

    <br /><br />


    <button
      onClick={() => {
        localStorage.removeItem("profissionalLogado");
        ag.setToken(null);
        setProfissionalLogado(null);
        setTela("login");
      }}
    >
      Sair
    </button>

    </div>
  </div>
)}

{tela === "profissional" && (
  <div className="profissional-container">


          
<div className="profissional-header">

<p style={{ marginTop: "10px" }}>
  Área Profissional
</p>

<h2>
  Olá, {profissionalLogado?.nome} 👋🏻
</h2>
<div style={{marginTop:"20px"}}>

</div>

  <small>
    Gerencie seus agendamentos com facilidade
  </small>
        </div>

        {ehFree(profissionalLogado) && (
          <div style={{
            background: '#fff3cd',
            border: '1px solid #ffc107',
            color: '#856404',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '20px' }}>ℹ️</span>
            <div>
              <strong>Plano: Gratuito com anúncios</strong>
              {profissionalLogado.validade_plano ? (
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                  Plano válido até {formatarDataPlano(profissionalLogado)} — ao vencer, continua na versão gratuita com anúncios.
                </p>
              ) : (
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                  Plano gratuito — sem data de validade definida.
                </p>
              )}
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                Para remover anúncios, peça ao administrador para adicionar dias ou tornar o plano ilimitado.
              </p>
            </div>
          </div>
        )}

        {/* Banner de anúncio no topo da tela do profissional.
            Antes ele ficava no fim absoluto do container (linha ~9200), ou seja,
            depois de mais de 3.000 linhas de JSX — o profissional raramente
            rolava até lá e o anúncio praticamente nunca era visto.
            Agora aparece logo abaixo do cabeçalho, onde a tela é realmente
            consumida. */}
        {profissionalLogado &&
          ehFree(profissionalLogado) &&
          !mostrarAnuncioPosAgendamento && (
            <div className="ad-banner--profissional">
              <AdBanner slot={ADSENSE_SLOT_PROFISSIONAL} />
            </div>
          )}

        {/* Anúncio pós-agendamento - só aparece se o flag estiver ativo */}
        {mostrarAnuncioPosAgendamento && (
          <AdInterstitial
            onFechar={() => setMostrarAnuncioPosAgendamento(false)}
          />
        )}

<h3>
  {iconeAtivo} Meus serviços
</h3>
<button
onClick={async () => {

const novoStatus = statusAtendimentoAberto(statusAtendimento)
  ? "Fechado"
  : "Aberto";


const { error } = await supabase
.from("profissionais")
.update({
  status_atendimento: novoStatus
})
.eq("id", profissionalLogado.id);


if(error){
 console.error(error);
 return;
}


setStatusAtendimento(novoStatus);

setProfissionalLogado({
 ...profissionalLogado,
 status_atendimento: novoStatus
});

}}
>
{
statusAtendimentoAberto(statusAtendimento)
  ? "🟢 Aberto"
  : "🔴 Fechado"
}

</button>


<button
  className="btn-config-principal"
  onClick={() => {
    const abrir = !mostrarAgendarCliente;
    setMostrarAgendarCliente(abrir);
    if (abrir) {
      // Começa o formulário limpo
      setNome("");
      setWhatsapp("");
      setItensAgendarCliente([novoItemAgendarCliente()]);
      setMensagemAgendarCliente("");
      setTipoMensagemAgendarCliente("");
    }
  }}
>
  {mostrarAgendarCliente
    ? "❌ Fechar agendamento por cliente"
    : "📝 Agendar por um cliente"}
</button>

{mostrarAgendarCliente && (
  <div className="agendar-cliente-form">
    <h3>📝 Agendar por um cliente</h3>
    <small>
      Use esta opção quando o cliente não conseguir agendar sozinho,
      por exemplo quando está sem celular.
    </small>

    {mensagemAgendarCliente && (
      <p style={{ color: tipoMensagemAgendarCliente === "erro" ? "red" : "green" }}>
        {mensagemAgendarCliente}
      </p>
    )}

    <label>Nome do cliente</label>
    <input
      placeholder="Digite o nome do cliente"
      value={nome}
      maxLength="20"
      onChange={(e) => {
        const somenteLetras = e.target.value.replace(/[0-9]/g, "");
        setNome(somenteLetras);
      }}
    />

    <label>WhatsApp do cliente</label>
    <input
      placeholder="(00) 00000-0000"
      value={whatsapp}
      maxLength="15"
      onChange={(e) => {
        let numero = e.target.value.replace(/\D/g, "");

        if (numero.length > 11) {
          numero = numero.slice(0, 11);
        }

        if (numero.length <= 2) {
          setWhatsapp(numero);
        } else if (numero.length <= 7) {
          setWhatsapp(`(${numero.slice(0, 2)}) ${numero.slice(2)}`);
        } else {
          setWhatsapp(`(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`);
        }
      }}
    />

    {itensAgendarCliente.map((item, indice) =>
      !item.em_promocao ? (
      <div key={indice} className="linha-servico">
        <label>Serviço {indice + 1}</label>
        <select
          value={item.servico}
          onChange={(e) =>
            atualizarLinhaAgendarCliente(indice, "servico", e.target.value)
          }
        >
          <option value="">Escolha o serviço</option>

          {meusServicos
            .filter((s) => s.ativo)
            .map((s) => (
              <option key={s.id} value={s.nome}>
                {iconeAtivo} {s.nome}{s.duracao ? ` - ⏰ ${s.duracao}` : ""}{s.valor ? ` - 💰 R$ ${s.valor}` : ""}
              </option>
            ))}
        </select>

        <label>Data</label>
        <input
          type="date"
          value={item.data}
          min={new Date().toLocaleDateString("sv-SE")}
          onChange={(e) =>
            atualizarLinhaAgendarCliente(indice, "data", e.target.value)
          }
        />

        {(!item.data ||
          (!diasFolga.includes(diaSemanaDaData(item.data)) &&
            !folgasDatas.includes(item.data))) && (
          <>
            <label>Horário</label>
            <select
              value={item.horario}
              onChange={(e) =>
                atualizarLinhaAgendarCliente(indice, "horario", e.target.value)
              }
            >
              <option value="">Escolha o horário</option>

              {(horariosPorLinhaAgendarCliente[indice] || []).map((hora) => (
                <option key={hora} value={hora}>
                  {hora}
                </option>
              ))}
            </select>
          </>
        )}

        {(() => {
          const horasServicio = duracaoHorasDeServicio(
            item.servico,
            meusServicos,
            profissionalLogado.id
          );
          const servicoDuracaoText = item.servico
            ? meusServicos.find(
                (s) => s.nome === item.servico && s.ativo
              )?.duracao
            : "";
          return item.servico && item.horario && horasServicio > 0 ? (
            <small className="duracao-info">
              ⏰ {servicoDuracaoText} — {item.horario} até{" "}
              {sumarHoras(item.horario, horasServicio)}
            </small>
          ) : null;
        })()}

        {item.data &&
          (horariosPorLinhaAgendarCliente[indice] || []).length === 0 && (
            <small
              style={
                diasFolga.includes(diaSemanaDaData(item.data)) ||
                folgasDatas.includes(item.data)
                  ? { color: "#dc2626", fontWeight: "bold" }
                  : undefined
              }
            >
              {diasFolga.includes(diaSemanaDaData(item.data)) ||
                folgasDatas.includes(item.data)
                ? "🚫 Este dia é folga. Ninguém pode agendar nele."
                : "Nenhum horário livre para este dia. Escolha outra data."}
            </small>
          )}

        <label>Frequência</label>
        <select
          value={item.frequencia || "mensal"}
          onChange={(e) =>
            atualizarLinhaAgendarCliente(indice, "frequencia", e.target.value)
          }
        >
          <option value="mensal">Mensal (todo mês)</option>
          <option value="semanal">Semanal (toda semana)</option>
        </select>

        <label>
          {item.frequencia === "semanal"
            ? "Repetir por quantas semanas?"
            : "Repetir por quantos meses?"}
        </label>
        <select
          value={item.meses}
          onChange={(e) => {
            const valor = Number(e.target.value);
            atualizarLinhaAgendarCliente(
              indice,
              "meses",
              Number.isNaN(valor) || valor < 1 ? 1 : valor
            );
          }}
        >
          {Array.from(
            { length: item.frequencia === "semanal" ? 52 : 12 },
            (_, i) => i + 1
          ).map((qtd) => (
            <option key={qtd} value={qtd}>
              {qtd === 1
                ? item.frequencia === "semanal"
                  ? "Somente esta semana"
                  : "Somente este mês"
                : item.frequencia === "semanal"
                ? `Repetir por ${qtd} semanas`
                : `Repetir por ${qtd} meses`}
            </option>
          ))}
        </select>

        {item.data && item.meses > 1 && (
          <small>
            Vai bloquear o mesmo{" "}
            {item.frequencia === "semanal"
              ? "dia da semana e horário"
              : "dia e horário"}{" "}
            em:{" "}
            {(item.frequencia === "semanal"
              ? datasParaSemanas(item.data, item.meses)
              : datasParaMeses(item.data, item.meses)
            )
              .map((dia) => formatarDataCompleta(dia))
              .join(", ")}
          </small>
        )}

        {indice > 0 && (
          <button
            type="button"
            className="linha-remover"
            onClick={() => removerLinhaAgendarCliente(indice)}
          >
            ✖ Remover este serviço
          </button>
        )}
      </div>
      ) : null
    )}

    <button
      type="button"
      className="linha-adicionar"
      onClick={adicionarLinhaAgendarCliente}
    >
      ➕ Adicionar outro serviço
    </button>

{/* Seletor de SERVIÇOS EM PROMOÇÃO — mesma coisa do cliente, mas dentro do
        formulário "Agendar por um cliente". Só mostra promoções ativas. */}
    {promocoesParaAgendarCliente.length > 0 && (
      <div className="promo-cliente">
        <h3>🎉 Serviços em promoção</h3>
        <p className="promo-cliente-dica">
          Escolha um serviço com preço de promoção (vale para este mês).
        </p>

        {linhasPromoAgendarCliente.length === 0 ? (
          <select
            className="promo-placeholder-select"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                adicionarLinhaPromoAgendarClienteComServico(e.target.value);
              }
            }}
          >
            <option value="">
              Escolha o serviço em promoção
            </option>

            {promocoesParaAgendarCliente.map((promo) => (
              <option
                key={promo.id}
                value={promo.servico}
              >
                {promo.servico}{promo.duracao ? ` - ⏰ ${promo.duracao}` : ""}{Number(promo.valor) > 0 ? ` - 💰 R$ ${promo.valor}` : ""}
              </option>
            ))}
          </select>
        ) : (
itensAgendarCliente.map((item, indice) =>
            item.em_promocao ? (
              <div key={indice} className="linha-servico promo-linha">
                <label>Serviço em promoção</label>

                <select
                  value={item.servico}
                  onChange={(e) => {
                    atualizarLinhaAgendarCliente(
                      indice,
                      "servico",
                      e.target.value
                    );
                  }}
                >
                  <option value="">
                    Escolha o serviço em promoção
                  </option>

                  {promocoesParaAgendarCliente.map((promo) => (
                    <option
                      key={promo.id}
                      value={promo.servico}
                    >
                      {promo.servico}{promo.duracao ? ` - ⏰ ${promo.duracao}` : ""}{Number(promo.valor) > 0 ? ` - 💰 R$ ${promo.valor}` : ""}
                    </option>
                  ))}
                </select>

                <label>Data</label>

                <input
                  type="date"
                  value={item.data}
                  min={new Date().toLocaleDateString("sv-SE")}
                  onChange={(e) =>
                    atualizarLinhaAgendarCliente(indice, "data", e.target.value)
                  }
                />

                <label>Horário</label>
                <select
                  value={item.horario}
                  disabled={
                    !item.data ||
                    !promocaoAtivaEm(
                      promocoes.find(
                        (promo) => Number(promo.id) === Number(item.promo_id)
                      ),
                      item.data
                    )
                  }
                  onChange={(e) =>
                    atualizarLinhaAgendarCliente(
                      indice,
                      "horario",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Escolha o horário
                  </option>

                  {(horariosPorLinhaAgendarCliente[indice] || []).map((hora) => (
                    <option
                      key={hora}
                      value={hora}
                    >
                      {hora}
                    </option>
                  ))}
                </select>
{(() => {
                  const promoInfo = item.promo_id
                    ? promocoes.find(
                        (p) => Number(p.id) === Number(item.promo_id)
                      )
                    : null;
                  const horasServicio = promoInfo?.duracao
                    ? parsearDuracaoHoras(promoInfo.duracao)
                    : duracaoHorasDeServicio(
                        item.servico,
                        meusServicos,
                        profissionalLogado.id
                      );
                  return item.servico && item.horario && horasServicio > 0 ? (
                    <small className="duracao-info">
                      ⏰ {promoInfo?.duracao || ""} — {item.horario} até{" "}
                      {sumarHoras(item.horario, horasServicio)}
                    </small>
                  ) : null;
                })()}

                {(() => {
                  if (item.data && item.promo_id) {
                    const promoInfo = promocoes.find(
                      (p) => Number(p.id) === Number(item.promo_id)
                    );
                    if (promoInfo && !promocaoAtivaEm(promoInfo, item.data)) {
                      return (
                        <small
                          style={{
                            display: "block",
                            color: "#dc2626",
                            fontWeight: "bold",
                            marginTop: "6px",
                          }}
                        >
                          🚫 Esta promoção só vale em:{" "}
                          {diasDaPromocao(promoInfo).join(", ")}. Escolha uma
                          data permitida.
                        </small>
                      );
                    }
                  }
                  return null;
                })()}

                {item.data &&
                  (horariosPorLinhaAgendarCliente[indice] || []).length === 0 && (
                    <small
                      style={
                        diasFolga.includes(diaSemanaDaData(item.data)) ||
                        folgasDatas.includes(item.data)
                          ? { color: "#dc2626", fontWeight: "bold" }
                          : undefined
                      }
                    >
                      {diasFolga.includes(diaSemanaDaData(item.data)) ||
                      folgasDatas.includes(item.data)
                        ? "🚫 Este dia é folga. Ninguém pode agendar nele."
                        : item.promo_id &&
                          !promocaoAtivaEm(
                            promocoes.find(
                              (promo) =>
                                Number(promo.id) === Number(item.promo_id)
                            ),
                            item.data
                          )
                        ? <span style={{ color: "#dc2626", fontWeight: "bold" }}>🚫 Esta promoção não está disponível nesta data. Escolha uma data permitida.</span>
                        : "Nenhum horário livre para este dia. Escolha outra data."}
                    </small>
                  )}

                {linhasPromoAgendarCliente.length > 1 && (
                  <button
                    type="button"
                    className="linha-remover"
                    onClick={() => removerLinhaPromoAgendarCliente(indice)}
                  >
                    ✖ Remover esta promoção
                  </button>
                )}
              </div>
            ) : null
          )
        )}

        {linhasPromoAgendarCliente.length > 0 && (
          <button
            type="button"
            className="linha-adicionar"
            onClick={adicionarLinhaPromoAgendarCliente}
          >
            ➕ Adicionar outro serviço em promoção
          </button>
        )}
      </div>
    )}
    <button
      onClick={enviarPedidoAgendarCliente}
    >
      ✓ Confirmar agendamento
    </button>

    <button
      className="agendar-cliente-cancelar"
      onClick={() => {
        setMostrarAgendarCliente(false);
        setMensagemAgendarCliente("");
        setTipoMensagemAgendarCliente("");
      }}
    >
      ❌ Cancelar
    </button>
  </div>
)}

<button
className="btn-config-principal"
onClick={() =>
setMostrarConfiguracoes(!mostrarConfiguracoes)
}
>
⚙️ Configurações
</button>

{mostrarConfiguracoes && (
<div>

<div className="config-abas">
  <button
    className={abaConfiguracoes === "perfil" ? "config-aba ativa" : "config-aba"}
    onClick={() => setAbaConfiguracoes("perfil")}
  >
    👤 Perfil
  </button>
  <button
    className={abaConfiguracoes === "servicos" ? "config-aba ativa" : "config-aba"}
    onClick={() => setAbaConfiguracoes("servicos")}
  >
    📋 Serviços
  </button>
  <button
    className={abaConfiguracoes === "horarios" ? "config-aba ativa" : "config-aba"}
    onClick={() => setAbaConfiguracoes("horarios")}
  >
    ⏰ Horários
  </button>
  <button
    className={abaConfiguracoes === "notificacoes" ? "config-aba ativa" : "config-aba"}
    onClick={() => setAbaConfiguracoes("notificacoes")}
  >
    🔔 Notificações
  </button>
</div>

{abaConfiguracoes === "notificacoes" && (
  <div className="config-servicos">
    <h3>🔔 Alertas de agendamento</h3>
    <p>
      Ative os alertas de agendamento neste {Capacitor.isNativePlatform() ? "aplicativo" : "navegador"}
      {" "}para receber avisos de novos agendamentos.
    </p>
    <p role="status" aria-live="polite">
      {pushConfigurado
        ? "Este dispositivo está registrado para receber notificações Push."
        : notificacoesAtivas
        ? "Permissão concedida; aguardando confirmar o registro Push no servidor."
        : "Notificações ainda não estão ativadas neste dispositivo."}
    </p>
    <button type="button" onClick={ativarNotificacoes} disabled={pushConfigurado}>
      {notificacoesAtivas ? "🔄 Registrar este dispositivo novamente" : "🔔 Ativar notificações"}
    </button>
    {notificacoesAtivas && (
      <button type="button" onClick={desativarNotificacoes}>
        Desativar neste dispositivo
      </button>
    )}
    {mensagemNotificacaoSistema && (
      <p role="status" aria-live="polite">{mensagemNotificacaoSistema}</p>
    )}
    {!pushConfigurado && (
      <p>
        Para concluir o Push, o administrador ainda precisa configurar no
        Supabase a migração de notificações e os segredos do Firebase/VAPID.
      </p>
    )}
  </div>
)}

{abaConfiguracoes === "perfil" && (
<div className="config-servicos config-ordenado">

<h4 className="config-subtitulo" style={{ order: 1 }}>⚙️ Outros ajustes</h4>



<div className="link-profissional">
  <p>📅 Link de agendamento — para o cliente agendar</p>
  <button
    style={{
      padding:"12px",
      marginLeft:"0px",
      background: temaConfig.primary,
      color:"white",
      border:"none",
      borderRadius:"12px",
      cursor:"pointer",
      width:"100%"
    }}
    onClick={async () => {
      const link = gerarLinkProfissional(profissionalLogado?.id);
      try {
        await copiarTexto(link);
        alert("Link de agendamento copiado!");
      } catch (err) {
        console.error("Falha ao copiar o link de agendamento:", err);
        window.prompt("Copie o link de agendamento:", link);
      }
    }}
  >
    📋 Copiar link de agendamento
  </button>
</div>

<div className="saldo-config" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
      <button
        style={{
          padding: "12px",
          background: saldoHabilitado ? "#d32f2f" : temaConfig.primary,
          color: "white",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          width: "100%"
        }}
        onClick={() => {
          const novo = !saldoHabilitado;
          setSaldoHabilitado(novo);
          localStorage.setItem(
            `saldo_habilitado_${profissionalLogado?.id}`,
            novo ? "1" : "0"
          );
        }}
      >
        {saldoHabilitado
          ? "🚫 Desativar saldo de trabalhos"
          : "💰 Ativar saldo de trabalhos"}
      </button>
      {saldoHabilitado && (
        <button
          style={{
            padding: "12px",
            background: "transparent",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "20px",
            lineHeight: 1
          }}
          onClick={() => setMostrarSaldo(!mostrarSaldo)}
          title={mostrarSaldo ? "Ocultar saldo" : "Mostrar saldo"}
        >
          {mostrarSaldo ? "🙈" : "👁️"}
        </button>
      )}
    </div>
    <small className="dica-dias-agendados">
      Mostra quantos trabalhos foram concluídos por período (diário, semanal, quinzenal, mensal).
    </small>
  </div>

<div className="saldo-config" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
      <button
        style={{
          padding: "12px",
          background: exigirAprovacaoDezembro ? "#d32f2f" : temaConfig.primary,
          color: "white",
          border: "none",
          borderRadius: "12px",
          cursor: "pointer",
          width: "100%"
        }}
        onClick={async () => {
          const novo = !exigirAprovacaoDezembro;
          const { error } = await supabase
            .from("profissionais")
            .update({ exigir_aprovacao_dezembro: novo })
            .eq("id", profissionalLogado.id);

          if (error) {
            console.error(error);
            alert(
              "Não consegui salvar. Rode no SQL do Supabase: " +
              "ALTER TABLE profissionais ADD COLUMN exigir_aprovacao_dezembro boolean NOT NULL DEFAULT true;"
            );
            return;
          }

          setProfissionalLogado((prev) => ({
            ...prev,
            exigir_aprovacao_dezembro: novo,
          }));
          setMensagemProfissional(
            novo
              ? "⏳ Dezembro: clientes precisarão da sua aprovação para agendar."
              : "✅ Dezembro: clientes agendam direto, sem precisar de aprovação."
          );
        }}
      >
        {exigirAprovacaoDezembro
          ? "🚫 Desativar exigência de aprovação em dezembro"
          : "⏳ Exigir aprovação para agendamentos de dezembro"}
      </button>
    </div>
    <small className="dica-dias-agendados">
      Com a exigência ativa, pedidos de dezembro ficam como "Pendente (aguardando aprovação)" até você aprovar ou recusar na agenda.
    </small>
  </div>

<div className="saldo-config" style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--cor-borda)", borderRadius: "16px", padding: "12px", background: "var(--fundo)" }}>
  {(!profissionalLogado?.ativo && planoExpirado(profissionalLogado)) && (
    <div style={{ background: "#fee2e2", border: "1px solid #ef4444", borderRadius: "12px", padding: "12px", marginBottom: "12px" }}>
      <p style={{ margin: "0 0 8px 0", color: "#991b1b", fontWeight: "bold" }}>
        🚫 Seu perfil foi DESATIVADO
      </p>
      <p style={{ margin: "0 0 8px 0", color: "#991b1b", fontSize: "14px" }}>
        O seu plano expirou e o administrador desativou a versão gratuita do sistema.
      </p>
      <p style={{ margin: "0", color: "#991b1b", fontSize: "14px" }}>
        Entre em contato com o administrador para contratar um novo plano e reativar sua conta.
      </p>
    </div>
  )}
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
    {profissionalLogado?.plano_ilimitado ? (
      <p className="plano-status plano-status-permanente" style={{ margin: 0 }}>
        ♾️ Seu plano é permanente
      </p>
    ) : validadePlanoMs(profissionalLogado) == null ? (
      <p className="plano-status plano-status-sem-plano" style={{ margin: 0 }}>
        ❌ Seu perfil ainda não tem plano de uso. Fale com o administrador.
      </p>
    ) : (
      <p
        className={`plano-status ${
          diasRestantesPlano(profissionalLogado) > 0
            ? "plano-status-valido"
            : "plano-status-expirado"
        }`}
        style={{ margin: 0 }}
      >
        {diasRestantesPlano(profissionalLogado) > 0
          ? `📅 Seu plano tem ${diasRestantesPlano(profissionalLogado)} dia${
              diasRestantesPlano(profissionalLogado) === 1 ? "" : "s"
            } restante${diasRestantesPlano(profissionalLogado) === 1 ? "" : "s"}`
          : "⚠️ Seu plano expirou — fale com o administrador"}
      </p>
    )}
  </div>
  {!profissionalLogado?.plano_ilimitado && validadePlanoMs(profissionalLogado) != null && (
    <small className="dica-dias-agendados">
      📅 Vence em: {formatarDataPlano(profissionalLogado)} — {versaoGratuitaHabilitada ? "quando o prazo chegar a zero, a conta vai para versão gratuita com anúncios." : "se o prazo chegar a zero e a versão gratuita estiver desabilitada, sua conta será desativada."}
    </small>
  )}
</div>

<div className="tema-configuracao">
  <label>Cor do perfil</label>
  <div>
    <select
      value={temaSelecionado}
      onChange={(e) => {
        setTemaSelecionado(e.target.value);
        setCorMensagem("");
      }}
    >
      {themeOptions.map((tema) => (
        <option key={tema.value} value={tema.value}>
          {tema.label}
        </option>
      ))}
    </select>
    <button
      onClick={async () => {
        if (!profissionalLogado?.id) return;

        const { error } = await supabase
          .from("profissionais")
          .update({ tema: temaSelecionado })
          .eq("id", profissionalLogado.id);

        if (error) {
          console.error(error);
          setCorMensagem("❌ Erro ao salvar a cor do perfil.");
          setCorMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          tema: temaSelecionado,
        });

        setCorMensagem("✅ Cor atualizada com sucesso!");
        setCorMensagemTipo("sucesso");
      }}
    >
      Salvar cor
    </button>

    {corMensagem && (
      <p
        style={{
          color: corMensagemTipo === "erro" ? "red" : "green",
          margin: "10px 0 0",
          fontWeight: "bold",
        }}
      >
        {corMensagem}
      </p>
    )}
  </div>
</div>

<div className="tema-configuracao">
  <label>Ícone do perfil</label>
  <div>
    <select
      value={iconeSelecionado}
      onChange={(e) => {
        setIconeSelecionado(e.target.value);
        setIconeMensagem("");
      }}
    >
      {iconOptions.map((icone) => (
        <option key={icone.value} value={icone.value}>
          {icone.value} {icone.label}
        </option>
      ))}
    </select>
    <button
      onClick={async () => {
        if (!profissionalLogado?.id) return;

        const { error } = await supabase
          .from("profissionais")
          .update({ icone: iconeSelecionado })
          .eq("id", profissionalLogado.id);

        if (error) {
          console.error(error);
          setIconeMensagem("❌ Erro ao salvar o ícone do perfil.");
          setIconeMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          icone: iconeSelecionado,
        });

        setIconeMensagem("✅ Ícone atualizado com sucesso!");
        setIconeMensagemTipo("sucesso");
      }}
    >
      Salvar ícone
    </button>

    {iconeMensagem && (
      <p
        style={{
          color: iconeMensagemTipo === "erro" ? "red" : "green",
          margin: "10px 0 0",
          fontWeight: "bold",
        }}
      >
        {iconeMensagem}
      </p>
    )}
  </div>
</div>

<div className="tema-configuracao pix-configuracao">
  <label>💠 Pix para pagamento</label>
  <div className="pix-campos">
    <input
      type="text"
      placeholder="Chave Pix (celular, CPF ou email)"
      value={pixChave}
      maxLength="50"
      onChange={(e) => {
        setPixChave(e.target.value);
        setPixMensagem("");
      }}
    />
    <input
      type="text"
      list="lista-bancos"
      placeholder="Banco (ex.: Nubank, Itaú...)"
      value={pixBanco}
      maxLength="30"
      onChange={(e) => {
        setPixBanco(e.target.value);
        setPixMensagem("");
      }}
    />
    <input
      type="text"
      placeholder="Nome do titular (opcional)"
      value={pixNome}
      maxLength="30"
      onChange={(e) => {
        setPixNome(e.target.value);
        setPixMensagem("");
      }}
    />
    <datalist id="lista-bancos">
      {[
        "Nubank",
        "Itaú",
        "Bradesco",
        "Banco do Brasil",
        "Caixa",
        "Santander",
        "Banco Inter",
        "Mercado Pago",
        "PicPay",
        "PagBank",
      ].map((banco) => (
        <option key={banco} value={banco} />
      ))}
    </datalist>
  </div>
  <div>
    <button
      onClick={async () => {
        if (!profissionalLogado?.id) return;

        const chaveLimpa = pixChave.trim();
        const bancoLimpo = pixBanco.trim();
        const nomeLimpo = pixNome.trim();

        const { error } = await supabase
          .from("profissionais")
          .update({
            chave_pix: chaveLimpa,
            banco_pix: bancoLimpo,
            nome_pix: nomeLimpo,
          })
          .eq("id", profissionalLogado.id);

        if (error) {
          console.error(error);
          setPixMensagem("❌ Erro ao salvar o PIX: " + error.message);
          setPixMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          chave_pix: chaveLimpa,
          banco_pix: bancoLimpo,
          nome_pix: nomeLimpo,
        });

        setPixMensagem("✅ Pix salvo com sucesso!");
        setPixMensagemTipo("sucesso");
      }}
    >
      Salvar PIX
    </button>

    {pixMensagem && (
      <p
        style={{
          color: pixMensagemTipo === "erro" ? "red" : "green",
          margin: "10px 0 0",
          fontWeight: "bold",
        }}
      >
        {pixMensagem}
      </p>
    )}
  </div>
</div>

<div className="tema-configuracao endereco-configuracao">
  <label>📍 Endereço do local</label>
  <div className="pix-campos">
    <input
      type="text"
      placeholder="Nome da rua"
      value={enderecoRua}
      maxLength="60"
      onChange={(e) => {
        setEnderecoRua(e.target.value);
        setEnderecoMensagem("");
      }}
    />
    <input
      type="text"
      placeholder="Número"
      value={enderecoNumero}
      maxLength="10"
      onChange={(e) => {
        setEnderecoNumero(e.target.value);
        setEnderecoMensagem("");
      }}
    />
    <input
      type="text"
      placeholder="CEP"
      value={enderecoCep}
      maxLength="10"
      onChange={(e) => {
        setEnderecoCep(e.target.value);
        setEnderecoMensagem("");
      }}
    />
  </div>
  <label className="endereco-mostrar-label">
    <input
      type="checkbox"
      checked={mostrarEndereco}
      onChange={(e) => {
        setMostrarEndereco(e.target.checked);
        setEnderecoMensagem("");
      }}
    />
    Mostrar endereço na página de agendamento do cliente
  </label>
  <h4>Horário de funcionamento</h4>
  <div className="pix-campos">
    <label>
      Das
      <input
        type="time"
        value={horarioFuncionamentoInicio}
        onChange={(e) => {
          setHorarioFuncionamentoInicio(e.target.value);
          setEnderecoMensagem("");
        }}
      />
    </label>
    <label>
      às
      <input
        type="time"
        value={horarioFuncionamentoFim}
        onChange={(e) => {
          setHorarioFuncionamentoFim(e.target.value);
          setEnderecoMensagem("");
        }}
      />
    </label>
  </div>
  <label className="endereco-mostrar-label">
    <input
      type="checkbox"
      checked={mostrarHorarioFuncionamento}
      onChange={(e) => {
        setMostrarHorarioFuncionamento(e.target.checked);
        setEnderecoMensagem("");
      }}
    />
    Mostrar horário de funcionamento na página de agendamento do cliente
  </label>
  <p style={{ margin: "10px 0 6px" }}>
    Dias informados no perfil do cliente (não alteram os agendamentos):
  </p>
  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px" }}>
    {diasSemana.map((dia) => (
      <label key={dia} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <input
          type="checkbox"
          checked={diasAtendimentoPerfil.includes(dia)}
          onChange={(e) => {
            setDiasAtendimentoPerfil((diasAtuais) =>
              e.target.checked
                ? [...diasAtuais, dia]
                : diasAtuais.filter((item) => item !== dia)
            );
            setEnderecoMensagem("");
          }}
        />
        {dia.charAt(0).toUpperCase() + dia.slice(1)}
      </label>
    ))}
  </div>
  <div>
    <button
      onClick={async () => {
        if (!profissionalLogado?.id) return;

        const ruaLimpa = enderecoRua.trim();
        const numeroLimpo = enderecoNumero.trim();
        const cepLimpo = enderecoCep.trim();

        const { error } = await supabase
          .from("profissionais")
          .update({
            endereco_rua: ruaLimpa,
            endereco_numero: numeroLimpo,
            endereco_cep: cepLimpo,
            mostrar_endereco: mostrarEndereco,
            horario_funcionamento_inicio: horarioFuncionamentoInicio || null,
            horario_funcionamento_fim: horarioFuncionamentoFim || null,
            mostrar_horario_funcionamento: mostrarHorarioFuncionamento,
            dias_atendimento_perfil: diasAtendimentoPerfil,
          })
          .eq("id", profissionalLogado.id);

        if (error) {
          console.error(error);
          setEnderecoMensagem("❌ Erro ao salvar o endereço e horário: " + error.message);
          setEnderecoMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          endereco_rua: ruaLimpa,
          endereco_numero: numeroLimpo,
          endereco_cep: cepLimpo,
          mostrar_endereco: mostrarEndereco,
          horario_funcionamento_inicio: horarioFuncionamentoInicio || null,
          horario_funcionamento_fim: horarioFuncionamentoFim || null,
          mostrar_horario_funcionamento: mostrarHorarioFuncionamento,
          dias_atendimento_perfil: diasAtendimentoPerfil,
        });

        setEnderecoMensagem("✅ Endereço e horário salvos com sucesso!");
        setEnderecoMensagemTipo("sucesso");
      }}
    >
      Salvar endereço e horário
    </button>

    {enderecoMensagem && (
      <p
        style={{
          color: enderecoMensagemTipo === "erro" ? "red" : "green",
          margin: "10px 0 0",
          fontWeight: "bold",
        }}
      >
        {enderecoMensagem}
      </p>
    )}
  </div>
</div>
</div>
)}

{abaConfiguracoes === "servicos" && (
<div>
<h3>📋 Configurar serviços</h3>

<input
placeholder="Nome do serviço"
value={novoServico}
onChange={(e) =>
setNovoServico(e.target.value)
}
/>
<input
placeholder="Valor"
type="number"
value={novoValor}
onChange={(e) =>
setNovoValor(e.target.value)
}
/>

<input
placeholder="Duração (ex: 1 hora)"
value={novaDuracao}
onChange={(e) =>
setNovaDuracao(e.target.value)
}
/>

<label className="promo-criar-check">
  <input
    type="checkbox"
    checked={promoAoCriarServico}
    onChange={(e) => setPromoAoCriarServico(e.target.checked)}
  />
  💲 Já colocar este serviço em promoção? <strong>(Sim/Não)</strong>
</label>

<button
onClick={async () => {
if (!novoServico.trim()) {
  alert("Digite o nome do serviço.");
  return;
}

const criarPromo = promoAoCriarServico;

let erroCriacao = null;
try {
  await cat.servCriar({
    nome: novoServico,
    valor: novoValor || null,
    duracao: novaDuracao || null,
  });
} catch (error) {
  erroCriacao = error;
}


if(erroCriacao){
console.error(erroCriacao);
alert("Erro ao criar serviço: " + msgErroCatalogo(erroCriacao));
return;
}


const { data: novosServicos } = await supabase
.from("servicos")
.select("*")
.order("nome");


setServicos(novosServicos);
setMeusServicos(
  novosServicos.filter(
    (item) => item.profissional_id === profissionalLogado.id
  )
);


setNovoServico("");
setNovoValor("");
setNovaDuracao("");
setPromoAoCriarServico(false);

if (criarPromo) {
  // Já cria a promoção do mesmo serviço (fica no seletor de promoções).
  let novaPromo = null;
  let erroPromo = null;
  try {
    novaPromo = await cat.promoCriar({
      servico: novoServico,
      valor: novoValor || 0,
      duracao: novaDuracao || "",
    });
  } catch (error) {
    erroPromo = error;
  }

  if (erroPromo) {
    console.error(erroPromo);
    alert(
      "Serviço criado, mas não consegui colocar na promoção: " +
        msgErroCatalogo(erroPromo)
    );
    return;
  }

  setPromocoes((prev) => [novaPromo, ...prev]);
  alert(
    "Serviço criado e JÁ está no seletor de promoções! 🎉 Configure os meses na seção Promoções abaixo."
  );
} else {
  alert("Serviço criado!");
}

}}
>
Adicionar serviço
</button>
<h3>📋 Serviços cadastrados</h3>

<div className="abas-servicos">
  <button
    type="button"
    className={abaServicos === "normais" ? "aba-servico ativa" : "aba-servico"}
    onClick={() => setAbaServicos("normais")}
  >
    🗂️ Serviços normais
  </button>
  <button
    type="button"
    className={abaServicos === "promocao" ? "aba-servico ativa" : "aba-servico"}
    onClick={() => setAbaServicos("promocao")}
  >
    💲 Em promoção ({minhasPromocoes.length})
  </button>
</div>

{abaServicos === "promocao" && minhasPromocoes.length === 0 && (
  <p className="dica-dias-agendados">
    Nenhum serviço em promoção ainda. Clique no 💲 dentro do card de um
    serviço na aba "Serviços normais" para colocá-lo em promoção.
  </p>
)}

{meusServicos
  .filter((item) =>
    abaServicos === "promocao"
      ? minhasPromocoes.some((p) => p.servico === item.nome)
      : !minhasPromocoes.some((p) => p.servico === item.nome)
  )
  .map((item) => (
  <div key={item.id} className="servico-card" style={{ opacity: item.ativo ? 1 : 0.5, background: item.ativo ? "#ffffff" : "#f5f5f5" }}>

  {servicoEditandoId === item.id ? (
    <div className="servico-editar">
      <p><strong>✏️ Editando: {item.nome}</strong></p>

      <input
        placeholder="Nome do serviço"
        value={editaNome}
        onChange={(e) => setEditaNome(e.target.value)}
      />

      <input
        placeholder="Valor"
        type="number"
        value={editaValor}
        onChange={(e) => setEditaValor(e.target.value)}
      />

      <input
        placeholder="Duração (ex: 1 hora)"
        value={editaDuracao}
        onChange={(e) => setEditaDuracao(e.target.value)}
      />

      <button
        onClick={async () => {
          if (!editaNome.trim()) {
            alert("Digite o nome do serviço.");
            return;
          }

          let erroEdicao = null;
          try {
            await cat.servAtualizar(item.id, {
              nome: editaNome,
              valor: editaValor || null,
              duracao: editaDuracao || null,
            });
          } catch (error) {
            erroEdicao = error;
          }

          if (erroEdicao) {
            console.error(erroEdicao);
            alert("Erro ao editar serviço: " + msgErroCatalogo(erroEdicao));
            return;
          }

          const atualizado = {
            ...item,
            nome: editaNome,
            valor: editaValor || null,
            duracao: editaDuracao || null,
          };

          setMeusServicos(prev =>
            prev.map((servico) =>
              servico.id === item.id ? atualizado : servico
            )
          );

          setServicos(prev =>
            prev.map((servico) =>
              servico.id === item.id ? atualizado : servico
            )
          );

          setServicoEditandoId(null);
          alert("Serviço atualizado!");
        }}
      >
        💾 Salvar alterações
      </button>

      <button
        style={{ marginLeft: "8px", background: "#6b7280" }}
        onClick={() => setServicoEditandoId(null)}
      >
        ❌ Cancelar
      </button>
    </div>
  ) : (
  <div>
<p>
  {iconeAtivo} {item.nome}{!item.ativo && " (Inativo)"}
</p>

<p>
  💰 R$ {item.valor ?? 0}
</p>

<p>
  ⏰ {item.duracao || "—"}
</p>

    <button
      onClick={() => alternarPromocaoDoServico(item)}
      style={{
        marginTop: "8px",
        background: minhasPromocoes.some((p) => p.servico === item.nome)
          ? "#d97706"
          : "linear-gradient(135deg, var(--cor-secundaria), var(--cor-primaria))",
      }}
    >
      {minhasPromocoes.some((p) => p.servico === item.nome)
        ? "💲 Está em promoção (clique p/ remover)"
        : "💲 Colocar em promoção"}
    </button>

    <button
      onClick={() => {
        setServicoEditandoId(item.id);
        setEditaNome(String(item.nome || ""));
        setEditaValor(
          item.valor === null || item.valor === undefined
            ? ""
            : String(item.valor)
        );
        setEditaDuracao(String(item.duracao || ""));
      }}
    >
      ✏️ Editar
    </button>

    <button
      style={{ marginLeft: "8px" }}
      onClick={async () => {

        if (item.ativo) {
          let erroStatus = null;
          try {
            await cat.servAtualizar(item.id, { ativo: false });
          } catch (error) {
            erroStatus = error;
          }

          if(erroStatus){
            console.error(erroStatus);
            alert("Erro ao desativar serviço: " + msgErroCatalogo(erroStatus));
            return;
          }

          setMeusServicos(prev => 
            prev.map((servico) => 
              servico.id === item.id ? { ...servico, ativo: false } : servico
            )
          );

          setServicos(prev => 
            prev.map((servico) => 
              servico.id === item.id ? { ...servico, ativo: false } : servico
            )
          );

          alert("Serviço desativado!");
        } else {
          let erroStatus = null;
          try {
            await cat.servAtualizar(item.id, { ativo: true });
          } catch (error) {
            erroStatus = error;
          }

          if(erroStatus){
            console.error(erroStatus);
            alert("Erro ao reativar serviço: " + msgErroCatalogo(erroStatus));
            return;
          }

          setMeusServicos(prev => 
            prev.map((servico) => 
              servico.id === item.id ? { ...servico, ativo: true } : servico
            )
          );

          setServicos(prev => 
            prev.map((servico) => 
              servico.id === item.id ? { ...servico, ativo: true } : servico
            )
          );

          alert("Serviço reativado!");
        }

      }}
    >
      {item.ativo ? "🗑️ Desativar" : "♻️ Reativar"}
    </button>

    <button
      style={{ marginLeft: "8px", background: "#d32f2f" }}
      onClick={async () => {
        let erroExclusao = null;
        try {
          await cat.servExcluir(item.id);
        } catch (error) {
          erroExclusao = error;
        }

        if(erroExclusao){
          console.error(erroExclusao);
          alert("Erro ao excluir: " + msgErroCatalogo(erroExclusao) + "\n\nProvavelmente há agendamentos vinculados. Use 'Desativar' em vez de excluir.");
          return;
        }

        setMeusServicos(prev => prev.filter(s => s.id !== item.id));

        setServicos(prev =>
          prev.filter(s => s.id !== item.id)
        );

        alert("Serviço excluído permanentemente!");
      }}
    >
      🗑️ Excluir
    </button>

  </div>
  )}

</div>
  ))}
  <div className="config-promocoes">
    <h3>🎉 Promoções do mês</h3>
    <p className="dica-dias-agendados">
      Clique no <strong>💲</strong> de um serviço para ele entrar no seletor
      de promoções do cliente. Depois escolha os meses, o valor e a duração.
      Você pode ativar/desativar cada promoção por mês ou por semana.
    </p>

    <button
      onClick={alternarSeletorPromocoes}
      style={{
        padding: "12px",
        background:
          profissionalLogado?.seletor_promocoes_habilitado === false
            ? "#16a34a"
            : "#d32f2f",
        color: "white",
        border: "none",
        borderRadius: "12px",
        cursor: "pointer",
        width: "100%",
      }}
    >
      {profissionalLogado?.seletor_promocoes_habilitado === false
        ? "🎉 Ativar seletor de promoções"
        : "🚫 Desativar seletor de promoções"}
    </button>
    <small className="dica-dias-agendados">
      Com o seletor ativo, o cliente vê a opção "Serviços em promoção" embaixo
      dos serviços normais.
    </small>

    {mensagemPromo && (
      <p
        style={{
          marginTop: "10px",
          color: mensagemPromoTipo === "erro" ? "red" : "green",
          fontWeight: "bold",
        }}
      >
        {mensagemPromo}
      </p>
    )}

    <h4>💲 Serviços em promoção</h4>

    {minhasPromocoes.length === 0 && (
      <p className="dica-dias-agendados">
        Nenhum serviço em promoção ainda. Clique no 💲 dentro do card de um
        serviço lá em cima.
      </p>
    )}

    {minhasPromocoes.map((promo) => (
      <div
        key={promo.id}
        className="servico-card promo-card"
        style={{ opacity: promo.ativo ? 1 : 0.6 }}
      >
        {promoEditandoId === promo.id ? (
          <div className="promo-editar">
            <p>
              <strong>✏️ Editando promoção: {promo.servico}</strong>
            </p>

            <input
              placeholder="Valor da promoção"
              type="number"
              value={promoEditValor}
              onChange={(e) => setPromoEditValor(e.target.value)}
            />
            <input
              placeholder="Duração (ex: 1 hora)"
              value={promoEditDuracao}
              onChange={(e) => setPromoEditDuracao(e.target.value)}
            />

            <label className="promo-ativo-label">
              <input
                type="checkbox"
                checked={promoEditAtivo}
                onChange={(e) => setPromoEditAtivo(e.target.checked)}
              />
              Promoção ativa
            </label>

            <p className="promo-meses-titulo">
              📅 Vale em quais meses? (dentro de cada mês, escolha as semanas)
            </p>
            <div className="promo-meses-grade">
              {NOMES_MESES.map((nome, i) => {
                const mes = i + 1;
                const marcado = Boolean(promoEditMeses[mes]);
                return (
                  <div
                    key={mes}
                    className={`promo-mes${marcado ? " ativo" : ""}`}
                  >
                    <label className="promo-mes-label">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarMesPromo(mes)}
                      />
                      {nome}
                    </label>
                    {marcado && (
                      <div className="promo-semanas">
                        {[1, 2, 3, 4, 5].map((semana) => {
                          const lista = Array.isArray(
                            promoEditSemanas[String(mes)]
                          )
                            ? promoEditSemanas[String(mes)]
                            : [true, true, true, true, true];
                          return (
                            <label key={semana} className="promo-semana">
                              <input
                                type="checkbox"
                                checked={lista[semana - 1] !== false}
                                onChange={() => alternarSemanaPromo(mes, semana)}
                              />
                              {semana}ª
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="promo-meses-titulo">
              📅 Em quais dias da semana vale? (nada marcado = todos os dias)
            </p>
            <div className="promo-dias-grade">
              {diasSemanaPorIndice.map((nome, i) => {
                const marcado = Boolean(promoEditDias[i]);
                return (
                  <label
                    key={i}
                    className={`promo-dia${marcado ? " ativo" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternarDiaPromo(i)}
                    />
                    {nome.charAt(0).toUpperCase() + nome.slice(1)}
                  </label>
                );
              })}
            </div>

            <button
              style={{
                width: "100%",
                marginBottom: "8px",
                background: "#7c3aed",
              }}
              onClick={aplicarAgendaParaTodasPromocoes}
            >
              📋 Aplicar estes dias/semanas/meses em TODAS as outras promoções
            </button>

            <button onClick={salvarPromocao}>💾 Salvar promoção</button>
            <button
              style={{ marginLeft: "8px", background: "#6b7280" }}
              onClick={cancelarEdicaoPromocao}
            >
              ❌ Cancelar
            </button>
          </div>
        ) : (
          <div>
            <p>
              {promo.ativo ? "🟢 Ativa" : "⚪ Desativada"} — {promo.servico}
            </p>
            <p>💰 R$ {promo.valor ?? 0}</p>
            <p>⏰ {promo.duracao || "—"}</p>
            <p>
              📅{" "}
              {mesesDaPromocao(promo).length > 0
                ? mesesDaPromocao(promo).join(", ")
                : "Nenhum mês selecionado"}
            </p>
            <p>
              📅 Dias:{" "}
              {diasDaPromocao(promo).length > 0
                ? diasDaPromocao(promo).join(", ")
                : "Todos os dias"}
            </p>
            <p>
              🗓️{" "}
              {promocaoAtivaEm(promo, undefined, {
                ignorarDiaSemana: true,
              })
                ? "Ativa para o mês/semana atual"
                : "Fora do período atual"}
            </p>
            <button onClick={() => iniciarEdicaoPromocao(promo)}>
              ✏️ Editar
            </button>
            <button
              style={{ marginLeft: "8px", background: "#d32f2f" }}
              onClick={() => excluirPromocao(promo)}
            >
              🗑️ Excluir
            </button>
            <button
              style={{
                marginLeft: "8px",
                background: promo.ativo ? "#d32f2f" : "#16a34a",
              }}
              onClick={() => alternarAtivoPromocao(promo)}
            >
              {promo.ativo ? "🚫 Desativar" : "▶ Ativar"}
            </button>
          </div>
        )}
      </div>
    ))}
  </div>

</div>

)}

{abaConfiguracoes === "horarios" && (

<div className={`config-horarios${diasFolga.includes(diaSelecionado) ? " dia-folga-ativo" : ""}`}>

<h3>⏰ Meus horários de atendimento</h3>


<h4>Escolha o dia da semana:</h4>

<select
value={diaSelecionado}
onChange={async (e)=>{

const novoDia = e.target.value;

setDiaSelecionado(novoDia);
setCopiarHorariosMensagem("");


const { data: resultado, error } = await supabase
.from("horarios_trabalho")
.select("*")
.eq("profissional_id", profissionalLogado.id)
.eq("dia_semana", novoDia);


if(error){
console.error(error);
return;
}


setHorariosTrabalho(
  resultado
    .filter((item) => item.horario !== "FOLGA")
    .map((item) => item.horario.slice(0,5))
);


}}

>

{diasSemana.map((dia)=>(

<option
key={dia}
value={dia}
>

{dia}{diasFolga.includes(dia) ? " 🚫" : ""}

</option>

))}

</select>



<h4>🚫 Dias de folga</h4>

<p className="dica-folga">
  Marque os dias em que ninguém poderá agendar. O dia fica todo bloqueado.
</p>

<div className="dias-folga-grade">

  {diasSemana.map((dia) => {

    const ehFolga = diasFolga.includes(dia);

    return (

      <label
        key={dia}
        className={ehFolga ? "dia-folga-ativo" : ""}
      >

        <input
          type="checkbox"
          checked={ehFolga}
          onChange={async (e) => {

            const marcado = e.target.checked;

            if (marcado) {

              const { error } = await supabase
                .from("horarios_trabalho")
                .insert([
                  {
                    profissional_id: profissionalLogado.id,
                    dia_semana: dia,
                    horario: "FOLGA",
                  },
                ]);

              if (error) {
                console.error(error);
                alert("Erro ao marcar o dia de folga: " + error.message);
                return;
              }

              setDiasFolga((prev) => [...prev, dia]);

            } else {

              const { error } = await supabase
                .from("horarios_trabalho")
                .delete()
                .eq("profissional_id", profissionalLogado.id)
                .eq("dia_semana", dia)
                .eq("horario", "FOLGA");

              if (error) {
                console.error(error);
                alert("Erro ao remover o dia de folga: " + error.message);
                return;
              }

              setDiasFolga((prev) => prev.filter((item) => item !== dia));

            }

          }}
        />

        {dia.charAt(0).toUpperCase() + dia.slice(1)}

      </label>

    );

  })}

</div>

<h4>🗓️ Folgas em datas específicas</h4>

<p className="dica-folga">
  Marque um dia no mês que você não vai atender (ex.: feriado, viagem,
  compromisso pessoal).
</p>

<div className="folga-data-config">
  <input
    type="date"
    value={dataFolga}
    min={new Date().toLocaleDateString("sv-SE")}
    onChange={(e) => {
      setDataFolga(e.target.value);
      setFolgaDataMensagem("");
    }}
  />
  <button
    type="button"
    onClick={async () => {
      if (!profissionalLogado?.id) return;

      if (!dataFolga) {
        setFolgaDataMensagem("Escolha uma data primeiro.");
        setFolgaDataMensagemTipo("erro");
        return;
      }

      if (folgasDatas.includes(dataFolga)) {
        setFolgaDataMensagem("Essa data já está marcada como folga.");
        setFolgaDataMensagemTipo("erro");
        return;
      }

      const { error } = await supabase
        .from("folgas")
        .insert([{ profissional_id: profissionalLogado.id, data: dataFolga }]);

      if (error) {
        console.error(error);
        setFolgaDataMensagem("❌ Erro ao marcar a folga: " + error.message);
        setFolgaDataMensagemTipo("erro");
        return;
      }

      setFolgasDatas((prev) => [...prev, dataFolga]);
      setDataFolga("");
      setFolgaDataMensagem(
        "✅ Folga marcada para " + formatarDataCompleta(dataFolga)
      );
      setFolgaDataMensagemTipo("sucesso");
    }}
  >
    ➕ Adicionar folga
  </button>
</div>

{folgaDataMensagem && (
  <p
    style={{
      color: folgaDataMensagemTipo === "erro" ? "red" : "green",
      margin: "6px 0 0",
      fontWeight: "bold",
      fontSize: "14px",
    }}
  >
    {folgaDataMensagem}
  </p>
)}

{folgasDatas.length > 0 && (
  <div className="folga-data-lista">
    {[...folgasDatas].sort().map((dataAlvo) => (
      <span key={dataAlvo} className="folga-data-chip">
        📅 {formatarDataCompleta(dataAlvo)}
        <button
          type="button"
          title="Remover esta folga"
          onClick={async () => {
            const { error } = await supabase
              .from("folgas")
              .delete()
              .eq("profissional_id", profissionalLogado.id)
              .eq("data", dataAlvo);

            if (error) {
              console.error(error);
              alert("Erro ao remover a folga: " + error.message);
              return;
            }

            setFolgasDatas((prev) => prev.filter((d) => d !== dataAlvo));
          }}
        >
          ✖
        </button>
      </span>
    ))}
  </div>
)}

<h4>Escolha os horários:</h4>

<p className="aviso-folga">
  🚫 Este dia está marcado como folga. Retire a folga dele para poder escolher
  horários.
</p>

<div className="periodos-botoes">

<button 
onClick={() => setPeriodoHorario("todos")}
onDoubleClick={() => marcarPeriodo("todos")}
>
📋 Todos
</button>

<button 
onClick={() => setPeriodoHorario("madrugada")}
onDoubleClick={() => marcarPeriodo("madrugada")}
>
🌙 Madrugada
</button>

<button 
onClick={() => setPeriodoHorario("manha")}
onDoubleClick={() => marcarPeriodo("manha")}
>
☀️ Manhã
</button>

<button 
onClick={() => setPeriodoHorario("tarde")}
onDoubleClick={() => marcarPeriodo("tarde")}
>
🌇 Tarde
</button>

<button 
onClick={() => setPeriodoHorario("noite")}
onDoubleClick={() => marcarPeriodo("noite")}
>
🌃 Noite
</button>

</div>

<div className="btn-copiar-bloco">

<button
type="button"
className="btn-copiar-horarios"
onClick={copiarHorariosParaTodosDias}
>
📋 Copiar estes horários para todos os dias
</button>

{copiarHorariosMensagem && (
<p
style={{
  color: copiarHorariosMensagemTipo === "erro" ? "red" : "green",
  margin: "8px 0 0",
  fontWeight: "bold",
  fontSize: "14px",
}}
>
{copiarHorariosMensagem}
</p>
)}

</div>


<div className="horarios-grade">


{horariosFiltrados.map((hora) => (


<label 
key={hora}
>

<input
type="checkbox"
checked={horariosTrabalho.includes(hora)}
onChange={async (e)=>{

const marcado = e.target.checked;


if(marcado){

setHorariosTrabalho([
  ...horariosTrabalho,
  hora
]);


const { error } = await supabase
.from("horarios_trabalho")
.insert([
{
profissional_id: profissionalLogado.id,
dia_semana: diaSelecionado,
horario: hora
}
]);


if(error){
console.error(error);

setHorariosTrabalho(
  horariosTrabalho.filter(
    item => item !== hora
  )
);

return;
}


}else{


const { error } = await supabase
.from("horarios_trabalho")
.delete()
.eq("profissional_id", profissionalLogado.id)
.eq("dia_semana", diaSelecionado)
.eq("horario", hora);


if(error){
console.error(error);
return;
}


setHorariosTrabalho(
horariosTrabalho.filter(
(item)=> item !== hora
)
);


}


}}
/>

 {hora}


</label>


))}


</div>


</div>

)}

</div>
)}
<div className="resumo-dashboard">


  <div className="resumo-card">
    <h3>📅 Hoje</h3>
    <p>
      {
        pedidos.filter(
          (pedido) =>
            pedido.data === new Date().toLocaleDateString("sv-SE") &&
            pedido.status === "Agendado"
        ).length
      } horários
    </p>
  </div>


  <div
    className="resumo-card resumo-card-clicavel"
    onClick={() => setMostrarDiasAgendados(!mostrarDiasAgendados)}
    title="Clique para mostrar os dias agendados"
  >
    <h3>🟢 Ativos</h3>
    <p>
      {
        pedidos.filter(
          (pedido) => pedido.status === "Agendado"
        ).length
      } marcados
    </p>
    <small className="dica-dias-agendados">
      {mostrarDiasAgendados ? "▲ Esconder dias agendados" : "▼ Ver dias agendados"}
    </small>
  </div>

</div>

{saldoHabilitado && mostrarSaldo && (
  <div className="saldo-trabalhos-area">
    <h3>💰 Saldo de trabalhos</h3>

    <div className="saldo-periodos">
      <button
        className={periodoSaldo === "diario" ? "saldo-periodo-ativo" : ""}
        onClick={() => setPeriodoSaldo("diario")}
      >
        Diário
      </button>
      <button
        className={periodoSaldo === "semanal" ? "saldo-periodo-ativo" : ""}
        onClick={() => setPeriodoSaldo("semanal")}
      >
        Semanal
      </button>
      <button
        className={periodoSaldo === "quinzenal" ? "saldo-periodo-ativo" : ""}
        onClick={() => setPeriodoSaldo("quinzenal")}
      >
        Quinzenal
      </button>
      <button
        className={periodoSaldo === "mensal" ? "saldo-periodo-ativo" : ""}
        onClick={() => setPeriodoSaldo("mensal")}
      >
        Mensal
      </button>
      <button
        className={periodoSaldo === "personalizado" ? "saldo-periodo-ativo" : ""}
        onClick={() => setPeriodoSaldo("personalizado")}
      >
        Personalizado
      </button>
    </div>

    {periodoSaldo === "personalizado" && (
      <div className="saldo-personalizado">
        <label>
          Data inicial
          <input
            type="date"
            value={inicioSaldoPersonalizado}
            max={hojeSaldoString}
            onChange={(e) => {
              const data = e.target.value;
              setInicioSaldoPersonalizado(data);
              localStorage.setItem(
                `saldo_data_inicio_${profissionalLogado.id}`,
                data
              );
            }}
          />
        </label>
      </div>
    )}

    <p className="saldo-numero">R$ {trabalhosConcluidos.toFixed(2).replace(".", ",")}</p>
    <p className="saldo-legenda">
      {periodoSaldo === "personalizado"
        ? `valor dos trabalhos concluídos de ${formatarDataBR(
            inicioSaldoPersonalizado
          )} até hoje`
        : periodoSaldo === "diario"
        ? "valor dos trabalhos concluídos hoje"
        : periodoSaldo === "semanal"
        ? "valor dos trabalhos concluídos nos últimos 7 dias"
        : periodoSaldo === "quinzenal"
        ? "valor dos trabalhos concluídos nos últimos 15 dias"
        : periodoSaldo === "personalizado"
        ? "valor dos trabalhos concluídos no ciclo atual até hoje"
        : "valor dos trabalhos concluídos nos últimos 30 dias"}
    </p>
  </div>
)}

{mostrarDiasAgendados && (
  <div className="dias-agendados-area">
    <h3>🗓️ Dias com agendamento</h3>

    <button
      className="btn-config-principal"
      onClick={() => {
        const ativar = !selecionarParaExcluir;
        setSelecionarParaExcluir(ativar);
        if (ativar) {
          setDiasSelecionadosExclusao([]);
        }
      }}
    >
      {selecionarParaExcluir
        ? "✖ Sair do modo excluir"
        : "🗑️ Selecionar para excluir"}
    </button>

    {diasAgendados.length === 0 ? (
      <p>Nenhum dia agendado ainda.</p>
    ) : (
      <div className="dias-agendados-lista">
        {diasAgendados.map((dia) => {
          const qtdAgendados = pedidos.filter(
            (pedido) => pedido.data === dia && pedido.status === "Agendado"
          ).length;

          const diaSelecionado = diasSelecionadosExclusao.includes(dia);

          return (
            <button
              key={dia}
              className={
                "dia-agendado-chip" +
                (dia === dataSelecionadaFormatada
                  ? " dia-agendado-chip-ativo"
                  : "") +
                (selecionarParaExcluir && diaSelecionado
                  ? " dia-agendado-chip-selecionado"
                  : "")
              }
              onClick={() => {
                if (selecionarParaExcluir) {
                  setDiasSelecionadosExclusao((atual) =>
                    diaSelecionado
                      ? atual.filter((d) => d !== dia)
                      : [...atual, dia]
                  );
                  return;
                }

                setDataSelecionada(new Date(dia + "T00:00:00"));
              }}
            >
              {formatarDiaAgendado(dia)}{" "}
              <span className="dia-agendado-qtd">({qtdAgendados})</span>
            </button>
          );
        })}
      </div>
    )}

    {selecionarParaExcluir &&
      (() => {
        const totalAgendamentosDosDias = pedidos.filter(
          (pedido) =>
            pedido.status === "Agendado" &&
            diasSelecionadosExclusao.includes(pedido.data)
        ).length;

        return (
          <div className="exclusao-bar">
            <p>
              {diasSelecionadosExclusao.length === 0
                ? "Clique nos dias para marcar. Depois exclua tudo de uma vez."
                : `${diasSelecionadosExclusao.length} dia(s) marcado(s) - ${totalAgendamentosDosDias} agendamento(s) ativo(s).`}
            </p>

            <button
              className="exclusao-confirmar"
              disabled={diasSelecionadosExclusao.length === 0}
              onClick={async () => {
                if (totalAgendamentosDosDias === 0) {
                  return;
                }

                const confirmar = window.confirm(
                  `Excluir definitivamente ${totalAgendamentosDosDias} agendamento(s) dos dias selecionados?`
                );

                if (!confirmar) {
                  return;
                }

                const idsParaExcluir = pedidos
                  .filter(
                    (pedido) =>
                      pedido.status === "Agendado" &&
                      diasSelecionadosExclusao.includes(pedido.data)
                  )
                  .map((pedido) => pedido.id);

                try {
                  await ag.excluir(idsParaExcluir);
                } catch (error) {
                  console.error(error);
                  return;
                }

                try {
                  const recarga = await ag.listar();
                  setPedidos(recarga);
                  localStorage.setItem("pedidos", JSON.stringify(recarga));
                } catch (erroBusca) {
                  console.error(erroBusca);
                }

                setDiasSelecionadosExclusao([]);
                setSelecionarParaExcluir(false);
                setMensagemErroProfissional(
                  `Agendamentos excluídos! (${totalAgendamentosDosDias})`
                );
              }}
            >
              🗑️ Excluir agendamentos selecionados
            </button>

            <button
              className="exclusao-limpar"
              onClick={() => setDiasSelecionadosExclusao([])}
            >
              ✖ Limpar seleção
            </button>
          </div>
        );
      })()}

    <small className="dica-dias-agendados">
      {selecionarParaExcluir
        ? "Marque os dias e exclua os agendamentos ativos de uma vez."
        : "Clique em um dia para o calendário abrir nele."}
    </small>
  </div>
)}

            <h2>📅 Agenda de horários</h2>

{(() => {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = amanha.toLocaleDateString("sv-SE");
  const agendamentosAmanha = pedidos.filter(
    (p) =>
      p.data === amanhaISO &&
      p.status === "Agendado" &&
      !lembretesEnviados.includes(p.id)
  );
  if (agendamentosAmanha.length === 0) return null;
  return (
    <div className="lembretes-amanha">
      <h3>🔔 Agendamentos de amanhã — mande o lembrete</h3>
      <p className="dica-dias-agendados">
        Toque no botão verde para abrir o WhatsApp do cliente com a mensagem
        pronta. É só apertar em enviar. Depois de enviar, o agendamento some
        desta lista.
      </p>
      {agendamentosAmanha.map((pedido) => (
        <div key={pedido.id} className="aprovacao-card">
          <div className="aprovacao-info">
            <strong>👤 {pedido.nome}</strong> — {pedido.servico}
            <br />
            <small>
              📅 {formatarDataBR(pedido.data)} às ⏰ {pedido.horario} · 💰{" "}
              {Number(pedido.valor_servico || 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </small>
          </div>
          <div className="aprovacao-botoes">
            <button
              className="btn-aprovar"
              onClick={() =>
                abrirLembreteWa(pedido, (p) => {
                  setLembretesEnviados((prev) => {
                    const novos = prev.includes(p.id) ? prev : [...prev, p.id];
                    localStorage.setItem(
                      "lembretes_amanha_enviados",
                      JSON.stringify(novos)
                    );
                    return novos;
                  });
                })
              }
            >
              🔔 Enviar lembrete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
})()}
{pedidos.some((p) => p.status === "Pendente") && (
  <div className="aprovacoes-area">
    <button
      className="btn-config-principal"
      onClick={() => setMostrarAprovacoes(!mostrarAprovacoes)}
    >
      {mostrarAprovacoes
        ? "🙈 Esconder pedidos pendentes (dezembro)"
        : `⏳ ${pedidos.filter((p) => p.status === "Pendente").length} pedidos aguardando aprovação (dezembro)`}
    </button>

    {mostrarAprovacoes && (
      <>
        <h3>⏳ Pedidos aguardando sua aprovação (dezembro)</h3>
    {pedidos
      .filter((p) => p.status === "Pendente")
      .slice()
      .sort((a, b) => (a.data < b.data ? -1 : 1))
      .map((pedido) => (
        <div key={pedido.id} className="aprovacao-card">
          <div className="aprovacao-info">
            <strong>👤 {pedido.nome}</strong> — {pedido.servico}
            <br />
            <small>
              📅 {formatarDataBR(pedido.data)} às {pedido.horario} · 💰{" "}
              {Number(pedido.valor_servico || 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </small>
          </div>
          <div className="aprovacao-botoes">
            <button
              className="btn-aprovar"
              onClick={async () => {
                let lista;
                try {
                  lista = await ag.listar();
                } catch (erroConflito) {
                  console.error(erroConflito);
                  return;
                }

                const conflito = (lista || []).find(
                  (item) =>
                    item.data === pedido.data &&
                    item.horario === pedido.horario &&
                    item.status === "Agendado"
                );

                if (conflito && conflito.id !== pedido.id) {
                  setMensagemErroProfissional(
                    "Esse horário já está confirmado para outro cliente. Recuse este pedido."
                  );
                  return;
                }

                try {
                  await ag.atualizar(pedido.id, {
                    status: "Agendado",
                    horario_liberado: false,
                  });
                } catch (error) {
                  console.error(error);
                  return;
                }

                setPedidos((prev) =>
                  prev.map((item) =>
                    item.id === pedido.id
                      ? { ...item, status: "Agendado", horario_liberado: false }
                      : item
                  )
                );
                setMensagemProfissional(
                  `✅ Agendamento de ${pedido.nome} aprovado!`
                );
                setMensagemErroProfissional("");
              }}
            >
              ✅ Aprovar
            </button>
            <button
              className="btn-recusar"
              onClick={async () => {
                const confirmar = window.confirm(
                  `Recusar o pedido de ${pedido.nome} (${formatarDataBR(pedido.data)} às ${pedido.horario})?`
                );
                if (!confirmar) return;

                try {
                  await ag.atualizar(pedido.id, {
                    status: "Cancelado",
                    datacancelamento: new Date().toLocaleString(),
                  });
                } catch (error) {
                  console.error(error);
                  return;
                }

                setPedidos((prev) =>
                  prev.map((item) =>
                    item.id === pedido.id
                      ? {
                          ...item,
                          status: "Cancelado",
                          datacancelamento: new Date().toLocaleString(),
                        }
                      : item
                  )
                );
                setMensagemErroProfissional(
                  `❌ Pedido de ${pedido.nome} recusado.`
                );
                setMensagemProfissional("");
              }}
            >
              ❌ Recusar
            </button>
          </div>
        </div>
      ))}
      </>
    )}
  </div>
)}

<Calendar
  onChange={setDataSelecionada}
  value={dataSelecionada}
  onActiveStartDateChange={({ action, activeStartDate }) => {
    // Ao navegar para outro mês/ano, troca a seleção para o 1º dia do novo
    // período. Assim o agendamento do mês anterior não fica aparecendo como
    // se fosse um agendamento do mês atual.
    if (
      action === "prev" ||
      action === "next" ||
      action === "prev2" ||
      action === "next2"
    ) {
      setDataSelecionada(activeStartDate);
    }
  }}

tileClassName={({ date, view }) => {
  if (view === "month") {

    const dataFormatada = date.toLocaleDateString("sv-SE");

    const temAgendado = pedidos.some(
      (pedido) =>
        pedido.data === dataFormatada &&
        pedido.status === "Agendado"
    );

    const temCancelado = pedidos.some(
      (pedido) =>
        pedido.data === dataFormatada &&
        pedido.status === "Cancelado"
    );

if (temAgendado) {
  return "dia-agendado";
}

if (temCancelado) {
  return "dia-cancelado";
}

// Dia de folga do profissional (ninguém consegue agendar nesse dia).
if (
  diasFolga.includes(diaSemanaDaData(dataFormatada)) ||
  folgasDatas.includes(dataFormatada)
) {
  return "dia-folga";
}
  }

  return null;
}}
/>

{mensagemProfissional && (
  <p style={{ color: "green" }}>
    {mensagemProfissional}
  </p>
)}
{mensagemErroProfissional && (
  <p style={{ color: "red" }}>
    {mensagemErroProfissional}
  </p>
)}
{console.log("RENDER PROFISSIONAL", pedidos)}

{pedidosDoDia.length === 0 && (
  <p>Nenhum agendamento para este dia.</p>
)}

{pedidosDoDia.map((pedido) => (
     <div className="agenda-card" key={pedido.id}>

<h3 className="horario-card">
  ⏰ {pedido.horario}
  {(() => {
    const horasServicio = duracaoHorasDeServicio(
      pedido.servico,
      servicos,
      profissionalLogado?.id
    );
    return horasServicio > 0
      ? ` até ${sumarHoras(pedido.horario, horasServicio)}`
      : "";
  })()}
</h3>


<div className="info-agendamento">

<p>{iconeCliente} {pedido.nome}</p>

<p>
  <FaWhatsapp />
  {pedido.whatsapp}
</p>

<p>{iconeAtivo} {pedido.servico}</p>

<p>
  💰 {Number(pedido.valor_servico || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
</p>

<p>📅 {formatarDataBR(pedido.data)}</p>

<p>
Status:

{
pedido.status === "Agendado"
? "🟢 Agendado"
: pedido.status === "Pendente"
? "⏳ Pendente (aguardando aprovação)"
: pedido.status === "Cancelado"
? "🔴 Cancelado"
: "✅ Concluído"
}

</p>

</div>
{pedido.status === "Cancelado" && (
  <p>
    Cancelado em: {pedido.datacancelamento}
  </p>
)}
{pedido.status === "Concluído" && pedido.dataconcluido && (
  <p>
    Concluído em: {formatarDataCompleta(pedido.dataconcluido)}
  </p>
)}

{(pedido.status === "Cancelado" || pedido.status === "Concluído") && (
  <button
onClick={async () => {

      try {
        await ag.excluir([pedido.id]);
      } catch (error) {
        console.error(error);
        return;
      }

      const novosPedidos = pedidos.filter(
        (item) => item.id !== pedido.id
      );

      setPedidos(novosPedidos);

      localStorage.setItem(
        "pedidos",
        JSON.stringify(novosPedidos)
      );
      setMensagemProfissional("");
      setMensagemErroProfissional("Agendamento excluído!");
    }}
  >
    Excluir agendamento
  </button>
)}
{pedido.status === "Agendado" && (

<>

<button
  onClick={() => abrirLembreteWa(pedido)}
>
  🔔 Lembrar no WhatsApp
</button>

<button
  type="button"
  onClick={() => {
    setPedidoEditandoValor(pedido.id);
    setValorAgendamentoEditando(String(pedido.valor_servico ?? 0));
    setMensagemErroProfissional("");
    setMensagemProfissional("");
  }}
>
  ✏️ Alterar valor de serviço
</button>

<button
onClick={async () => {


const dataConcluido = new Date().toLocaleDateString("sv-SE");

// Guarda a data de conclusão também localmente, para o saldo funcionar
// mesmo enquanto a coluna `dataconcluido` ainda não existir no banco.
try {
  const mapaLocal = JSON.parse(
    localStorage.getItem("datas_conclusao_agendamentos") || "{}"
  );
  mapaLocal[String(pedido.id)] = dataConcluido;
  localStorage.setItem(
    "datas_conclusao_agendamentos",
    JSON.stringify(mapaLocal)
  );
} catch (e) {
  console.warn("Não consegui guardar a data de conclusão local:", e);
}

try {
  await ag.atualizar(pedido.id, {
    status: "Concluído",
    horario_liberado: true,
    dataconcluido: dataConcluido,
  });
} catch (error) {
  // Se a coluna dataconcluido ainda não existe na base, finaliza sem ela
  // para o botão não quebrar. O saldo já tem a data guardada localmente.
  console.warn(
    "Não consegui salvar `dataconcluido` no banco. Tentando sem ela.",
    error
  );
  try {
    await ag.atualizar(pedido.id, {
      status: "Concluído",
      horario_liberado: true,
    });
  } catch (erroFallback) {
    console.error(erroFallback);
    return;
  }
}


let dataRecarregada;
try {
  dataRecarregada = await ag.listar();
} catch (erroBusca) {
  console.error(erroBusca);
  return;
}

console.table(dataRecarregada);

setPedidos(dataRecarregada);

setMensagemProfissional("Trabalho concluído!");
await supabase
.from("profissionais")
.update({
 status_atendimento: "Aberto"
})
.eq("id", profissionalLogado.id);


setStatusAtendimento("Aberto");
}}
>
✅ Finalizar trabalho
</button>


<button
onClick={async () => {

  setMensagemProfissional("");
  setMensagemErroProfissional("");

  try {
    await ag.atualizar(pedido.id, {
      status: "Cancelado",
      datacancelamento: new Date().toLocaleString(),
    });
  } catch (error) {
    console.error(error);
    return;
  }


let dataRecarregada;
try {
  dataRecarregada = await ag.listar();
} catch (erroBusca) {
  console.error(erroBusca);
  return;
}


setPedidos(dataRecarregada);

setMensagemErroProfissional("Agendamento cancelado!");

}}
>
❌ Cancelar agendamento
</button>

<button
  onClick={() => {
    setMensagemProfissional("");
    setMensagemErroProfissional("");
    setReagendandoPedido(pedido);
    setNovaDataReagendamento(pedido.data);
    setNovoHorarioReagendamento(pedido.horario);
    setHorariosReagendamento([]);
    setMensagemReagendamento("");
    setTipoMensagemReagendamento("");
  }}
>
  🔄 Reagendar
</button>

{pedidoEditandoValor === pedido.id && (
  <div className="editar-valor-agendamento">
    <label htmlFor={`valor-agendamento-${pedido.id}`}>
      Novo valor do serviço (R$)
    </label>
    <input
      id={`valor-agendamento-${pedido.id}`}
      type="number"
      min="0"
      step="0.01"
      value={valorAgendamentoEditando}
      onChange={(e) => setValorAgendamentoEditando(e.target.value)}
      disabled={salvandoValorAgendamento}
    />
    <button
      type="button"
      disabled={salvandoValorAgendamento}
      onClick={async () => {
        const valor = Number(
          String(valorAgendamentoEditando).replace(",", ".")
        );
        if (
          valorAgendamentoEditando.trim() === "" ||
          !Number.isFinite(valor) ||
          valor < 0
        ) {
          setMensagemErroProfissional("Digite um valor válido a partir de R$ 0,00.");
          return;
        }
        if (!profissionalLogado?.id) {
          setMensagemErroProfissional("Faça login como profissional para alterar o valor.");
          return;
        }

        setSalvandoValorAgendamento(true);
        setMensagemErroProfissional("");
        setMensagemProfissional("");
        let data;
        try {
          data = await ag.atualizar(pedido.id, { valor_servico: valor });
        } catch (error) {
          console.error(error);
          setMensagemErroProfissional("Não foi possível salvar o novo valor. Tente novamente.");
          setSalvandoValorAgendamento(false);
          return;
        }
        if (!data) {
          setMensagemErroProfissional("Agendamento não encontrado para este profissional.");
          setSalvandoValorAgendamento(false);
          return;
        }

        setPedidos((prev) => {
          const atualizados = prev.map((item) =>
            item.id === data.id ? data : item
          );
          localStorage.setItem("pedidos", JSON.stringify(atualizados));
          return atualizados;
        });
        setPedidoEditandoValor(null);
        setValorAgendamentoEditando("");
        setSalvandoValorAgendamento(false);
        setMensagemProfissional("Valor do agendamento atualizado!");
      }}
    >
      {salvandoValorAgendamento ? "Salvando..." : "💾 Salvar valor"}
    </button>
    <button
      type="button"
      disabled={salvandoValorAgendamento}
      onClick={() => {
        setPedidoEditandoValor(null);
        setValorAgendamentoEditando("");
      }}
    >
      Cancelar
    </button>
  </div>
)}

{(() => {
  const grupoRecorrencia = mesesDaRecorrencia(pedido, pedidos, profissionalLogado?.id);

  // Só mostra se realmente for uma recorrência com mais de 1 mês.
  if (grupoRecorrencia.length <= 1) {
    return null;
  }

  return (
    <button
      onClick={async () => {
        const confirmar = window.confirm(
          `Cancelar toda a recorrência de ${pedido.nome} (${grupoRecorrencia.length} meses) no horário ${pedido.horario}?`
        );

        if (!confirmar) {
          return;
        }

        try {
          await ag.atualizarVarios(
            grupoRecorrencia.map((item) => item.id),
            {
              status: "Cancelado",
              datacancelamento: new Date().toLocaleString(),
            }
          );
        } catch (error) {
          console.error(error);
          return;
        }

        try {
          const recarga = await ag.listar();
          setPedidos(recarga);
        } catch (erroBusca) {
          console.error(erroBusca);
        }

        setMensagemProfissional("");
        setMensagemErroProfissional(
          `Recorrência cancelada! (${grupoRecorrencia.length} meses)`
        );
      }}
    >
      ❌ Cancelar recorrência ({grupoRecorrencia.length} meses)
    </button>
  );
})()}

{reagendandoPedido?.id === pedido.id && (
  <div className="agendar-cliente-form reagendar-form">
    <h3>🔄 Reagendar cliente</h3>

    <small>
      Agendamento atual: {formatarDataCompleta(pedido.data)} às{" "}
      {pedido.horario}
    </small>

    {mensagemReagendamento && (
      <p
        style={{
          color: tipoMensagemReagendamento === "erro" ? "red" : "green",
        }}
      >
        {mensagemReagendamento}
      </p>
    )}

    <label>Nova data</label>
    <input
      type="date"
      value={novaDataReagendamento}
      min={new Date().toLocaleDateString("sv-SE")}
      onChange={(e) => {
        setNovaDataReagendamento(e.target.value);
        setNovoHorarioReagendamento("");
        setMensagemReagendamento("");
        setTipoMensagemReagendamento("");
      }}
    />

    {(!novaDataReagendamento ||
      (!diasFolga.includes(diaSemanaDaData(novaDataReagendamento)) &&
        !folgasDatas.includes(novaDataReagendamento))) && (
      <>
        <label>Novo horário</label>
        <select
          value={novoHorarioReagendamento}
          onChange={(e) => setNovoHorarioReagendamento(e.target.value)}
        >
          <option value="">Escolha o horário</option>

          {horariosReagendamento.map((hora) => (
            <option key={hora} value={hora}>
              {hora}
            </option>
          ))}
        </select>
      </>
    )}

    {novaDataReagendamento && horariosReagendamento.length === 0 && (
      <small>
        {diasFolga.includes(diaSemanaDaData(novaDataReagendamento)) ||
        folgasDatas.includes(novaDataReagendamento)
          ? "🚫 Este dia é folga. Escolha outra data."
          : "Nenhum horário disponível para este dia. Escolha outra data."}
      </small>
    )}

    <button type="button" onClick={salvarReagendamento}>
      ✓ Confirmar reagendamento
    </button>

    <button
      type="button"
      className="agendar-cliente-cancelar"
      onClick={() => {
        setReagendandoPedido(null);
        setNovaDataReagendamento("");
        setNovoHorarioReagendamento("");
        setHorariosReagendamento([]);
        setMensagemReagendamento("");
        setTipoMensagemReagendamento("");
      }}
    >
      ❌ Cancelar
    </button>
  </div>
)}

</>

)}

    </div>
))}



<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
<button
  onClick={() => {
    if (!profissionalLogado?.id) return;
    setMensagemProfissional("");
    setMensagemErroProfissional("");
    setProfissionalCliente(profissionalLogado.id);
    setCarregandoPerfil(true);
    setTela("cliente");
  }}
>
  Ver meu perfil de cliente
</button>

<button
  onClick={async () => {
    await ag.logout();
    localStorage.removeItem("profissionalLogado");
    setProfissionalLogado(null);
    setProfissionalCliente(null);
    setTela("login");
  }}
>
  Sair
</button>
</div>

{/* (banner movido para o topo da tela do profissional) */}
  </div>
)}

{profissionalLogado && notificacaoNovoAgendamento && (
  <div
    className="notificacao-whatsapp notificacao-clicavel"
    role="alert"
    aria-live="assertive"
    onClick={() => {
      abrirCalendarioDoAgendamento(notificacaoNovoAgendamento);
      setNotificacaoNovoAgendamento(null);
    }}
    title="Abrir o calendário no dia deste agendamento"
  >
    <div className="notificacao-icone">
      <FaWhatsapp />
    </div>
    <div className="notificacao-conteudo">
      <strong>Novo agendamento</strong>
      <span>👤 {notificacaoNovoAgendamento.nome}</span>
      <span><FaWhatsapp /> {notificacaoNovoAgendamento.whatsapp}</span>
      <span>{iconeAtivo} {notificacaoNovoAgendamento.servico}</span>
      <span>📅 {formatarDataCompleta(notificacaoNovoAgendamento.data)} · ⏰ {notificacaoNovoAgendamento.horario}</span>
      <span className="notificacao-confirmar">✓ Clique para abrir este dia no calendário</span>
    </div>
  </div>
)}
    </div>
    <footer className="rodape">
      <p>
        © 2026 Agenda Pro - Todos os direitos reservados.
      </p>

      <p>
        Sistema de agendamentos desenvolvido por Dário Júnior
      </p>
    </footer>

  </div>
  </ProtectorDeErrores>
);
}

export default App;
