import Calendar from "react-calendar";
import { FaWhatsapp } from "react-icons/fa";
import "react-calendar/dist/Calendar.css";
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

// Temas disponÃ­veis para profissionais e para os clientes verem no agendamento.
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
  { value: "ðŸŽ‚", label: "Bolo" },
  { value: "ðŸ°", label: "Bolo de fatia" },
  { value: "ðŸ§", label: "Cupcake" },
  { value: "ðŸ’‡", label: "Cabelo" },
  { value: "ðŸ’ˆ", label: "Barbearia" },
  { value: "ðŸ’…", label: "Beleza" },
  { value: "ðŸ¶", label: "Pets" },
  { value: "ðŸ’„", label: "Maquiagem" },
  { value: "ðŸ¾", label: "Pet" },
  { value: "ðŸ©º", label: "SaÃºde" },
  { value: "ðŸ–‹ï¸â€‹", label: "Tatuagem" },
];
 
// Cria uma lista de datas mensais a partir da data inicial, repetindo o mesmo
// dia e horÃ¡rio a cada mÃªs. Ex.: dataInicial de janeiro com 3 meses => jan, fev, mar.
// Dias invÃ¡lidos (ex.: 31/01 + 1 mÃªs) sÃ£o ajustados para o Ãºltimo dia do mÃªs.
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

// Cria uma linha vazia de serviÃ§o + dia + horÃ¡rio (tela do CLIENTE).
function novoItemCliente() {
  return { servico: "", data: "", horario: "", valor: 0 };
}

// Linha vazia usada no formulÃ¡rio do PROFISSIONAL ("Agendar por um cliente"),
// que tambÃ©m pode repetir por vÃ¡rios meses.
function novoItemAgendarCliente() {
  return { servico: "", data: "", horario: "", valor: 0, meses: 1 };
}

// Nomes dos dias da semana na ordem do Date.getDay() (0 = domingo, 1 = segunda...).
const diasSemanaPorIndice = [
  "domingo",
  "segunda",
  "terÃ§a",
  "quarta",
  "quinta",
  "sexta",
  "sÃ¡bado",
];

// Devolve o nome (minÃºsculo) do dia da semana de uma data no formato "AAAA-MM-DD".
function diaSemanaDaData(dataISO) {
  return dataISO
    ? diasSemanaPorIndice[new Date(dataISO + "T00:00:00").getDay()]
    : "";
}

// Busca os dias marcados como FOLGA de um profissional. A folga fica guardada
// na tabela "horarios_trabalho" como uma linha especial com horario = "FOLGA"
// (nÃ£o Ã© um horÃ¡rio real de atendimento, Ã© sÃ³ a marcaÃ§Ã£o de folga do dia).
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

// Busca as datas especÃ­ficas marcadas como folga de um profissional.
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

// Junta os agendamentos que fazem parte da MESMA recorrÃªncia mensal de um pedido
// (mesmo profissional, cliente, serviÃ§o e horÃ¡rio, em meses consecutivos).
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

  // Union-find simples para agrupar meses consecutivos da mesma recorrÃªncia.
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

// Senha do administrador (segunda senha) - necessÃ¡ria para desbloquear
// as opÃ§Ãµes de gerenciamento: editar, desativar, excluir e ver senha.
const SENHA_ADMIN_OPCOES = "9622";



function App() {
  const [tela, setTela] = useState("profissional");

const [senha, setSenha] = useState("");
const [loginNome, setLoginNome] = useState("");
  console.log("APP ESTÃ RODANDO");
console.log("EU EDITEI ESTE ARQUIVO AGORA 123456");

const [profissionalLogado, setProfissionalLogado] = useState({ id: 12, nome: "Biel", tema: "cinza", icone: "💇", tipo: "profissional", ativo: true, chave_pix: null, banco_pix: null });
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

const [pedido, setPedido] = useState(null);
const [pedidos, setPedidos] = useState([]);

const [dataSelecionada, setDataSelecionada] = useState(new Date());
const [nome, setNome] = useState("");
const [mostrarConfiguracaoServicos, setMostrarConfiguracaoServicos] = useState(false);

const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);
 
const [mostrarConfiguracaoHorarios, setMostrarConfiguracaoHorarios] = useState(true);

// Pix de pagamento cadastrado pelo profissional (chave + banco).
const [pixChave, setPixChave] = useState("");
const [pixBanco, setPixBanco] = useState("");
const [pixNome, setPixNome] = useState("");
// Feedback de "copiada" na tela do cliente.
const [pixCopiada, setPixCopiada] = useState(false);
// Mensagem de feedback do salvamento do Pix (aparece ao lado do botÃ£o).
const [pixMensagem, setPixMensagem] = useState("");
const [pixMensagemTipo, setPixMensagemTipo] = useState("");
// Mensagens inline dos botÃµes "Salvar cor" e "Salvar Ã­cone".
const [corMensagem, setCorMensagem] = useState("");
const [corMensagemTipo, setCorMensagemTipo] = useState("");
const [iconeMensagem, setIconeMensagem] = useState("");
const [iconeMensagemTipo, setIconeMensagemTipo] = useState("");
 
const [temaSelecionado, setTemaSelecionado] = useState("feminino");
const [iconeSelecionado, setIconeSelecionado] = useState("ðŸ’…");
const [mostrarSaldo, setMostrarSaldo] = useState(true);
 
const [statusAtendimento, setStatusAtendimento] = useState("DisponÃ­vel");
const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
const [mostrarDiasAgendados, setMostrarDiasAgendados] = useState(false);
const [selecionarParaExcluir, setSelecionarParaExcluir] = useState(false);
const [diasSelecionadosExclusao, setDiasSelecionadosExclusao] = useState([]);
const [saldoHabilitado, setSaldoHabilitado] = useState(false);
const [periodoSaldo, setPeriodoSaldo] = useState("semanal");
const [notificacaoNovoAgendamento, setNotificacaoNovoAgendamento] = useState(null);
const [mostrarAgendarCliente, setMostrarAgendarCliente] = useState(false);
const [mensagemAgendarCliente, setMensagemAgendarCliente] = useState("");
const [tipoMensagemAgendarCliente, setTipoMensagemAgendarCliente] = useState("");
// MÃºltiplos serviÃ§os num mesmo agendamento (botÃ£o "âž•").
const [itensCliente, setItensCliente] = useState(() => [novoItemCliente()]);
const [horariosPorLinhaCliente, setHorariosPorLinhaCliente] = useState({});
const [itensAgendarCliente, setItensAgendarCliente] = useState(() => [
  novoItemAgendarCliente(),
]);
const [horariosPorLinhaAgendarCliente, setHorariosPorLinhaAgendarCliente] =
  useState({});

// Reagendamento (remarcar dia/horÃ¡rio) dentro da agenda do profissional.
const [reagendandoPedido, setReagendandoPedido] = useState(null);
const [novaDataReagendamento, setNovaDataReagendamento] = useState("");
const [novoHorarioReagendamento, setNovoHorarioReagendamento] = useState("");
const [horariosReagendamento, setHorariosReagendamento] = useState([]);
const [mensagemReagendamento, setMensagemReagendamento] = useState("");
const [tipoMensagemReagendamento, setTipoMensagemReagendamento] = useState("");
const pedidosVistosRef = useRef(new Set());
const primeiraCargaRef = useRef(true);
const [mostrarListaAdmin, setMostrarListaAdmin] = useState(null);
const [desbloqueadoAdmin, setDesbloqueadoAdmin] = useState(false);
const [senhaOpcoesAdmin, setSenhaOpcoesAdmin] = useState("");

const temaAtivo = profissionalLogado?.tema || dadosProfissionalCliente?.tema || temaNovo || "feminino";
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

const iconeAtivo = profissionalLogado?.icone || dadosProfissionalCliente?.icone || (temaAtivo === "masculino" ? "ðŸ’ˆ" : "ðŸ’…");

const iconeCliente = ["cinza", "preto", "verde", "masculino"].includes(temaAtivo) ? "ðŸ§”" : "ðŸ‘©ðŸ»";

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
resultado.status_atendimento || "DisponÃ­vel"
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

// Carrega as datas especÃ­ficas de folga do profissional logado.
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

// Quando o profissional abre as ConfiguraÃ§Ãµes, carrega do banco os dados
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
}, [mostrarConfiguracoes, profissionalLogado?.id]);

const diasSemana = [
  "segunda",
  "terÃ§a",
  "quarta",
  "quinta",
  "sexta",
  "sÃ¡bado",
  "domingo"
];
const [diaSelecionado, setDiaSelecionado] = useState("segunda");

const [horariosTrabalho, setHorariosTrabalho] = useState([]);

const [periodoHorario, setPeriodoHorario] = useState("todos");

// Dias da semana marcados como FOLGA (ninguÃ©m consegue agendar nesses dias).
const [diasFolga, setDiasFolga] = useState([]);
// Dias de folga vistos na tela do CLIENTE (do profissional que estÃ¡ agendando).
const [diasFolgaCliente, setDiasFolgaCliente] = useState([]);
// Datas especÃ­ficas de folga (um dia no mÃªs) do profissional logado.
const [folgasDatas, setFolgasDatas] = useState([]);
// Datas especÃ­ficas de folga vistas na tela do CLIENTE.
const [folgasDatasCliente, setFolgasDatasCliente] = useState([]);
// Data escolhida no seletor de folga (configurar horÃ¡rios).
const [dataFolga, setDataFolga] = useState("");
// Mensagem inline da seÃ§Ã£o de folgas em datas especÃ­ficas.
const [folgaDataMensagem, setFolgaDataMensagem] = useState("");
const [folgaDataMensagemTipo, setFolgaDataMensagemTipo] = useState("");
// Mensagem inline do botÃ£o "copiar horÃ¡rios para todos os dias".
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

