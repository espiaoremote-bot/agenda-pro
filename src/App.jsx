import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

console.log("ESTOU NO ARQUIVO CERTO 999");
console.log("Supabase:", supabase);
console.log("ESTOU NO APP JSX CERTO");


function App() {
  console.log("APP ESTÁ RODANDO");
console.log("EU EDITEI ESTE ARQUIVO AGORA 123456");
  
  const [tela, setTela] = useState("inicio");
  const [senha, setSenha] = useState("");
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
const horariosDisponiveis = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30"
];
const [whatsapp, setWhatsapp] = useState("");
const [data, setData] = useState("");
useEffect(() => {
  async function carregarPedidos() {
    console.log("TESTANDO SUPABASE:", supabase);

    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setPedidos(data);
  }

  carregarPedidos();
}, [tela]);
const horariosOcupados = pedidos
  .filter((item) => item.status !== "Cancelado")
  .filter((item) => item.data === data)
  .map((item) => item.horario);

console.log("Pedidos:", pedidos);
console.log("Horários ocupados:", horariosOcupados);

const dataSelecionadaFormatada = dataSelecionada
  .toLocaleDateString("sv-SE");

const pedidosDoDia = pedidos.filter(
  (pedido) => pedido.data === dataSelecionadaFormatada
);
  return (
    <div className="card">

{tela === "inicio" && (
  <div>
   <h1>Agenda Pro</h1>

    <p>Escolha uma opção</p>

<button
  className="btn entrar"
  onClick={() => setTela("cliente")}
>
  Sou cliente
</button>

<button
  className="btn cadastrar"
 onClick={() => setTela("login")}
>
  Sou profissional
</button>
  </div>
)}
{tela === "login" && (
<div>

<h1>Login Profissional</h1>

<input
  type="password"
  placeholder="Digite a senha"
  value={senha}
  onChange={(e) => setSenha(e.target.value)}
/>

<button
onClick={async () => {
if (senha === "cafe") {
 setMensagemLogin("");

 setTela("profissional");
 setSenha("");
} else {
  setMensagemLogin("Senha incorreta!");
}
  }}
>
  Entrar
</button>

<button
  onClick={async () => {
   setMensagemLogin("");
    setTela("inicio");
  }}
>
  Voltar
</button>
{mensagemLogin && (
  <p style={{ color: "red" }}>
    {mensagemLogin}
  </p>
)}

</div>
)}

{tela === "cliente" && (
<div>

    <h1>Agendar horário</h1>

{mensagem && (
  <p style={{ color: tipoMensagem === "erro" ? "red" : "green" }}>
    {mensagem}
  </p>
)}

<input
  placeholder="Nome"
  value={nome}
  maxLength="20"
  onChange={(e) => {
    const somenteLetras = e.target.value.replace(/[0-9]/g, "");
    setNome(somenteLetras);
  }}
/>

<input
  placeholder="WhatsApp"
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
<input
  type="date"
  value={data}
  min={new Date().toLocaleDateString("sv-SE")}
  onChange={(e) => setData(e.target.value)}
/>

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



const { data: pedidoSalvo, error } = await supabase
  .from("agendamentos")
  .insert([
    {
      nome,
      whatsapp,
      servico,
      data,
      horario,
      status: "Agendado"
    }
  ])
  .select()
  .single();

if (error) {
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
  Status: {pedido.status === "Agendado" ? "🟢" : "🔴"} {pedido.status}
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


{tela === "profissional" && (
        <div>
          <h1>Área Profissional</h1>

            <p>Acesse sua agenda e pedidos</p>
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
      return "dia-verde";
    }

    if (temCancelado) {
      return "dia-vermelho";
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

      <h3>📌 Horário marcado</h3>
      <p>Nome: {pedido.nome}</p>
<p>WhatsApp: {pedido.whatsapp}</p>
<p>Serviço: {pedido.servico}</p>
<p>Data: {pedido.data}</p>
<p>⏰ Horário: {pedido.horario}</p>

<p>
  Status: {pedido.status === "Agendado" ? "🟢 Agendado" : "🔴 Cancelado"}
</p>

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

  if (error) {
    console.error(error);
    return;
  }

  const { data, error: erroBusca } = await supabase
    .from("agendamentos")
    .select("*")
    .order("id", { ascending: false });

  if (erroBusca) {
    console.error(erroBusca);
    return;
  }

  setPedidos(data);
setMensagemProfissional("");
setMensagemErroProfissional("Agendamento cancelado!");
}}
  >
    Cancelar agendamento
  </button>
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
