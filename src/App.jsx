import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

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
  onChange={(e) => setNome(e.target.value)}
/>

<input
  placeholder="WhatsApp"
  value={whatsapp}
  maxLength="11"
  onChange={(e) => {
    const apenasNumeros = e.target.value.replace(/\D/g, "");
    setWhatsapp(apenasNumeros);
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

    const horarioJaExiste = pedidos.some(
      (item) =>
        item.data === data &&
        item.horario === horario &&
        item.status !== "Cancelado"
    );

    if (horarioJaExiste) {
      setMensagem("Esse horário já está ocupado.");
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

{pedidos.map((pedido, index) => (
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
      setMensagemErroProfissional("Agendamento excluído!✅");
    }}
  >
    Excluir agendamento
  </button>
)}

{pedido.status === "Agendado" && (
  <button
onClick={async () => {
  console.log("CLIQUEI EM CANCELAR", pedido.id);
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
setMensagemErroProfissional("Agendamento cancelado!✅");
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