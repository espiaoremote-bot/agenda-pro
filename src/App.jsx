import Calendar from "react-calendar";
import { FaWhatsapp } from "react-icons/fa";
import "react-calendar/dist/Calendar.css";
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import "./styles.css";


console.log("ESTOU NO ARQUIVO CERTO 999");
console.log("Supabase:", supabase);
console.log("ESTOU NO APP JSX CERTO");



function App() {
  const [tela, setTela] = useState("inicio");

const [senha, setSenha] = useState("");
  console.log("APP ESTÁ RODANDO");
console.log("EU EDITEI ESTE ARQUIVO AGORA 123456");

const [profissionalLogado, setProfissionalLogado] = useState(null);
const [profissionalCliente, setProfissionalCliente] = useState(null);
const [dadosProfissionalCliente, setDadosProfissionalCliente] = useState(null);
const [temaNovo, setTemaNovo] = useState("feminino");
const [servicos, setServicos] = useState([]);
const [novoServico, setNovoServico] = useState("");
const [novoValor, setNovoValor] = useState("");
const [novaDuracao, setNovaDuracao] = useState("");
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
const [data, setData] = useState("");

const [mensagem, setMensagem] = useState("");
const [tipoMensagem, setTipoMensagem] = useState("");
const [mensagemProfissional, setMensagemProfissional] = useState("");
const [mensagemLogin, setMensagemLogin] = useState("");
const [mensagemErroProfissional, setMensagemErroProfissional] = useState("");

const [pedido, setPedido] = useState(null);
const [pedidos, setPedidos] = useState([]);

const [dataSelecionada, setDataSelecionada] = useState(new Date());
const [nome, setNome] = useState("");
const [servico, setServico] = useState("");
const [horario, setHorario] = useState("");
const [mostrarConfiguracaoServicos, setMostrarConfiguracaoServicos] = useState(false);
const [mostrarConfiguracoes, setMostrarConfiguracoes] = useState(false);

const [mostrarConfiguracaoHorarios, setMostrarConfiguracaoHorarios] = useState(false);

const [statusAtendimento, setStatusAtendimento] = useState("Disponível");
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
resultado.status_atendimento || "Disponível"
);


}


carregarHorariosProfissional();


}, [profissionalLogado]);

const diasSemana = [
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
  "domingo"
];
const [diaSelecionado, setDiaSelecionado] = useState("segunda");

const [horariosTrabalho, setHorariosTrabalho] = useState([]);

const [periodoHorario, setPeriodoHorario] = useState("todos");

const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);

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

let horariosParaMarcar = listaHorarios.filter((hora)=>{

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


const novosHorarios = horariosParaMarcar.filter(
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
return;
}

}


setHorariosTrabalho([
...new Set([
...horariosTrabalho,
...horariosParaMarcar
])
]);

}
useEffect(() => {

async function carregarHorariosCliente(){

if(!profissionalCliente || !data){
  setHorariosDisponiveis([]);
  return;
}


// pega o dia da semana da data escolhida
const dataEscolhida = new Date(data + "T00:00:00");

const dias = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado"
];

const diaSemana = dias[dataEscolhida.getDay()];


const { data: horarios, error } = await supabase
.from("horarios_trabalho")
.select("horario")
.eq("profissional_id", profissionalCliente)
.eq("dia_semana", diaSemana);


if(error){
console.error(error);
return;
}


setHorariosDisponiveis(
  horarios
  .map(item => item.horario)
  .filter(hora => !horariosOcupados.includes(hora))
);


}


carregarHorariosCliente();


}, [profissionalCliente, data]);

const params = new URLSearchParams(window.location.search);

const profissionalIdLink = Number(params.get("profissional"));

console.log("Profissional pelo link:", profissionalIdLink);

useEffect(() => {

async function abrirLink(){

if(!profissionalIdLink) return;


setProfissionalCliente(profissionalIdLink);


const {data,error}=await supabase
.from("profissionais")
.select("*")
.eq("id", profissionalIdLink)
.single();


if(error){
 console.error(error);
 return;
}


setDadosProfissionalCliente(data);
setTela("cliente");

}

abrirLink();

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
return;
}


setDadosProfissionalCliente(data);
console.log("TEMA DO PROFISSIONAL:", data.tema);

}


carregarProfissionalCliente();


}, [profissionalCliente]);

