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
  console.log("APP ESTÁ RODANDO");
console.log("EU EDITEI ESTE ARQUIVO AGORA 123456");
  
const [tela, setTela] = useState("inicio");

const [senha, setSenha] = useState("");

const [profissionalLogado, setProfissionalLogado] = useState(null);
const [profissionalCliente, setProfissionalCliente] = useState(null);

const [profissionais, setProfissionais] = useState([]);
const [totalAgendamentos, setTotalAgendamentos] = useState(0);
const [mostrarSenha, setMostrarSenha] = useState(false);
const [novoNome, setNovoNome] = useState("");

const [novaSenha, setNovaSenha] = useState("");
const [profissionalEditando, setProfissionalEditando] = useState(null);

const [editarNome, setEditarNome] = useState("");

const [editarSenha, setEditarSenha] = useState("");


const [mensagem, setMensagem] = useState("");
const [tipoMensagem, setTipoMensagem] = useState("");
const [mensagemProfissional, setMensagemProfissional] = useState("");
const [mensagemLogin, setMensagemLogin] = useState("");
const [mensagemErroProfissional, setMensagemErroProfissional] = useState("");

const [pedido, setPedido] = useState(null);
useEffect(() => {

async function atualizarStatusCliente(){

if(!pedido?.id) return;


const { data, error } = await supabase
.from("agendamentos")
.select("*")
.eq("id", pedido.id)
.single();


if(error){
console.error(error);
return;
}


setPedido(data);


}


const intervalo = setInterval(
atualizarStatusCliente,
5000
);


return () => clearInterval(intervalo);


}, [pedido]);
const [pedidos, setPedidos] = useState([]);
const [dataSelecionada, setDataSelecionada] = useState(new Date());
const [nome, setNome] = useState("");
const [servico, setServico] = useState("");
const [horario, setHorario] = useState("");
const [mostrarConfiguracaoHorarios, setMostrarConfiguracaoHorarios] = useState(false);
const [horariosSelecionados, setHorariosSelecionados] = useState([]);

useEffect(() => {

async function carregarHorariosProfissional(){

if(!profissionalLogado) return;


const { data, error } = await supabase
.from("profissionais")
.select("horarios_disponiveis")
.eq("id", profissionalLogado.id)
.single();


if(error){
console.error(error);
return;
}


setHorariosSelecionados(
data.horarios_disponiveis || []
);


}


carregarHorariosProfissional();


}, [profissionalLogado]);


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
const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
useEffect(() => {

  async function carregarHorarios() {

    const idProfissional = profissionalCliente;

    if (!idProfissional) return;

    const { data, error } = await supabase
      .from("profissionais")
      .select("horarios_disponiveis")
      .eq("id", idProfissional)
      .single();


    if (error) {
      console.error(error);
      return;
    }


console.log(
"HORÁRIOS DO PROFISSIONAL:",
data.horarios_disponiveis
);
console.log("HORÁRIOS DO PROFISSIONAL:", data.horarios_disponiveis);
setHorariosDisponiveis(
 data.horarios_disponiveis || []
);

  }

  carregarHorarios();

}, [profissionalCliente]);
const [whatsapp, setWhatsapp] = useState("");
const [data, setData] = useState("");
const params = new URLSearchParams(window.location.search);

const profissionalIdLink = Number(params.get("profissional"));

console.log("Profissional pelo link:", profissionalIdLink);

useEffect(() => {

  if (profissionalIdLink) {
    setProfissionalCliente(profissionalIdLink);
    setTela("cliente");
  }

}, []);

useEffect(() => {

  async function carregarPedidos() {


    const idProfissional = profissionalLogado?.id || profissionalCliente;


    if (!idProfissional) {
      console.log("SEM PROFISSIONAL AINDA");
      return;
    }


    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("profissional_id", idProfissional)
      .order("id", { ascending: false });


    if (error) {
      console.error(error);
      return;
    }


    setPedidos(data);

  }


  carregarPedidos();


}, [tela, profissionalLogado, profissionalCliente]);
const agora = new Date();

const horariosOcupados = pedidos
  .filter((item) => {

    if (item.data !== data) return false;

    if (item.horario_liberado === true) return false;

    const dataHoraAgendamento = new Date(`${item.data}T${item.horario}:00`);

    return dataHoraAgendamento >= agora;

  })
  .map((item) => item.horario);

console.log("Pedidos:", pedidos);
console.log("Horários ocupados:", horariosOcupados);

const dataSelecionadaFormatada = dataSelecionada
  .toLocaleDateString("sv-SE");