// Se TODOS os horÃ¡rios do perÃ­odo jÃ¡ estÃ£o marcados, desmarca tudo.
// Caso contrÃ¡rio, marca os que faltam.
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
alert("Erro ao desmarcar horÃ¡rios: " + error.message);
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
alert("Erro ao marcar horÃ¡rios: " + error.message);
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

// Copia os horÃ¡rios marcados no dia atual para TODOS os dias da semana,
// substituindo os horÃ¡rios dos outros dias (as folgas continuam intactas).
async function copiarHorariosParaTodosDias() {

if (!profissionalLogado?.id) return;

if (horariosTrabalho.length === 0) {
setCopiarHorariosMensagem(
  "Marque pelo menos um horÃ¡rio no dia atual para poder copiar."
);
setCopiarHorariosMensagemTipo("erro");
return;
}

const diasAlvo = diasSemana.filter((dia) => dia !== diaSelecionado);

const confirmou = window.confirm(
  `Definir os ${horariosTrabalho.length} horÃ¡rios de "${diaSelecionado}" para TODOS os dias da semana?\n\nOs horÃ¡rios atuais dos outros dias serÃ£o substituÃ­dos.`
);

if (!confirmou) return;

// Apaga os horÃ¡rios reais dos outros dias (mantÃ©m as marcaÃ§Ãµes de FOLGA).
const { error: erroApagar } = await supabase
.from("horarios_trabalho")
.delete()
.eq("profissional_id", profissionalLogado.id)
.in("dia_semana", diasAlvo)
.neq("horario", "FOLGA");

if (erroApagar) {
console.error(erroApagar);
setCopiarHorariosMensagem("âŒ Erro ao copiar os horÃ¡rios: " + erroApagar.message);
setCopiarHorariosMensagemTipo("erro");
return;
}

// Insere os horÃ¡rios do dia atual em todos os outros dias.
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
  setCopiarHorariosMensagem("âŒ Erro ao copiar os horÃ¡rios: " + erroInserir.message);
  setCopiarHorariosMensagemTipo("erro");
  return;
}
}

