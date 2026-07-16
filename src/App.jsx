console.log("ESTOU NO ARQUIVO CERTO 999");
import { useState, useEffect } from "react";
console.log("ESTOU NO APP JSX CERTO");


function App() {
  console.log("APP ESTÁ RODANDO");
  console.log("VERSÃO TESTE EXCLUIR 9999");
  
  const [tela, setTela] = useState("inicio");
const [mensagem, setMensagem] = useState("");
const [mensagemProfissional, setMensagemProfissional] = useState("");

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
  const dadosSalvos = localStorage.getItem("pedidos");

  if (dadosSalvos) {
    setPedidos(JSON.parse(dadosSalvos));
  }
}, []);
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
  onClick={() => setTela("profissional")}
>
  Sou profissional
</button>
  </div>
)}


{tela === "cliente" && (
<div>
    <h1>Agendar horário</h1>

<input
  placeholder="Nome"
  value={nome}
  onChange={(e) => setNome(e.target.value)}
/>

   <input
  placeholder="WhatsApp"
  value={whatsapp}
  onChange={(e) => setWhatsapp(e.target.value)}
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
  onClick={() => {
const novoPedido = {
  id: Date.now(),
  nome,
  whatsapp,
  servico,
  data,
  horario,
  status: "Agendado",
};

setPedido(novoPedido);

const novosPedidos = [
  ...pedidos,
  novoPedido,
];

setPedidos(novosPedidos);

localStorage.setItem(
  "pedidos",
  JSON.stringify(novosPedidos)
);

setMensagem("Pedido enviado! Aguarde a confirmação.");
setMensagemProfissional("Novo pedido recebido!");
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

<button onClick={() => setTela("inicio")}>
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
    Cancelado em: {pedido.dataCancelamento}
  </p>
)}
{pedido.status === "Cancelado" && (
  <button
    onClick={() => {
      const novosPedidos = pedidos.filter(
        (item) => item.id !== pedido.id
      );

      setPedidos(novosPedidos);

      localStorage.setItem(
        "pedidos",
        JSON.stringify(novosPedidos)
      );

      setMensagemProfissional("Agendamento excluído!");
    }}
  >
    Excluir agendamento
  </button>
)}
{pedido.status === "Agendado" && (
  <button
    onClick={() => {
      const novosPedidos = pedidos.map((item, i) =>
        i === index
? { 
    ...item, 
    status: "Cancelado",
    dataCancelamento: new Date().toLocaleString()
  }
          : item
      );

setPedidos(novosPedidos);

localStorage.setItem(
  "pedidos",
  JSON.stringify(novosPedidos)
);

setMensagem("Agendamento cancelado!");
    }}
  >
    Cancelar agendamento
  </button>
)}
    </div>
))}



            <button onClick={() => setTela("inicio")}>
              Voltar
            </button>
          </div>
        )}

    </div>
  );
}

export default App;