const pedidosDoDia = pedidos.filter(
  (pedido) => pedido.data === dataSelecionadaFormatada
);
return (
  <div>

{tela === "inicio" && (
  <div>

    <h2>
      Sua agenda organizada
      <br />
      de forma simples e rápida
    </h2>

    <p>Escolha como deseja entrar:</p>

    <button
      className="btn entrar"
      onClick={() => {
        setTela("cliente");
      }}
    >
      💅 Sou cliente
    </button>

    <button
      className="btn cadastrar"
      onClick={() => setTela("login")}
    >
      💼 Sou profissional
    </button>

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
  type="password"
  placeholder="Digite a senha"
  value={senha}
  onChange={(e) => setSenha(e.target.value)}
/>

<button className="btn-login"
onClick={async () => {

const { data, error } = await supabase
  .from("profissionais")
  .select("*")
  .eq("senha", senha)
  .single();

  console.log("RETORNO LOGIN:", data);
console.log("ERRO LOGIN:", error);


if (error || !data) {
  setMensagemLogin("Senha incorreta!");
  return;
}

if (!data.ativo) {
  setMensagemLogin("Este profissional está desativado.");
  return;
}

setProfissionalLogado(data);

setMensagemLogin("");

if (data.tipo === "super_admin") {
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
<div className="cliente-card">



<div className="cliente-topo">

  <div className="cliente-icone">
    💅
  </div>

  <h1>Agendar horário</h1>

  <p>
    Escolha o melhor horário para você
  </p>

</div>


<div className="legenda-status">

  <div>
    <span className="bolinha-verde"></span>
    Disponível
  </div>

  <div>
    <span className="bolinha-vermelha"></span>
    Ocupado
  </div>

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
  <option value="">Escolha o serviço</option>

  <option value="Manicure Simples">
    Manicure Simples
  </option>

  <option value="Pedicure Simples">
    Pedicure Simples
  </option>

  <option value="Esmaltação em Gel">
    Esmaltação em Gel
  </option>

  <option value="Manicure + Esmaltação em Gel">
    Manicure + Esmaltação em Gel
  </option>

  <option value="Pedicure + Esmaltação em Gel">
    Pedicure + Esmaltação em Gel
  </option>

  <option value="Postiça realista">
    Postiça realista
  </option>

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

{horariosDisponiveis
  .filter((hora) => !horariosOcupados.includes(hora))
  .map((hora) => (
    <option key={hora} value={hora}>
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
pedido.status === "Agendado"
? "🟢 Agendado"
: pedido.status === "Cancelado"
? "🔴 Cancelado"
: "✅ Concluído"
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

    const { data, error } = await supabase
      .from("profissionais")
      .select("*");

    if (error) {
      console.error(error);
      return;
    }

    setProfissionais(data); 
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

  http://localhost:5173/?profissional={profissional.id}
</p>

<button
  onClick={() => {

    const link = `http://localhost:5173/?profissional=${profissional.id}`;

    window.open(link, "_blank");

  }}
>
  🔗 Abrir agenda
</button>
<button
  onClick={() => {

    const link = `http://localhost:5173/?profissional=${profissional.id}`;

    navigator.clipboard.writeText(link);

    alert("Link copiado!");

  }}
>
  📋 Copiar link
</button>

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


    <h3>Cadastrar profissional</h3>

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
              ativo: true
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
  <div className="profissional-container">
          
<div className="profissional-header">

<p style={{ marginTop: "10px" }}>
  Área Profissional
</p>

<h2>
  Olá, {profissionalLogado?.nome} 👋
</h2>

  <small>
    Gerencie seus agendamentos com facilidade
  </small>

</div>
<div className="link-profissional">

<h3>
🔗 Meu link de agendamento
</h3>

<p>

</p>

<button
onClick={() => {

const link = `http://localhost:5173/?profissional=${profissionalLogado?.id}`;

navigator.clipboard.writeText(link);

alert("Link copiado!");

}}
>
📋 Copiar link
</button>

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

<div>

{listaHorarios.map((hora) => (

<label key={hora}>

<input
type="checkbox"
checked={horariosSelecionados.includes(hora)}

onChange={() => {

if (horariosSelecionados.includes(hora)) {

setHorariosSelecionados(
horariosSelecionados.filter(
(item) => item !== hora
)
);

} else {

setHorariosSelecionados([
...horariosSelecionados,
hora
]);

}

}}

/>

{hora}

</label>

))}

</div>

</div>

)}

<button
onClick={async () => {

const { error } = await supabase
.from("profissionais")
.update({
  horarios_disponiveis: horariosSelecionados
})
.eq("id", profissionalLogado.id);


if(error){
  console.error(error);
  alert("Erro ao salvar horários");
  return;
}


alert("Horários salvos com sucesso!");

}}
>
Salvar horários
</button>
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
{pedido.status === "Cancelado" && (
  <p>
    Cancelado em: {pedido.datacancelamento}
  </p>
)}

{pedido.status === "Cancelado" && (
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


setPedidos(data);

setMensagemProfissional("Trabalho concluído!");

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