setCopiarHorariosMensagem(
  `âœ… ${horariosTrabalho.length} horÃ¡rios copiados para ${diasAlvo.length} dia(s) da semana!`
);
setCopiarHorariosMensagemTipo("sucesso");

}

}
useEffect(() => {
  async function carregarHorariosCliente() {
    if (!profissionalCliente) {
      setHorariosPorLinhaCliente({});
      return;
    }

    const mapa = {};

    // Dias de folga do profissional que o cliente estÃ¡ vendo.
    const diasFolgaDoProfissional = profissionalCliente
      ? await buscarDiasFolga(profissionalCliente)
      : [];
    setDiasFolgaCliente(diasFolgaDoProfissional);

    // Datas especÃ­ficas de folga do profissional que o cliente estÃ¡ vendo.
    const folgasDatasDoProfissional = profissionalCliente
      ? await buscarFolgasDatas(profissionalCliente)
      : [];
    setFolgasDatasCliente(folgasDatasDoProfissional);

    for (let i = 0; i < itensCliente.length; i++) {
      const item = itensCliente[i];

      if (!item.data) {
        mapa[i] = [];
        continue;
      }

      const dataEscolhida = new Date(item.data + "T00:00:00");

      const diaSemana = diasSemanaPorIndice[dataEscolhida.getDay()];

      // Dia de folga: nenhum horÃ¡rio fica disponÃ­vel para o cliente.
      if (diasFolgaDoProfissional.includes(diaSemana)) {
        mapa[i] = [];
        continue;
      }

      // Data especÃ­fica de folga: nenhum horÃ¡rio disponÃ­vel tambÃ©m.
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

      const hojeData = new Date();

      const hoje =
        hojeData.getFullYear() +
        "-" +
        String(hojeData.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(hojeData.getDate()).padStart(2, "0");

      const agora = new Date();

      // Ocupados: agendamentos ativos do dia + horÃ¡rios escolhidos nas outras linhas.
      const ocupadosBanco = pedidos
        .filter((ped) => ped.data === item.data)
        .filter(
          (ped) => ped.status === "Agendado" && ped.horario_liberado !== true
        )
        .map((ped) => ped.horario);

      const ocupadosOutrasLinhas = itensCliente
        .map((outro, outroIndice) =>
          outroIndice !== i && outro.data === item.data ? outro.horario : null
        )
        .filter(Boolean);

      const horariosDisponiveisFiltrados = horarios
        .map((linha) => linha.horario)
        .filter((hora) => !ocupadosBanco.includes(hora))
        .filter((hora) => !ocupadosOutrasLinhas.includes(hora))
        .filter((hora) => {
          // Se nÃ£o for hoje, mantÃ©m todos
          if (item.data !== hoje) {
            return true;
          }

          const [horaSlot, minutoSlot] = hora.split(":").map(Number);

          const horaAtual = agora.getHours();
          const minutoAtual = agora.getMinutes();

          // Bloqueia horÃ¡rios que jÃ¡ passaram
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

    setHorariosPorLinhaCliente(mapa);
  }

  carregarHorariosCliente();
}, [profissionalCliente, itensCliente, pedidos]);

// HorÃ¡rios livres para AGENDAR POR um cliente (formulÃ¡rio dentro da Ã¡rea profissional).
useEffect(() => {
  async function carregarHorariosAgendarCliente() {
    if (!profissionalLogado || !mostrarAgendarCliente) {
      setHorariosPorLinhaAgendarCliente({});
      return;
    }

    const mapa = {};

    // Dias de folga do profissional logado.
    const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);
    const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalLogado.id);

    for (let i = 0; i < itensAgendarCliente.length; i++) {
      const item = itensAgendarCliente[i];

      if (!item.data) {
        mapa[i] = [];
        continue;
      }

      const dataEscolhida = new Date(item.data + "T00:00:00");

      const diaSemana = diasSemanaPorIndice[dataEscolhida.getDay()];

      // Dia de folga: nenhum horÃ¡rio fica disponÃ­vel.
      if (diasFolgaDoProfissional.includes(diaSemana)) {
        mapa[i] = [];
        continue;
      }

      // Data especÃ­fica de folga: nenhum horÃ¡rio disponÃ­vel tambÃ©m.
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

      const agora = new Date();

      const hoje =
        agora.getFullYear() +
        "-" +
        String(agora.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(agora.getDate()).padStart(2, "0");

      // Ocupados: agendamentos ativos do dia + horÃ¡rios escolhidos nas outras linhas.
      const ocupadosBanco = pedidos
        .filter((ped) => ped.data === item.data)
        .filter(
          (ped) => ped.status === "Agendado" && ped.horario_liberado !== true
        )
        .map((ped) => ped.horario);

      const ocupadosOutrasLinhas = itensAgendarCliente
        .map((outro, outroIndice) =>
          outroIndice !== i && outro.data === item.data ? outro.horario : null
        )
        .filter(Boolean);

      const horariosLivres = horarios
        .map((linha) => linha.horario)
        .filter((hora) => !ocupadosBanco.includes(hora))
        .filter((hora) => !ocupadosOutrasLinhas.includes(hora))
        .filter((hora) => {
          // Se nÃ£o for hoje, mantÃ©m todos os horÃ¡rios
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

    setHorariosPorLinhaAgendarCliente(mapa);
  }

  carregarHorariosAgendarCliente();
}, [profissionalLogado, mostrarAgendarCliente, itensAgendarCliente, pedidos]);

// HorÃ¡rios livres para REAGENDAR um agendamento (formulÃ¡rio dentro da agenda).
// Usa a mesma regra de ocupaÃ§Ã£o da agenda: bloqueia apenas agendamentos ativos,
// ignorando o prÃ³prio agendamento que estÃ¡ sendo remarcado.
useEffect(() => {
  async function carregarHorariosReagendamento() {
    if (!profissionalLogado || !reagendandoPedido || !novaDataReagendamento) {
      setHorariosReagendamento([]);
      return;
    }

    const dataEscolhida = new Date(novaDataReagendamento + "T00:00:00");

    // Dia de folga: nenhum horÃ¡rio fica livre para reagendar.
    const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);

    if (
      diasFolgaDoProfissional.includes(
        diasSemanaPorIndice[dataEscolhida.getDay()]
      )
    ) {
      setHorariosReagendamento([]);
      return;
    }

    // Data especÃ­fica de folga: nenhum horÃ¡rio livre para reagendar.
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

    const horariosOcupados = pedidos
      .filter((item) => item.data === novaDataReagendamento)
      .filter(
        (item) =>
          item.status === "Agendado" &&
          item.horario_liberado !== true &&
          item.id !== reagendandoPedido.id
      )
      .map((item) => item.horario);

    const horariosLivres = horarios
      .map((item) => item.horario)
      .filter((hora) => !horariosOcupados.includes(hora))
      .filter((hora) => {
        // Se nÃ£o for hoje, mantÃ©m todos os horÃ¡rios
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
}, [profissionalLogado, reagendandoPedido, novaDataReagendamento, pedidos]);

const params = new URLSearchParams(window.location.search);

console.log("URL COMPLETA:", window.location.href);
console.log("PARAMETRO PROFISSIONAL:", params.get("profissional"));

const profissionalIdLink = Number(params.get("profissional"));

console.log("ID FINAL:", profissionalIdLink);

useEffect(() => {

  if (profissionalIdLink && params.get("login") === "1") {
    // Link do profissional: abre direto a tela de login da Ã¡rea profissional.
    setCarregandoPerfil(false);

    // Se jÃ¡ existe uma sessÃ£o salva deste mesmo profissional, entra direto.
    let sessao = null;
    try {
      const dados = JSON.parse(localStorage.getItem("profissionalLogado") || "");
      if (dados?.id === profissionalIdLink) sessao = dados;
    } catch (e) {}

    if (sessao) {
      setProfissionalLogado(sessao);
      setTemaSelecionado(sessao.tema || "feminino");
      setIconeSelecionado(sessao.icone || (sessao.tema === "masculino" ? "ðŸ’ˆ" : "ðŸ’…"));
      setTela(sessao.tipo === "super_admin" ? "admin" : "profissional");
    } else {
      setTela("login");

      // JÃ¡ preenche o nome do profissional do link para facilitar o login.
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

// Restaura a sessÃ£o do profissional ao atualizar a pÃ¡gina (F5),
// sem precisar logar novamente. Valida no banco se ainda estÃ¡ ativo.
useEffect(() => {
  const paramsUrl = new URLSearchParams(window.location.search);
  const idLink = Number(paramsUrl.get("profissional"));

  // Em pÃ¡ginas de link pÃºblico do cliente, nÃ£o restaura a sessÃ£o.
  if (idLink) return;

  const salvo = localStorage.getItem("profissionalLogado");
  if (!salvo) return;

  async function restaurarSessao() {
    try {
      const dados = JSON.parse(salvo);
      if (!dados?.id) {
        localStorage.removeItem("profissionalLogado");
        return;
      }

      const { data: atual, error } = await supabase
        .from("profissionais")
        .select("*")
        .eq("id", dados.id)
        .single();

      if (error || !atual) {
        // Perfil foi excluÃ­do / nÃ£o existe mais.
        localStorage.removeItem("profissionalLogado");
        setTela("login");
        setMensagemLogin("Este perfil nÃ£o existe mais ou foi excluÃ­do.");
        return;
      }

      if (!atual.ativo) {
        // Perfil foi desativado pelo administrador.
        localStorage.removeItem("profissionalLogado");
        setTela("login");
        setMensagemLogin("Este perfil foi desativado pelo administrador.");
        return;
      }

      localStorage.setItem("profissionalLogado", JSON.stringify(atual));
      setProfissionalLogado(atual);
      setTemaSelecionado(atual.tema || "feminino");
      setIconeSelecionado(atual.icone || (atual.tema === "masculino" ? "ðŸ’ˆ" : "ðŸ’…"));
      setTela(atual.tipo === "super_admin" ? "admin" : "profissional");
    } catch (e) {
      localStorage.removeItem("profissionalLogado");
    }
  }

  restaurarSessao();
}, []);

useEffect(() => {

async function carregarProfissionalCliente(){

if(!profissionalCliente) return;


const { data, error } = await supabase
.from("profissionais")
.select("*")
.eq("id", profissionalCliente)
.single();


if(error){
console.error(error);
setCarregandoPerfil(false);
return;
}
if (!data.ativo) {
  setCarregandoPerfil(false);
  alert("Este profissional estÃ¡ indisponÃ­vel.");
  setTela("inicio");
  return;
}

setDadosProfissionalCliente(data);
setCarregandoPerfil(false);

setStatusAtendimento(
  data.status_atendimento || "DisponÃ­vel"
);

console.log("TEMA DO PROFISSIONAL:", data.tema);

}


carregarProfissionalCliente();


}, [profissionalCliente]);

useEffect(() => {
if (profissionalLogado?.tema) {
  setTemaSelecionado(profissionalLogado.tema);
}
}, [profissionalLogado]);

useEffect(() => {

  async function carregarPedidos() {


    const idProfissional = profissionalLogado?.id || profissionalCliente;


if (!profissionalLogado && !profissionalCliente) {
  console.log("SEM PROFISSIONAL AINDA");
  return;
}

    const { data: resultado, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("profissional_id", idProfissional)
      .order("id", { ascending: false });


    if (error) {
      console.error(error);
      return;
    }


    setPedidos(resultado)

  }


  carregarPedidos();


}, [tela, profissionalLogado, profissionalCliente, pedido]);

// MantÃ©m os agendamentos (e os contadores "Hoje" / "Ativos") atualizados
// em tempo real quando um cliente agenda, mesmo estando em outro navegador.
// Usa o realtime do Supabase e, como garantia, recarrega a cada 20s.
useEffect(() => {
  const idProfissional = profissionalLogado?.id;
  if (!idProfissional) return;

  let canal = null;
  let intervalo = null;

  // Reinicia o controle de "jÃ¡ vistos" para este profissional,
  // evitando notificar agendamentos antigos a cada novo login.
  primeiraCargaRef.current = true;
  pedidosVistosRef.current = new Set();

  const atualizarPedidos = async () => {
    const { data: resultado, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("profissional_id", idProfissional)
      .order("id", { ascending: false });

    if (!error && Array.isArray(resultado)) {
      // Na primeira carga sÃ³ guarda os agendamentos que jÃ¡ existem,
      // para nÃ£o notificar os antigos quando o profissional entrar.
      if (primeiraCargaRef.current) {
        primeiraCargaRef.current = false;
      } else {
        const novos = resultado.filter(
          (p) =>
            p.status === "Agendado" &&
            !pedidosVistosRef.current.has(p.id)
        );

        if (novos.length > 0) {
          setNotificacaoNovoAgendamento(novos[0]);
        }
      }

      pedidosVistosRef.current = new Set(resultado.map((p) => p.id));
      setPedidos(resultado);
    }
  };

  // SincronizaÃ§Ã£o imediata: os agendamentos que jÃ¡ existem entram na lista
  // de "jÃ¡ vistos" e nÃ£o disparam notificaÃ§Ã£o.
  atualizarPedidos();

  canal = supabase
    .channel(`agendamentos-realtime-${idProfissional}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "agendamentos" },
      () => atualizarPedidos()
    )
    .subscribe();

  intervalo = setInterval(atualizarPedidos, 20000);

  return () => {
    if (canal) supabase.removeChannel(canal);
    if (intervalo) clearInterval(intervalo);
  };
}, [profissionalLogado]);

// Carga a preferÃªncia do saldo de trabalhos guardada neste dispositivo.
useEffect(() => {
  if (profissionalLogado?.id) {
    setSaldoHabilitado(
      localStorage.getItem(`saldo_habilitado_${profissionalLogado.id}`) === "1"
    );
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

// Dias que possuem agendamento ativo, ordenados do mais prÃ³ximo ao mais distante.
const diasAgendados = [...new Set(
  pedidos
    .filter((pedido) => pedido.status === "Agendado")
    .map((pedido) => pedido.data)
)].sort();

// Saldo de trabalhos concluÃ­dos (semanal / quinzenal / mensal).
const diasPeriodoSaldo = {
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};
const hojeSaldo = new Date();
const hojeSaldoString = hojeSaldo.toLocaleDateString("sv-SE");
const limiteSaldoDate = new Date();
limiteSaldoDate.setDate(
  limiteSaldoDate.getDate() - (diasPeriodoSaldo[periodoSaldo] || 30)
);
const limiteSaldoString = limiteSaldoDate.toLocaleDateString("sv-SE");

const trabalhosConcluidos = pedidos
  .filter(
    (pedido) =>
      pedido.status === "ConcluÃ­do" &&
      pedido.data >= limiteSaldoString &&
      pedido.data <= hojeSaldoString
  )
  .reduce((soma, pedido) => soma + (Number(pedido.valor_servico) || 0), 0);

function formatarDiaAgendado(dia) {
  const d = new Date(dia + "T00:00:00");
  const nomesDias = ["dom", "seg", "ter", "qua", "qui", "sex", "sÃ¡b"];
  return `${nomesDias[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatarDataCompleta(dia) {
  const d = new Date(dia + "T00:00:00");
  return `${formatarDiaAgendado(dia)}/${d.getFullYear()}`;
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
      <p style={{ color: "#555" }}>Carregandoâ€¦</p>
    </div>
  );
}

async function alternarAtivoProfissional(profissional) {

  if (profissional.tipo === "super_admin") {
    alert("O administrador nÃ£o pode ser desativado.");
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
    .select("*");

  setProfissionais(data);

}

// Remarca (reagenda) um cliente para um novo dia e/ou horÃ¡rio.
async function salvarReagendamento() {
  if (!reagendandoPedido) return;

  setMensagemReagendamento("");
  setTipoMensagemReagendamento("");

  if (!novaDataReagendamento || !novoHorarioReagendamento) {
    setMensagemReagendamento("Escolha o novo dia e horÃ¡rio.");
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Cliente nÃ£o mudou de dia nem de horÃ¡rio.
  if (
    novaDataReagendamento === reagendandoPedido.data &&
    novoHorarioReagendamento === reagendandoPedido.horario
  ) {
    setMensagemReagendamento("Este cliente jÃ¡ estÃ¡ neste dia e horÃ¡rio.");
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
      "NÃ£o Ã© possÃ­vel reagendar para uma data que jÃ¡ passou."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  // NÃ£o permite reagendar para um dia de folga.
  const diasFolgaDoProfissional = await buscarDiasFolga(profissionalLogado.id);
  if (diasFolgaDoProfissional.includes(diaSemanaDaData(novaDataReagendamento))) {
    setMensagemReagendamento(
      "Este dia Ã© folga. Escolha outra data para reagendar."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  // TambÃ©m nÃ£o permite reagendar para uma data especÃ­fica de folga.
  const folgasDatasDoProfissional = await buscarFolgasDatas(profissionalLogado.id);
  if (folgasDatasDoProfissional.includes(novaDataReagendamento)) {
    setMensagemReagendamento(
      "Este dia Ã© folga. Escolha outra data para reagendar."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  const agora = new Date();

  const dataHoraEscolhida = new Date(
    `${novaDataReagendamento}T${novoHorarioReagendamento}:00`
  );

  if (dataHoraEscolhida < agora) {
    setMensagemReagendamento("Esse horÃ¡rio jÃ¡ passou.");
    setTipoMensagemReagendamento("erro");
    return;
  }

  // Confere se o novo dia/horÃ¡rio jÃ¡ estÃ¡ ocupado por outro agendamento ativo.
  const { data: conflitos, error: erroBusca } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("profissional_id", profissionalLogado.id)
    .eq("data", novaDataReagendamento)
    .eq("horario", novoHorarioReagendamento)
    .eq("status", "Agendado")
    .neq("id", reagendandoPedido.id);

  if (erroBusca) {
    console.error(erroBusca);
    setMensagemReagendamento(
      "Ocorreu um erro ao conferir o horÃ¡rio. Tente novamente."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  if (conflitos && conflitos.length > 0) {
    setMensagemReagendamento(
      "Esse dia e horÃ¡rio jÃ¡ estÃ£o ocupados por outro agendamento. Escolha outro."
    );
    setTipoMensagemReagendamento("erro");
    return;
  }

  const { error } = await supabase
    .from("agendamentos")
    .update({
      data: novaDataReagendamento,
      horario: novoHorarioReagendamento,
    })
    .eq("id", reagendandoPedido.id);

  if (error) {
    if (error.code === "23505") {
      setMensagemReagendamento(
        "Esse horÃ¡rio acabou de ser reservado por outra pessoa. Escolha outro."
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
  const { data: resultado, error: erroRecarga } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("profissional_id", profissionalLogado.id)
    .order("id", { ascending: false });

  if (!erroRecarga) {
    setPedidos(resultado);
  }

  setMensagemProfissional(
    `${reagendandoPedido.nome} remarcado(a) para ${formatarDataCompleta(novaDataReagendamento)} Ã s ${novoHorarioReagendamento}!`
  );
  setMensagemErroProfissional("");

  setReagendandoPedido(null);
  setNovaDataReagendamento("");
  setNovoHorarioReagendamento("");
  setHorariosReagendamento([]);
  setMensagemReagendamento("");
  setTipoMensagemReagendamento("");
}

// ---------------- Linhas de serviÃ§o (tela do CLIENTE) ----------------
function atualizarLinhaCliente(indice, campo, valor) {
  setItensCliente((prev) =>
    prev.map((item, i) => {
      if (i !== indice) return item;
      const atualizado = { ...item, [campo]: valor };
      if (campo === "servico") {
        const servicoEncontrado = servicos.find(
          (s) =>
            s.nome === valor &&
            s.profissional_id === profissionalCliente &&
            s.ativo
        );
        atualizado.valor = servicoEncontrado?.valor || 0;
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

// ---------------- Enviar pedido (tela do CLIENTE) ----------------
async function enviarPedidoCliente() {
  setMensagem("");
  setTipoMensagem("");

  if (!nome || !whatsapp) {
    setMensagem("Preencha seu nome e WhatsApp.");
    setTipoMensagem("erro");
    return;
  }

  if (
    itensCliente.some((item) => !item.servico || !item.data || !item.horario)
  ) {
    setMensagem("Preencha todos os campos de cada serviÃ§o.");
    setTipoMensagem("erro");
    return;
  }

  const numeroLimpo = whatsapp.replace(/\D/g, "");
  if (numeroLimpo.length !== 11) {
    setMensagem("Digite um WhatsApp vÃ¡lido com 11 nÃºmeros.");
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
    if (item.data < hoje) {
      setMensagem("NÃ£o Ã© possÃ­vel agendar uma data que jÃ¡ passou.");
      setTipoMensagem("erro");
      return;
    }
    if (
      diasFolgaDoProfissional.includes(diaSemanaDaData(item.data)) ||
      folgasDatasDoProfissional.includes(item.data)
    ) {
      setMensagem("Este dia Ã© folga do profissional. Escolha outra data.");
      setTipoMensagem("erro");
      return;
    }
    if (new Date(`${item.data}T${item.horario}:00`) < new Date()) {
      setMensagem("Esse horÃ¡rio jÃ¡ passou.");
      setTipoMensagem("erro");
      return;
    }
  }

  // Dois serviÃ§os nÃ£o podem ficar no mesmo dia e horÃ¡rio.
  const pares = itensCliente.map((item) => `${item.data}|${item.horario}`);
  if (new Set(pares).size !== pares.length) {
    setMensagem(
      "Dois serviÃ§os nÃ£o podem ficar no mesmo dia e horÃ¡rio. Escolha horÃ¡rios diferentes."
    );
    setTipoMensagem("erro");
    return;
  }

  const pedidosSalvos = [];

  for (const item of itensCliente) {
    const { data: horarioExistente, error: erroBusca } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("profissional_id", profissionalCliente)
      .eq("data", item.data)
      .eq("horario", item.horario)
      .eq("status", "Agendado")
      .maybeSingle();

    if (erroBusca) {
      console.error(erroBusca);
      return;
    }

    if (horarioExistente) {
      setMensagem("Esse horÃ¡rio jÃ¡ foi reservado. Escolha outro.");
      setTipoMensagem("erro");
      return;
    }

    const { data: pedidoSalvo, error } = await supabase
      .from("agendamentos")
      .insert([
        {
          nome,
          whatsapp,
          servico: item.servico,
          valor_servico: item.valor,
          data: item.data,
          horario: item.horario,
          status: "Agendado",
          horario_liberado: false,
          profissional_id: profissionalCliente,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        setMensagem("Esse horÃ¡rio acabou de ser reservado por outra pessoa.");
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
  }

  setPedidos((prev) => [...prev, ...pedidosSalvos]);

  setMensagem(
    ["cinza", "preto", "verde", "masculino"].includes(temaAtivo)
      ? "Agendamento realizado com sucesso! âœ”ï¸"
      : "Agendamento realizado com sucesso! â¤ï¸"
  );
  setTipoMensagem("sucesso");
  setMensagemProfissional("Novo pedido recebido!");
  setMensagemErroProfissional("");

  setNome("");
  setWhatsapp("");
  setItensCliente([novoItemCliente()]);
}

// ---------------- Linhas de serviÃ§o (agendar por um CLIENTE) ----------------
function atualizarLinhaAgendarCliente(indice, campo, valor) {
  setItensAgendarCliente((prev) =>
    prev.map((item, i) => {
      if (i !== indice) return item;
      const atualizado = { ...item, [campo]: valor };
      if (campo === "servico") {
        const servicoEncontrado = meusServicos.find(
          (s) => s.nome === valor && s.ativo
        );
        atualizado.valor = servicoEncontrado?.valor || 0;
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

// ---------------- Enviar pedido (formulÃ¡rio do PROFISSIONAL) ----------------
async function enviarPedidoAgendarCliente() {
  setMensagemAgendarCliente("");
  setTipoMensagemAgendarCliente("");

  if (!nome || !whatsapp) {
    setMensagemAgendarCliente("Preencha o nome e o WhatsApp do cliente.");
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  if (
    itensAgendarCliente.some(
      (item) => !item.servico || !item.data || !item.horario
    )
  ) {
    setMensagemAgendarCliente("Preencha todos os campos de cada serviÃ§o.");
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  const numeroLimpo = whatsapp.replace(/\D/g, "");
  if (numeroLimpo.length !== 11) {
    setMensagemAgendarCliente("Digite um WhatsApp vÃ¡lido com 11 nÃºmeros.");
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
    if (item.data < hoje) {
      setMensagemAgendarCliente(
        "NÃ£o Ã© possÃ­vel agendar uma data que jÃ¡ passou."
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }
    if (
      diasFolgaDoProfissional.includes(diaSemanaDaData(item.data)) ||
      folgasDatasDoProfissional.includes(item.data)
    ) {
      setMensagemAgendarCliente(
        "Este dia Ã© folga. NinguÃ©m pode agendar nele. Escolha outra data."
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }
    if (new Date(`${item.data}T${item.horario}:00`) < new Date()) {
      setMensagemAgendarCliente("Esse horÃ¡rio jÃ¡ passou.");
      setTipoMensagemAgendarCliente("erro");
      return;
    }
  }

  // Dois serviÃ§os nÃ£o podem ficar no mesmo dia e horÃ¡rio.
  const pares = itensAgendarCliente.map(
    (item) => `${item.data}|${item.horario}`
  );
  if (new Set(pares).size !== pares.length) {
    setMensagemAgendarCliente(
      "Dois serviÃ§os nÃ£o podem ficar no mesmo dia e horÃ¡rio. Escolha horÃ¡rios diferentes."
    );
    setTipoMensagemAgendarCliente("erro");
    return;
  }

  let totalCriados = 0;

  for (const item of itensAgendarCliente) {
    const datasDaRecorrencia = datasParaMeses(item.data, item.meses);

    // Se alguma data da recorrÃªncia cai em folga (semana ou data especÃ­fica),
    // bloqueia para nÃ£o criar agendamento em dia de folga.
    const datasRecorrenciaComFolga = datasDaRecorrencia.filter(
      (dataAlvo) =>
        folgasDatasDoProfissional.includes(dataAlvo) ||
        diasFolgaDoProfissional.includes(diaSemanaDaData(dataAlvo))
    );
    if (datasRecorrenciaComFolga.length > 0) {
      setMensagemAgendarCliente(
        `Uma das datas cai em dia de folga (${formatarDataCompleta(datasRecorrenciaComFolga[0])}). Ajuste a data ou os meses.`
      );
      setTipoMensagemAgendarCliente("erro");
      return;
    }

    const { data: conflitos, error: erroBusca } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("profissional_id", profissionalLogado.id)
      .in("data", datasDaRecorrencia)
      .eq("horario", item.horario)
      .eq("status", "Agendado");

    if (erroBusca) {
      console.error(erroBusca);
      return;
    }

    if (conflitos && conflitos.length > 0) {
      setMensagemAgendarCliente(
        `Esse horÃ¡rio jÃ¡ estÃ¡ reservado em ${formatarDataCompleta(conflitos[0].data)}. Escolha outro.`
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

    const { data: pedidosCriados, error } = await supabase
      .from("agendamentos")
      .insert(linhasAgendamento)
      .select();

    if (error) {
      if (error.code === "23505") {
        setMensagemAgendarCliente(
          "Esse horÃ¡rio acabou de ser reservado por outra pessoa."
        );
        setTipoMensagemAgendarCliente("erro");
        return;
      }
      console.error(error);
      return;
    }

    totalCriados += pedidosCriados?.length || 0;
  }

  const { data: resultado, error: erroRecarga } = await supabase
    .from("agendamentos")
    .select("*")
    .eq("profissional_id", profissionalLogado.id)
    .order("id", { ascending: false });

  if (!erroRecarga) {
    setPedidos(resultado);
  }

  setMensagemAgendarCliente(
    `Agendamento realizado com sucesso! âœ”ï¸ ${totalCriados} agendamento(s) criado(s).`
  );
  setTipoMensagemAgendarCliente("sucesso");

  setNome("");
  setWhatsapp("");
  setItensAgendarCliente([novoItemAgendarCliente()]);
}

return (
  <div style={appStyles} className={`app-wrapper ${["cinza", "preto", "verde", "masculino"].includes(temaAtivo) ? "cor-masculina" : ""}`}>
    <div className="app-content">

{tela === "inicio" && (
  <div className="inicio-container">
    <div className="login-card inicio-card">
      <h2>
        Sua agenda organizada
        <br />
        de forma simples e rÃ¡pida
      </h2>

      <p>Escolha como deseja entrar:</p>

      <div className="inicio-botoes">

        <button
          className="btn entrar"
          onClick={() => {
            setTela("cliente");
          }}
        >
          {iconeAtivo} Sou cliente
        </button>

        <button
          className="btn cadastrar"
          onClick={() => setTela("login")}
        >
          ðŸ’¼ Sou profissional
        </button>

      </div>
    </div>
  </div>
)}
{tela === "login" && (
<div className="login-card">

<div className="login-icone">
  ðŸ’¼
</div>

<h1 className="login-titulo">
  Ãrea Profissional
</h1>

<p className="login-descricao">
  Gerencie seus agendamentos com facilidade,
</p>



<input
  className="input-login"
  type="text"
  placeholder="Digite seu nome"
  value={loginNome}
  onChange={(e) => setLoginNome(e.target.value)}
/>


<input
  className="input-login"
  type="password"
  placeholder="Digite a senha"
  value={senha}
  onChange={(e) => setSenha(e.target.value)}
/>

<button className="btn-login"
onClick={async () => {

const { data: resultado, error } = await supabase
  .from("profissionais")
  .select("*")
  .eq("nome", loginNome)
  .eq("senha", senha);

console.log("RETORNO LOGIN:", resultado);
console.log("ERRO LOGIN:", error);


if (error || !resultado || resultado.length === 0) {
  setMensagemLogin("Nome ou senha incorretos!");
  return;
}
if (resultado.length > 1) {
  setMensagemLogin("Existem perfis com esse nome e senha duplicados. O administrador precisa corrigir.");
  return;
}

const resultadoLogado = resultado[0];

if (!resultadoLogado.ativo) {
  setMensagemLogin("Este perfil estÃ¡ desativado.");
  return;
}

setProfissionalLogado(resultadoLogado);
localStorage.setItem("profissionalLogado", JSON.stringify(resultadoLogado));
// Remove os parÃ¢metros do link de login da URL para a sessÃ£o valer no refresh.
window.history.replaceState({}, "", window.location.pathname);
setNotificacaoNovoAgendamento(null);
setTemaSelecionado(resultadoLogado.tema || "feminino");
setIconeSelecionado(resultadoLogado.icone || (resultadoLogado.tema === "masculino" ? "ðŸ’ˆ" : "ðŸ’…"));

setMensagemLogin("");

if (resultadoLogado.tipo === "super_admin") {
  setTela("admin");
} else {
  setTela("profissional");
}

setSenha("");
setLoginNome("");

}}
>
Entrar
</button>

<button className="btn-voltar"
  onClick={async () => {
   setMensagemLogin("");
   setLoginNome("");
    setTela("inicio");
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
    <h1>Agendar horÃ¡rio</h1>

  <p>
    Escolha o melhor horÃ¡rio para vocÃª
  </p>

  {console.log("PROFISSIONAL CLIENTE:", profissionalCliente)}

  <p className="status-text">
    {
    statusAtendimento === "Ocupado"
    ?
    "ðŸ”´ Ocupado"
    :
    "ðŸŸ¢ DisponÃ­vel"
    }
  </p>
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
{itensCliente.map((item, indice) => (
  <div key={indice} className="linha-servico">
    <label>
      ServiÃ§o {indice + 1}
    </label>

    <select
      value={item.servico}
      onChange={(e) => {
        atualizarLinhaCliente(indice, "servico", e.target.value);
      }}
    >
      <option value="">
        Escolha o serviÃ§o
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
            {iconeAtivo} {s.nome}{s.duracao ? ` - â° ${s.duracao}` : ""}{s.valor ? ` - ðŸ’° R$ ${s.valor}` : ""}
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

    <label>HorÃ¡rio</label>
    <select
      value={item.horario}
      onChange={(e) => atualizarLinhaCliente(indice, "horario", e.target.value)}
    >
      <option value="">
        Escolha o horÃ¡rio
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

    {item.data && (horariosPorLinhaCliente[indice] || []).length === 0 && (
      <small>
        {diasFolgaCliente.includes(diaSemanaDaData(item.data)) ||
        folgasDatasCliente.includes(item.data)
          ? "ðŸš« Este dia Ã© folga do profissional. Escolha outra data."
          : "Nenhum horÃ¡rio livre para este dia. Escolha outra data."}
      </small>
    )}

    {indice > 0 && (
      <button
        type="button"
        className="linha-remover"
        onClick={() => removerLinhaCliente(indice)}
      >
        âœ– Remover este serviÃ§o
      </button>
    )}
  </div>
))}

<button
  type="button"
  className="linha-adicionar"
  onClick={adicionarLinhaCliente}
>
  âž• Adicionar outro serviÃ§o
</button>

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
  <h3>ðŸ’  Pagamento via Pix</h3>

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
    {pixCopiada ? "âœ… Chave Pix copiada!" : "ðŸ“‹ Copiar chave Pix"}
  </button>
</div>
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
        <p>ServiÃ§o: {iconeAtivo} {p.servico}</p>
        <p>Data: {p.data}</p>
        <p>HorÃ¡rio: {p.horario}</p>
        {indice < pedido.length - 1 && <hr />}
      </div>
    ))}
</div>
)}

<button
  onClick={async () => {
    setMensagem("");
    setTipoMensagem("");
    setTela("inicio");
  }}
>
  Voltar
</button>

</div>
)}
{tela === "admin" && (
  <div className="admin-area">
    <div className="admin-card">

    <div className="admin-header">

<p>
  
</p>

      <h1>
        OlÃ¡, {profissionalLogado?.nome}
      </h1>

      <small>
        Gerencie profissionais e configuraÃ§Ãµes
      </small>

    </div>

    <div className="admin-senha-area">
      {!desbloqueadoAdmin ? (
        <>
          <p>ðŸ”’ Ãrea protegida â€” digite a senha do administrador para acessar as opÃ§Ãµes (editar, desativar, excluir, ver senha).</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="password"
              placeholder="Senha do administrador"
              value={senhaOpcoesAdmin}
              onChange={(e) => setSenhaOpcoesAdmin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (senhaOpcoesAdmin === SENHA_ADMIN_OPCOES) {
                    setDesbloqueadoAdmin(true);
                    setSenhaOpcoesAdmin("");
                  } else {
                    alert("Senha incorreta!");
                    setSenhaOpcoesAdmin("");
                  }
                }
              }}
            />
            <button
              onClick={() => {
                if (senhaOpcoesAdmin === SENHA_ADMIN_OPCOES) {
                  setDesbloqueadoAdmin(true);
                  setSenhaOpcoesAdmin("");
                } else {
                  alert("Senha incorreta!");
                  setSenhaOpcoesAdmin("");
                }
              }}
            >
              ðŸ”“ Desbloquear opÃ§Ãµes
            </button>
          </div>
        </>
      ) : (
        <>
          <p>âœ… Ãrea desbloqueada â€” as opÃ§Ãµes estÃ£o liberadas.</p>
          <button
            onClick={() => {
              setDesbloqueadoAdmin(false);
              setProfissionalEditando(null);
              setMostrarSenha(false);
            }}
          >
            ðŸ”’ Bloquear opÃ§Ãµes
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

    <h3>Profissionais cadastrados</h3>
    <div className="resumo-dashboard">

  <div className="resumo-card">
    <h3>ðŸ‘¥ Profissionais</h3>
    <p>{profissionais.length}</p>
  </div>


  <div
    className="resumo-card resumo-card-clicavel"
    onClick={() =>
      setMostrarListaAdmin(mostrarListaAdmin === "ativos" ? null : "ativos")
    }
  >
    <h3>ðŸŸ¢ Ativos</h3>
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
    <h3>ðŸ”´ Desativados</h3>
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
    <h4>ðŸŸ¢ Profissionais ativos</h4>
    {profissionais.filter((p) => p.ativo).length === 0 && (
      <p>Nenhum profissional ativo.</p>
    )}
    {profissionais.filter((p) => p.ativo).map((profissional) => (
      <div key={profissional.id} className="admin-sublista-item">
        <span>ðŸ‘¤ {profissional.nome}{profissional.tipo === "super_admin" && " ðŸ‘‘"}</span>
        {desbloqueadoAdmin ? (
          profissional.tipo === "super_admin" ? (
            <small>ðŸ‘‘</small>
          ) : (
            <button onClick={() => alternarAtivoProfissional(profissional)}>
              ðŸš« Desativar
            </button>
          )
        ) : (
          <small>ðŸ”’</small>
        )}
      </div>
    ))}
  </div>
)}

{mostrarListaAdmin === "desativados" && (
  <div className="admin-sublista">
    <h4>ðŸ”´ Profissionais bloqueados</h4>
    {profissionais.filter((p) => !p.ativo).length === 0 && (
      <p>Nenhum profissional bloqueado.</p>
    )}
    {profissionais.filter((p) => !p.ativo).map((profissional) => (
      <div key={profissional.id} className="admin-sublista-item">
        <span>ðŸ‘¤ {profissional.nome}{profissional.tipo === "super_admin" && " ðŸ‘‘"}</span>
        {desbloqueadoAdmin ? (
          profissional.tipo === "super_admin" ? (
            <small>ðŸ‘‘</small>
          ) : (
            <button onClick={() => alternarAtivoProfissional(profissional)}>
              âœ… Ativar
            </button>
          )
        ) : (
          <small>ðŸ”’</small>
        )}
      </div>
    ))}
  </div>
)}
    <div className="admin-secao">
    

<button
  onClick={async () => {

    const { data: resultado, error } = await supabase
      .from("profissionais")
      .select("*");

    if (error) {
      console.error(error);
      return;
    }

   setProfissionais(resultado);
    const { count } = await supabase
  .from("agendamentos")
  .select("*", { count: "exact", head: true });

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
  ðŸ‘¤ {profissional.nome}
</p>

<p>
  ðŸ†” ID: {profissional.id}
</p>

<p>
  Status: {profissional.ativo ? "ðŸŸ¢ Ativo" : "ðŸ”´ Inativo"}
</p>

{
  profissionais.filter(
    (p) => p.nome === profissional.nome && p.senha === profissional.senha
  ).length > 1 && (
    <p style={{ color: "#d32f2f", fontWeight: "bold", marginTop: "8px" }}>
      âš ï¸ Nome e senha duplicados! Ajuste um deles para evitar confusÃ£o no login.
    </p>
  )
}



</div>


{profissional.tipo !== "super_admin" && (
  <div className="link-profissional">
    <p>ðŸ“… Link do cliente â€” para o cliente agendar</p>
    <button
      onClick={async () => {
        const link = `${window.location.origin}/?profissional=${profissional.id}`;
        try {
          await navigator.clipboard.writeText(link);
          alert("Link do cliente copiado!");
        } catch (err) {
          alert(link);
        }
      }}
    >
      ðŸ“‹ Copiar link do cliente
    </button>

    <p>ðŸ’¼ Link do profissional â€” para abrir o login direto</p>
    <button
      onClick={async () => {
        const link = `${window.location.origin}/?profissional=${profissional.id}&login=1`;
        try {
          await navigator.clipboard.writeText(link);
          alert("Link do profissional copiado!");
        } catch (err) {
          alert(link);
        }
      }}
    >
      ðŸ“‹ Copiar link do profissional
    </button>
  </div>
)}


{desbloqueadoAdmin && (
  <div className="profissional-botoes">
    {profissional.tipo === "super_admin" ? (
      <button disabled style={{ background: "#6b7280", cursor: "not-allowed" }}>
        ðŸ‘‘ Administrador
      </button>
    ) : (
      <button onClick={() => alternarAtivoProfissional(profissional)}>
        {profissional.ativo ? "Desativar" : "Ativar"}
      </button>
    )}
    {profissional.tipo !== "super_admin" && (
      <button
        onClick={async () => {

          if (profissional.tipo === "super_admin") {
            alert("O administrador nÃ£o pode ser excluÃ­do.");
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

          alert("Profissional excluÃ­do com sucesso!");

        }}
      >
        ðŸ—‘ï¸ Excluir perfil
      </button>
    )}

    <button
      className="btn-editar"
      onClick={() => {

        setProfissionalEditando(profissional);

        setEditarNome(profissional.nome);

        setEditarSenha(profissional.senha);

        setMostrarSenha(false);

      }}
    >
      âœï¸ Editar
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
  placeholder="Nova senha"
  value={editarSenha}
  onChange={(e) => setEditarSenha(e.target.value)}
/>

<button
  onClick={() => setMostrarSenha(!mostrarSenha)}
>
  {mostrarSenha ? "ðŸ™ˆ Esconder senha" : "ðŸ‘ï¸ Ver senha"}
</button>

<button
  onClick={async () => {

    const { error } = await supabase
      .from("profissionais")
      .update({
        nome: editarNome,
        senha: editarSenha,
      })
      .eq("id", profissional.id);

    if (error) {
      console.error(error);
      alert("Erro ao atualizar.");
      return;
    }

    const { data } = await supabase
      .from("profissionais")
      .select("*");

   setProfissionais(data);

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


        const { error } = await supabase
          .from("profissionais")
          .insert([
            {
          nome: novoNome,
          senha: novaSenha,
          tipo: "profissional",
          ativo: true,
          status_atendimento: "DisponÃ­vel",
          tema: temaNovo
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
.select("*");

setProfissionais(data);

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
        setProfissionalLogado(null);
        setTela("inicio");
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
  Ãrea Profissional
</p>

<h2>
  OlÃ¡, {profissionalLogado?.nome} ðŸ‘‹
</h2>
<div style={{marginTop:"20px"}}>




</div>

  <small>
    Gerencie seus agendamentos com facilidade
  </small>

        </div>
<h3>
  {iconeAtivo} Meus serviÃ§os
</h3>
<button
onClick={async () => {

const novoStatus =
statusAtendimento === "DisponÃ­vel"
? "Ocupado"
: "DisponÃ­vel";


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
statusAtendimento === "DisponÃ­vel"
?
"ðŸŸ¢ DisponÃ­vel"
:
"ðŸ”´ Ocupado"
}

</button>


<button
  className="btn-config-principal"
  onClick={() => {
    const abrir = !mostrarAgendarCliente;
    setMostrarAgendarCliente(abrir);
    if (abrir) {
      // ComeÃ§a o formulÃ¡rio limpo
      setNome("");
      setWhatsapp("");
      setItensAgendarCliente([novoItemAgendarCliente()]);
      setMensagemAgendarCliente("");
      setTipoMensagemAgendarCliente("");
    }
  }}
>
  {mostrarAgendarCliente
    ? "âŒ Fechar agendamento por cliente"
    : "ðŸ“ Agendar por um cliente"}
</button>

{mostrarAgendarCliente && (
  <div className="agendar-cliente-form">
    <h3>ðŸ“ Agendar por um cliente</h3>
    <small>
      Use esta opÃ§Ã£o quando o cliente nÃ£o conseguir agendar sozinho,
      por exemplo quando estÃ¡ sem celular.
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

    {itensAgendarCliente.map((item, indice) => (
      <div key={indice} className="linha-servico">
        <label>ServiÃ§o {indice + 1}</label>
        <select
          value={item.servico}
          onChange={(e) =>
            atualizarLinhaAgendarCliente(indice, "servico", e.target.value)
          }
        >
          <option value="">Escolha o serviÃ§o</option>

          {meusServicos
            .filter((s) => s.ativo)
            .map((s) => (
              <option key={s.id} value={s.nome}>
                {iconeAtivo} {s.nome}{s.duracao ? ` - â° ${s.duracao}` : ""}{s.valor ? ` - ðŸ’° R$ ${s.valor}` : ""}
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

        <label>HorÃ¡rio</label>
        <select
          value={item.horario}
          onChange={(e) =>
            atualizarLinhaAgendarCliente(indice, "horario", e.target.value)
          }
        >
          <option value="">Escolha o horÃ¡rio</option>

          {(horariosPorLinhaAgendarCliente[indice] || []).map((hora) => (
            <option key={hora} value={hora}>
              {hora}
            </option>
          ))}
        </select>

        {item.data &&
          (horariosPorLinhaAgendarCliente[indice] || []).length === 0 && (
            <small>
              {diasFolga.includes(diaSemanaDaData(item.data)) ||
                folgasDatas.includes(item.data)
                ? "ðŸš« Este dia Ã© folga. NinguÃ©m pode agendar nele."
                : "Nenhum horÃ¡rio livre para este dia. Escolha outra data."}
            </small>
          )}

        <label>Repetir por quantos meses?</label>
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
          {Array.from({ length: 12 }, (_, i) => i + 1).map((qtd) => (
            <option key={qtd} value={qtd}>
              {qtd === 1
                ? "Somente este mÃªs"
                : `Repetir por ${qtd} ${qtd === 1 ? "mÃªs" : "meses"}`}
            </option>
          ))}
        </select>

        {item.data && item.meses > 1 && (
          <small>
            Vai bloquear o mesmo dia e horÃ¡rio em:{" "}
            {datasParaMeses(item.data, item.meses)
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
            âœ– Remover este serviÃ§o
          </button>
        )}
      </div>
    ))}

    <button
      type="button"
      className="linha-adicionar"
      onClick={adicionarLinhaAgendarCliente}
    >
      âž• Adicionar outro serviÃ§o
    </button>

    <button
      onClick={enviarPedidoAgendarCliente}
    >
      âœ“ Confirmar agendamento
    </button>

    <button
      className="agendar-cliente-cancelar"
      onClick={() => {
        setMostrarAgendarCliente(false);
        setMensagemAgendarCliente("");
        setTipoMensagemAgendarCliente("");
      }}
    >
      âŒ Cancelar
    </button>
  </div>
)}

<button
className="btn-config-principal"
onClick={() =>
setMostrarConfiguracoes(!mostrarConfiguracoes)
}
>
âš™ï¸ ConfiguraÃ§Ãµes
</button>

{mostrarConfiguracoes && (
<div>

<div className="config-servicos">



<div className="link-profissional">
  <p>ðŸ“… Link de agendamento â€” para o cliente agendar</p>
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
      const link = `${window.location.origin}/?profissional=${profissionalLogado?.id}`;
      try {
        await navigator.clipboard.writeText(link);
        alert("Link de agendamento copiado!");
      } catch (err) {
        alert(link);
      }
    }}
  >
    ðŸ“‹ Copiar link de agendamento
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
          ? "ðŸš« Desativar saldo de trabalhos"
          : "ðŸ’° Ativar saldo de trabalhos"}
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
          {mostrarSaldo ? "ðŸ™ˆ" : "ðŸ‘ï¸"}
        </button>
      )}
    </div>
    <small className="dica-dias-agendados">
      Mostra quantos trabalhos foram concluÃ­dos por perÃ­odo (semanal, quinzenal, mensal).
    </small>
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
          setCorMensagem("âŒ Erro ao salvar a cor do perfil.");
          setCorMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          tema: temaSelecionado,
        });

        setCorMensagem("âœ… Cor atualizada com sucesso!");
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
  <label>Ãcone do perfil</label>
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
          setIconeMensagem("âŒ Erro ao salvar o Ã­cone do perfil.");
          setIconeMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          icone: iconeSelecionado,
        });

        setIconeMensagem("âœ… Ãcone atualizado com sucesso!");
        setIconeMensagemTipo("sucesso");
      }}
    >
      Salvar Ã­cone
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
  <label>ðŸ’  Pix para pagamento</label>
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
      placeholder="Banco (ex.: Nubank, ItaÃº...)"
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
        "ItaÃº",
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
          setPixMensagem("âŒ Erro ao salvar o PIX: " + error.message);
          setPixMensagemTipo("erro");
          return;
        }

        setProfissionalLogado({
          ...profissionalLogado,
          chave_pix: chaveLimpa,
          banco_pix: bancoLimpo,
          nome_pix: nomeLimpo,
        });

        setPixMensagem("âœ… Pix salvo com sucesso!");
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

<button
onClick={() => {
  setMostrarConfiguracaoServicos(
    !mostrarConfiguracaoServicos
  );
}}
>
{
mostrarConfiguracaoServicos
?
"âŒ Fechar serviÃ§os"
:
"âš™ï¸ Configurar serviÃ§os"
}
</button>


{mostrarConfiguracaoServicos && (

<div>

<input
placeholder="Nome do serviÃ§o"
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
placeholder="DuraÃ§Ã£o (ex: 1 hora)"
value={novaDuracao}
onChange={(e) =>
setNovaDuracao(e.target.value)
}
/>

<button
onClick={async () => {
if (!novoServico.trim()) {
  alert("Digite o nome do serviÃ§o.");
  return;
}


const { error } = await supabase
.from("servicos")
.insert([
{
  nome: novoServico,
  valor: novoValor || null,
  duracao: novaDuracao || null,
  profissional_id: profissionalLogado.id,
  ativo: true
}
]);


if(error){
console.error(error);
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

alert("ServiÃ§o criado!");

}}
>
Adicionar serviÃ§o
</button>
<h3>ðŸ“‹ ServiÃ§os cadastrados</h3>

{meusServicos.map((item) => (
  <div key={item.id} className="servico-card" style={{ opacity: item.ativo ? 1 : 0.5, background: item.ativo ? "#ffffff" : "#f5f5f5" }}>

  {servicoEditandoId === item.id ? (
    <div className="servico-editar">
      <p><strong>âœï¸ Editando: {item.nome}</strong></p>

      <input
        placeholder="Nome do serviÃ§o"
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
        placeholder="DuraÃ§Ã£o (ex: 1 hora)"
        value={editaDuracao}
        onChange={(e) => setEditaDuracao(e.target.value)}
      />

      <button
        onClick={async () => {
          if (!editaNome.trim()) {
            alert("Digite o nome do serviÃ§o.");
            return;
          }

          const { error } = await supabase
            .from("servicos")
            .update({
              nome: editaNome,
              valor: editaValor || null,
              duracao: editaDuracao || null,
            })
            .eq("id", item.id);

          if (error) {
            console.error(error);
            alert("Erro ao editar serviÃ§o: " + error.message);
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
          alert("ServiÃ§o atualizado!");
        }}
      >
        ðŸ’¾ Salvar alteraÃ§Ãµes
      </button>

      <button
        style={{ marginLeft: "8px", background: "#6b7280" }}
        onClick={() => setServicoEditandoId(null)}
      >
        âŒ Cancelar
      </button>
    </div>
  ) : (
  <div>
<p>
  {iconeAtivo} {item.nome}{!item.ativo && " (Inativo)"}
</p>

<p>
  ðŸ’° R$ {item.valor ?? 0}
</p>

<p>
  â° {item.duracao || "â€”"}
</p>

    <button
      onClick={() => {
        setServicoEditandoId(item.id);
        setEditaNome(item.nome);
        setEditaValor(item.valor || "");
        setEditaDuracao(item.duracao || "");
      }}
    >
      âœï¸ Editar
    </button>

    <button
      style={{ marginLeft: "8px" }}
      onClick={async () => {

        if (item.ativo) {
          const { error } = await supabase
            .from("servicos")
            .update({ ativo: false })
            .eq("id", item.id);

          if(error){
            console.error(error);
            alert("Erro ao desativar serviÃ§o: " + error.message);
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

          alert("ServiÃ§o desativado!");
        } else {
          const { error } = await supabase
            .from("servicos")
            .update({ ativo: true })
            .eq("id", item.id);

          if(error){
            console.error(error);
            alert("Erro ao reativar serviÃ§o: " + error.message);
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

          alert("ServiÃ§o reativado!");
        }

      }}
    >
      {item.ativo ? "ðŸ—‘ï¸ Desativar" : "â™»ï¸ Reativar"}
    </button>

    <button
      style={{ marginLeft: "8px", background: "#d32f2f" }}
      onClick={async () => {
        const { error } = await supabase
          .from("servicos")
          .delete()
          .eq("id", item.id);

        if(error){
          console.error(error);
          alert("Erro ao excluir: " + error.message + "\n\nProvavelmente hÃ¡ agendamentos vinculados. Use 'Desativar' em vez de excluir.");
          return;
        }

        setMeusServicos(prev => prev.filter(s => s.id !== item.id));

        setServicos(prev =>
          prev.filter(s => s.id !== item.id)
        );

        alert("ServiÃ§o excluÃ­do permanentemente!");
      }}
    >
      ðŸ—‘ï¸ Excluir
    </button>

  </div>
  )}

</div>
))}

</div>

)}

</div>


<button
  className="btn-config-horarios"
  onClick={() =>
    setMostrarConfiguracaoHorarios(!mostrarConfiguracaoHorarios)
  }
>
  {mostrarConfiguracaoHorarios
    ? "âŒ Fechar horÃ¡rios"
    : "âš™ï¸ Configurar horÃ¡rios"}
</button>


{mostrarConfiguracaoHorarios && (

<div className={`config-horarios${diasFolga.includes(diaSelecionado) ? " dia-folga-ativo" : ""}`}>

<h3>â° Meus horÃ¡rios de atendimento</h3>


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

{dia}{diasFolga.includes(dia) ? " ðŸš«" : ""}

</option>

))}

</select>



<h4>ðŸš« Dias de folga</h4>

<p className="dica-folga">
  Marque os dias em que ninguÃ©m poderÃ¡ agendar. O dia fica todo bloqueado.
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

<h4>ðŸ—“ï¸ Folgas em datas especÃ­ficas</h4>

<p className="dica-folga">
  Marque um dia no mÃªs que vocÃª nÃ£o vai atender (ex.: feriado, viagem,
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
        setFolgaDataMensagem("Essa data jÃ¡ estÃ¡ marcada como folga.");
        setFolgaDataMensagemTipo("erro");
        return;
      }

      const { error } = await supabase
        .from("folgas")
        .insert([{ profissional_id: profissionalLogado.id, data: dataFolga }]);

      if (error) {
        console.error(error);
        setFolgaDataMensagem("âŒ Erro ao marcar a folga: " + error.message);
        setFolgaDataMensagemTipo("erro");
        return;
      }

      setFolgasDatas((prev) => [...prev, dataFolga]);
      setDataFolga("");
      setFolgaDataMensagem(
        "âœ… Folga marcada para " + formatarDataCompleta(dataFolga)
      );
      setFolgaDataMensagemTipo("sucesso");
    }}
  >
    âž• Adicionar folga
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
        ðŸ“… {formatarDataCompleta(dataAlvo)}
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
          âœ–
        </button>
      </span>
    ))}
  </div>
)}

<h4>Escolha os horÃ¡rios:</h4>

<p className="aviso-folga">
  ðŸš« Este dia estÃ¡ marcado como folga. Retire a folga dele para poder escolher
  horÃ¡rios.
</p>

<div className="periodos-botoes">

<button 
onClick={() => setPeriodoHorario("todos")}
onDoubleClick={() => marcarPeriodo("todos")}
>
ðŸ“‹ Todos
</button>

<button 
onClick={() => setPeriodoHorario("madrugada")}
onDoubleClick={() => marcarPeriodo("madrugada")}
>
ðŸŒ™ Madrugada
</button>

<button 
onClick={() => setPeriodoHorario("manha")}
onDoubleClick={() => marcarPeriodo("manha")}
>
â˜€ï¸ ManhÃ£
</button>

<button 
onClick={() => setPeriodoHorario("tarde")}
onDoubleClick={() => marcarPeriodo("tarde")}
>
ðŸŒ‡ Tarde
</button>

<button 
onClick={() => setPeriodoHorario("noite")}
onDoubleClick={() => marcarPeriodo("noite")}
>
ðŸŒƒ Noite
</button>

</div>

<div className="btn-copiar-bloco">

<button
type="button"
className="btn-copiar-horarios"
onClick={copiarHorariosParaTodosDias}
>
ðŸ“‹ Copiar estes horÃ¡rios para todos os dias
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
    <h3>ðŸ“… Hoje</h3>
    <p>
      {
        pedidos.filter(
          (pedido) =>
            pedido.data === new Date().toLocaleDateString("sv-SE") &&
            pedido.status === "Agendado"
        ).length
      } horÃ¡rios
    </p>
  </div>


  <div
    className="resumo-card resumo-card-clicavel"
    onClick={() => setMostrarDiasAgendados(!mostrarDiasAgendados)}
    title="Clique para mostrar os dias agendados"
  >
    <h3>ðŸŸ¢ Ativos</h3>
    <p>
      {
        pedidos.filter(
          (pedido) => pedido.status === "Agendado"
        ).length
      } marcados
    </p>
    <small className="dica-dias-agendados">
      {mostrarDiasAgendados ? "â–² Esconder dias agendados" : "â–¼ Ver dias agendados"}
    </small>
  </div>

</div>

{saldoHabilitado && mostrarSaldo && (
  <div className="saldo-trabalhos-area">
    <h3>ðŸ’° Saldo de trabalhos</h3>

    <div className="saldo-periodos">
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
    </div>

    <p className="saldo-numero">R$ {trabalhosConcluidos.toFixed(2).replace(".", ",")}</p>
    <p className="saldo-legenda">
      {periodoSaldo === "semanal"
        ? "valor dos trabalhos concluÃ­dos nos Ãºltimos 7 dias"
        : periodoSaldo === "quinzenal"
        ? "valor dos trabalhos concluÃ­dos nos Ãºltimos 15 dias"
        : "valor dos trabalhos concluÃ­dos nos Ãºltimos 30 dias"}
    </p>
  </div>
)}

{mostrarDiasAgendados && (
  <div className="dias-agendados-area">
    <h3>ðŸ—“ï¸ Dias com agendamento</h3>

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
        ? "âœ– Sair do modo excluir"
        : "ðŸ—‘ï¸ Selecionar para excluir"}
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

                const { error } = await supabase
                  .from("agendamentos")
                  .delete()
                  .eq("profissional_id", profissionalLogado.id)
                  .in("data", diasSelecionadosExclusao)
                  .eq("status", "Agendado");

                if (error) {
                  console.error(error);
                  return;
                }

                const { data, error: erroBusca } = await supabase
                  .from("agendamentos")
                  .select("*")
                  .eq("profissional_id", profissionalLogado.id)
                  .order("id", { ascending: false });

                if (!erroBusca) {
                  setPedidos(data);
                  localStorage.setItem("pedidos", JSON.stringify(data));
                }

                setDiasSelecionadosExclusao([]);
                setSelecionarParaExcluir(false);
                setMensagemErroProfissional(
                  `Agendamentos excluÃ­dos! (${totalAgendamentosDosDias})`
                );
              }}
            >
              ðŸ—‘ï¸ Excluir agendamentos selecionados
            </button>

            <button
              className="exclusao-limpar"
              onClick={() => setDiasSelecionadosExclusao([])}
            >
              âœ– Limpar seleÃ§Ã£o
            </button>
          </div>
        );
      })()}

    <small className="dica-dias-agendados">
      {selecionarParaExcluir
        ? "Marque os dias e exclua os agendamentos ativos de uma vez."
        : "Clique em um dia para o calendÃ¡rio abrir nele."}
    </small>
  </div>
)}

            <h2>ðŸ“… Agenda de horÃ¡rios</h2>

<Calendar
  onChange={setDataSelecionada}
  value={dataSelecionada}
  onActiveStartDateChange={({ action, activeStartDate }) => {
    // Ao navegar para outro mÃªs/ano, troca a seleÃ§Ã£o para o 1Âº dia do novo
    // perÃ­odo. Assim o agendamento do mÃªs anterior nÃ£o fica aparecendo como
    // se fosse um agendamento do mÃªs atual.
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

// Dia de folga do profissional (ninguÃ©m consegue agendar nesse dia).
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
  â° {pedido.horario}
</h3>


<div className="info-agendamento">

<p>{iconeCliente} {pedido.nome}</p>

<p>
  <FaWhatsapp />
  {pedido.whatsapp}
</p>

<p>{iconeAtivo} {pedido.servico}</p>

<p>
  ðŸ’° {Number(pedido.valor_servico || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
</p>

<p>ðŸ“… {pedido.data}</p>

<p>
Status:

{
pedido.status === "Agendado"
? "ðŸŸ¢ Agendado"
: pedido.status === "Cancelado"
? "ðŸ”´ Cancelado"
: "âœ… ConcluÃ­do"
}

</p>

</div>
{(pedido.status === "Cancelado" || pedido.status === "ConcluÃ­do") && (
  <p>
    Cancelado em: {pedido.datacancelamento}
  </p>
)}

{(pedido.status === "Cancelado" || pedido.status === "ConcluÃ­do") && (
  <button
onClick={async () => {

      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", pedido.id);

      if (error) {
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
      setMensagemErroProfissional("Agendamento excluÃ­do!");
    }}
  >
    Excluir agendamento
  </button>
)}
{pedido.status === "Agendado" && (

<>

<button
onClick={async () => {


const { error } = await supabase
.from("agendamentos")
.update({
  status: "ConcluÃ­do",
  horario_liberado: true
})
.eq("id", pedido.id);


if(error){
  console.error(error);
  return;
}


const { data, error: erroBusca } = await supabase
.from("agendamentos")
.select("*")
.eq("profissional_id", profissionalLogado.id)
.order("id", { ascending:false });


if(erroBusca){
  console.error(erroBusca);
  return;
}
console.log("PEDIDOS DETALHADOS:", pedidos);
console.table(pedidos);

setPedidos(data);

setMensagemProfissional("Trabalho concluÃ­do!");
await supabase
.from("profissionais")
.update({
 status_atendimento: "DisponÃ­vel"
})
.eq("id", profissionalLogado.id);


setStatusAtendimento("DisponÃ­vel");
}}
>
âœ… Finalizar trabalho
</button>


<button
onClick={async () => {

  setMensagemProfissional("");
  setMensagemErroProfissional("");
  
  const { error } = await supabase
    .from("agendamentos")
    .update({
      status: "Cancelado",
      datacancelamento: new Date().toLocaleString(),
    })
    .eq("id", pedido.id);


  if(error){
    console.error(error);
    return;
  }


const { data, error: erroBusca } = await supabase
.from("agendamentos")
.select("*")
.eq("profissional_id", profissionalLogado.id)
.order("id", { ascending:false });


if(erroBusca){
console.error(erroBusca);
return;
}


setPedidos(data);

setMensagemErroProfissional("Agendamento cancelado!");

}}
>
âŒ Cancelar agendamento
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
  ðŸ”„ Reagendar
</button>

{(() => {
  const grupoRecorrencia = mesesDaRecorrencia(pedido, pedidos, profissionalLogado?.id);

  // SÃ³ mostra se realmente for uma recorrÃªncia com mais de 1 mÃªs.
  if (grupoRecorrencia.length <= 1) {
    return null;
  }

  return (
    <button
      onClick={async () => {
        const confirmar = window.confirm(
          `Cancelar toda a recorrÃªncia de ${pedido.nome} (${grupoRecorrencia.length} meses) no horÃ¡rio ${pedido.horario}?`
        );

        if (!confirmar) {
          return;
        }

        const { error } = await supabase
          .from("agendamentos")
          .update({
            status: "Cancelado",
            datacancelamento: new Date().toLocaleString(),
          })
          .in("id", grupoRecorrencia.map((item) => item.id));

        if (error) {
          console.error(error);
          return;
        }

        const { data, error: erroBusca } = await supabase
          .from("agendamentos")
          .select("*")
          .eq("profissional_id", profissionalLogado.id)
          .order("id", { ascending: false });

        if (!erroBusca) {
          setPedidos(data);
        }

        setMensagemProfissional("");
        setMensagemErroProfissional(
          `RecorrÃªncia cancelada! (${grupoRecorrencia.length} meses)`
        );
      }}
    >
      âŒ Cancelar recorrÃªncia ({grupoRecorrencia.length} meses)
    </button>
  );
})()}

{reagendandoPedido?.id === pedido.id && (
  <div className="agendar-cliente-form reagendar-form">
    <h3>ðŸ”„ Reagendar cliente</h3>

    <small>
      Agendamento atual: {formatarDataCompleta(pedido.data)} Ã s{" "}
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

    <label>Novo horÃ¡rio</label>
    <select
      value={novoHorarioReagendamento}
      onChange={(e) => setNovoHorarioReagendamento(e.target.value)}
    >
      <option value="">Escolha o horÃ¡rio</option>

      {horariosReagendamento.map((hora) => (
        <option key={hora} value={hora}>
          {hora}
        </option>
      ))}
    </select>

    {novaDataReagendamento && horariosReagendamento.length === 0 && (
      <small>
        {diasFolga.includes(diaSemanaDaData(novaDataReagendamento)) ||
        folgasDatas.includes(novaDataReagendamento)
          ? "ðŸš« Este dia Ã© folga. Escolha outra data."
          : "Nenhum horÃ¡rio disponÃ­vel para este dia. Escolha outra data."}
      </small>
    )}

    <button type="button" onClick={salvarReagendamento}>
      âœ“ Confirmar reagendamento
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
      âŒ Cancelar
    </button>
  </div>
)}

</>

)}

    </div>
))}



<button
  onClick={() => {
    setMensagemProfissional("");
    setMensagemErroProfissional("");
    setTela("inicio");
  }}
>
  Voltar
</button>

  </div>
)}

{profissionalLogado && notificacaoNovoAgendamento && (
  <div
    className="notificacao-whatsapp notificacao-clicavel"
    onClick={() => setNotificacaoNovoAgendamento(null)}
    title="Clique para confirmar que viu"
  >
    <div className="notificacao-icone">
      <FaWhatsapp />
    </div>
    <div className="notificacao-conteudo">
      <strong>Novo agendamento</strong>
      <span>ðŸ‘¤ {notificacaoNovoAgendamento.nome}</span>
      <span><FaWhatsapp /> {notificacaoNovoAgendamento.whatsapp}</span>
      <span>{iconeAtivo} {notificacaoNovoAgendamento.servico}</span>
      <span>ðŸ“… {formatarDataCompleta(notificacaoNovoAgendamento.data)} Â· â° {notificacaoNovoAgendamento.horario}</span>
      <span className="notificacao-confirmar">âœ“ Clique para confirmar que viu</span>
    </div>
  </div>
)}
    </div>
    <footer className="rodape">
      <p>
        Â© 2026 Agenda Pro - Todos os direitos reservados.
      </p>

      <p>
        Sistema de agendamentos desenvolvido por DÃ¡rio JÃºnior
      </p>
    </footer>

  </div>
);
}

export default App;