useEffect(() => {

  async function carregarPedidos() {


    const idProfissional = profissionalLogado?.id || profissionalCliente;


    if (!idProfissional) {
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


const horariosOcupados = pedidos
  .filter((item) => {

    if (item.data !== data) return false;

    // continua bloqueando agendamentos ativos
if (
  item.status === "Agendado" &&
  item.horario_liberado !== true
) {
  return true;
}

    return false;

  })
  .map((item) => item.horario);


console.log("Horários ocupados:", horariosOcupados);
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
  resultado.map((item) => item.horario)
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
return (
  <div>

{tela === "inicio" && (

<div className={
  dadosProfissionalCliente?.tema === "masculino"
  ? "inicio-container masculino"
  : "inicio-container feminino"
}>

    <h2>
      Sua agenda organizada
      <br />
      de forma simples e rápida
    </h2>

<p>Escolha como deseja entrar:</p>

<div className="inicio-botoes">

<button
  className="btn entrar"
  onClick={() => {
    setTela("cliente");
  }}
>
{
dadosProfissionalCliente?.tema === "masculino"
? "💈 Sou cliente"
: "💅 Sou cliente"
}
</button>

<button
  className="btn cadastrar"
  onClick={() => setTela("login")}
>
  💼 Sou profissional
</button>

</div>

  </div>
)}
{tela === "login" && (
<div className={
  profissionalLogado?.tema === "masculino"
  ? "login-card masculino"
  : "login-card"
}>

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
  .eq("senha", senha)
  .single();

console.log("RETORNO LOGIN:", resultado);
console.log("ERRO LOGIN:", error);


if (error || !resultado) {
  setMensagemLogin("Senha incorreta!");
  return;
}

setProfissionalLogado(resultado);

setMensagemLogin("");

if (resultado.tipo === "super_admin") {
  setTela("admin");
} else {
  setTela("profissional");
}

setSenha("");

}}
>
Entrar
</button>

<button className="btn-voltar"
  onClick={async () => {
   setMensagemLogin("");
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
<div className={
 dadosProfissionalCliente?.tema === "masculino"
 ? "cliente-card masculino"
 : "cliente-card"
}>



<div className="cliente-icone">
  {
    dadosProfissionalCliente?.tema === "masculino"
    ? "💈"
    : "💅"
  }
  <h1>Agendar horário</h1>

  <p>
    Escolha o melhor horário para você
  </p>

  {console.log("PROFISSIONAL CLIENTE:", profissionalCliente)}

<p>
{
statusAtendimento === "Ocupado"
?
"🔴 Ocupado"
:
"🟢 Disponível"
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
<label>
  Serviço
</label>

<select
  value={servico}
  onChange={(e) => setServico(e.target.value)}
>
  <option value="">
    Escolha o serviço
  </option>

  {servicos
    .filter(
      (item) => 
      item.profissional_id === profissionalCliente &&
      item.ativo
    )
    .map((item) => (
<option 
key={item.id}
value={item.nome}
>
{item.nome} - {item.duracao}
</option>
    ))
  }

</select>

<label>Data</label>

<input
  type="date"
  value={data}
  min={new Date().toLocaleDateString("sv-SE")}
  onChange={(e) => setData(e.target.value)}
/>
<label>Horário</label>
  <select
  value={horario}
  onChange={(e) => setHorario(e.target.value)}
>
  <option value="">
    Escolha o horário
  </option>

{horariosDisponiveis.map((hora) => (

<option
  key={hora}
  value={hora}
>
  {hora}
</option>

))}

</select>

<button
onClick={async () => {

  

  console.log("CLIQUEI NO BOTÃO ENVIAR");

if (!nome || !whatsapp || !servico || !data || !horario) {
  setMensagem("Preencha todos os campos.");
  setTipoMensagem("erro");
  return;
}

const hoje = new Date().toLocaleDateString("sv-SE");

if (data < hoje) {
  setMensagem("Não é possível agendar uma data que já passou.");
  setTipoMensagem("erro");
  return;
}

const numeroLimpo = whatsapp.replace(/\D/g, "");

if (numeroLimpo.length !== 11) {
  setMensagem("Digite um WhatsApp válido com 11 números.");
  setTipoMensagem("erro");
  return;
}
const { data: horarioExistente, error: erroBusca } = await supabase
  .from("agendamentos")
  .select("*")
  .eq("profissional_id", profissionalCliente)
  .eq("data", data)
  .eq("horario", horario)
  .eq("status", "Agendado")
  .maybeSingle();

  if (erroBusca) {
  console.error(erroBusca);
  return;
}


if (horarioExistente) {

  setMensagem("Esse horário já foi reservado. Escolha outro.");
  setTipoMensagem("erro");

  return;
}


const { data: pedidoSalvo, error } = await supabase
  .from("agendamentos")
.insert([
{
  nome,
  whatsapp,
  servico,
  data,
  horario,
  status: "Agendado",
  horario_liberado: false,
  profissional_id: profissionalCliente,
}
])
  .select()
  .single();

if (error) {

  if (error.code === "23505") {
    setMensagem("Esse horário acabou de ser reservado por outra pessoa.");
    setTipoMensagem("erro");
    return;
  }

  console.error(error);
  return;
}

setPedido(pedidoSalvo);

setPedidos([
  ...pedidos,
  pedidoSalvo
]);

setMensagem("Agendamento realizado com sucesso! ❤️");
setTipoMensagem("sucesso");
setMensagemProfissional("Novo pedido recebido!");
setMensagemErroProfissional("");


setNome("");
setWhatsapp("");
setServico("");
setData("");
setHorario("");
  }}
>
Enviar pedido
</button>
  {pedido && (
<div>
    <h3>Pedido salvo:</h3>
    <p>Nome: {pedido.nome}</p>
    <p>WhatsApp: {pedido.whatsapp}</p>
    <p>Serviço: {pedido.servico}</p>
    <p>Data: {pedido.data}</p>
    <p>Horário: {pedido.horario}</p>
<p>
Status:

{
pedido.status === "Agendado" && pedido.horario_liberado === false
? "🔴 Em atendimento"
: pedido.status === "Cancelado"
? "🔴 Cancelado"
: "🟢 Disponível"
}

</p>
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
        👑 Olá, {profissionalLogado?.nome}
      </h1>

      <small>
        Gerencie profissionais e configurações
      </small>

    </div>
    <h3>Profissionais cadastrados</h3>
    <div className="resumo-dashboard">

  <div className="resumo-card">
    <h3>👥 Profissionais</h3>
    <p>{profissionais.length}</p>
  </div>


  <div className="resumo-card">
    <h3>🟢 Ativos</h3>
    <p>
      {
        profissionais.filter(
          (p) => p.ativo
        ).length
      }
    </p>
  </div>


  <div className="resumo-card">
    <h3>📅 Agendamentos</h3>
    <p>{totalAgendamentos}</p>
  </div>

</div>
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
  👤 {profissional.nome}
</p>

<p>
  🆔 ID: {profissional.id}
</p>

<p>
  Status: {profissional.ativo ? "🟢 Ativo" : "🔴 Inativo"}
</p>

</div>

<p>
  Link:
  <br />

  {window.location.origin}/?profissional={profissional.id}
</p>


<button
  onClick={async () => {

    const { error } = await supabase
      .from("profissionais")
      .update({
        ativo: !profissional.ativo
      })
      .eq("id", profissional.id);

    if (error) {
      console.error(error);
      return;
    }

    const { data } = await supabase
      .from("profissionais")
      .select("*");

    setProfissionais(data);

  }}
>
  {profissional.ativo ? "Desativar" : "Ativar"}
</button>
<button
  onClick={async () => {

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

<button
  className="btn-editar"
  onClick={() => {

    setProfissionalEditando(profissional);

    setEditarNome(profissional.nome);

    setEditarSenha(profissional.senha);

    setMostrarSenha(false);

  }}
>
  ✏️ Editar
</button>
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
  {mostrarSenha ? "🙈 Esconder senha" : "👁️ Ver senha"}
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
  <option value="feminino">
    💅 Feminino
  </option>

<option value="masculino">
  💈 Masculino
</option>
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
          status_atendimento: "Disponível",
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
      onClick={() => setTela("inicio")}
    >
      Sair
    </button>

    </div>
  </div>
)}

{tela === "profissional" && (
  <div 
    className={
      profissionalLogado?.tema === "masculino"
      ? "profissional-container masculino"
      : "profissional-container"
    }
  >
          
<div className="profissional-header">

<p style={{ marginTop: "10px" }}>
  Área Profissional
</p>

<h2>
  Olá, {profissionalLogado?.nome} 👋
</h2>
<div style={{marginTop:"20px"}}>




</div>

  <small>
    Gerencie seus agendamentos com facilidade
  </small>

        </div>
<h3>
{
  profissionalLogado?.tema === "masculino"
  ? "💈 Meus serviços"
  : "💅 Meus serviços"
}
</h3>
<button
onClick={async () => {

const novoStatus =
statusAtendimento === "Disponível"
? "Ocupado"
: "Disponível";


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
statusAtendimento === "Disponível"
?
"🟢 Disponível"
:
"🔴 Ocupado"
}

</button>


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

<div className="config-servicos">



<button
style={{
padding:"12px",
marginLeft:"10px",
background:"#2563eb",
color:"white",
border:"none",
borderRadius:"12px",
cursor:"pointer"
}}
onClick={() => {

const link = `${window.location.origin}/?profissional=${profissionalLogado?.id}`;

navigator.clipboard.writeText(link);

alert("Link copiado!");

}}
>
📋 Copiar link
</button>

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
"❌ Fechar serviços"
:
"⚙️ Configurar serviços"
}
</button>


{mostrarConfiguracaoServicos && (

<div>

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


<button
onClick={async () => {

if (!novoServico.trim()) {
  alert("Digite o nome do serviço.");
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

alert("Serviço criado!");

}}
>
Adicionar serviço
</button>
<h3>📋 Serviços cadastrados</h3>

{meusServicos.map((item) => (
  <div key={item.id} className="servico-card">

    <p>
{
profissionalLogado?.tema === "masculino"
? "💈"
: "💅"
}
{" "}
{item.nome}
</p>

    <p>
      💰 R$ {item.valor}
    </p>

    <p>
      ⏰ {item.duracao}
    </p>

    <button
      onClick={async () => {

        const confirmar = window.confirm(
          "Deseja excluir este serviço?"
        );

        if(!confirmar) return;

        const { error } = await supabase
          .from("servicos")
          .delete()
          .eq("id", item.id);

        if(error){
          console.error(error);
          return;
        }

        setMeusServicos(
          meusServicos.filter(
            (servico) => servico.id !== item.id
          )
        );

      }}
    >
      🗑️ Excluir
    </button>

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
    ? "❌ Fechar horários"
    : "⚙️ Configurar horários"}
</button>


{mostrarConfiguracaoHorarios && (

<div className="config-horarios">

<h3>⏰ Meus horários de atendimento</h3>


<h4>Escolha o dia da semana:</h4>

<select
value={diaSelecionado}
onChange={async (e)=>{

const novoDia = e.target.value;

setDiaSelecionado(novoDia);


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
  resultado.map((item) => item.horario.slice(0,5))
);


}}

>

{diasSemana.map((dia)=>(

<option
key={dia}
value={dia}
>

{dia}

</option>

))}

</select>



<h4>Escolha os horários:</h4>

<div style={{
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "15px"
}}>

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


<div>


{horariosFiltrados.map((hora) => (


<label 
key={hora}
style={{display:"block"}}
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


  <div className="resumo-card">
    <h3>🟢 Ativos</h3>
    <p>
      {
        pedidos.filter(
          (pedido) => pedido.status === "Agendado"
        ).length
      } marcados
    </p>
  </div>

</div>
            <h2>📅 Agenda de horários</h2>

<Calendar
  onChange={setDataSelecionada}
  value={dataSelecionada}

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
</h3>


<div className="info-agendamento">

<p>👩🏻 {pedido.nome}</p>

<p>
  <FaWhatsapp />
  {pedido.whatsapp}
</p>

<p>💅 {pedido.servico}</p>

<p>📅 {pedido.data}</p>

<p>
Status:

{
pedido.status === "Agendado"
? "🟢 Agendado"
: pedido.status === "Cancelado"
? "🔴 Cancelado"
: "✅ Concluído"
}

</p>

</div>
{(pedido.status === "Cancelado" || pedido.status === "Concluído") && (
  <p>
    Cancelado em: {pedido.datacancelamento}
  </p>
)}

{(pedido.status === "Cancelado" || pedido.status === "Concluído") && (
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
      setMensagemErroProfissional("Agendamento excluído!");
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
  status: "Concluído",
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

setMensagemProfissional("Trabalho concluído!");
await supabase
.from("profissionais")
.update({
 status_atendimento: "Disponível"
})
.eq("id", profissionalLogado.id);


setStatusAtendimento("Disponível");
}}
>
✅ Finalizar trabalho
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
❌ Cancelar agendamento
</button>

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

  </div>
);
}

export default App;
