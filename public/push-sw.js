self.addEventListener("push", (event) => {
  let mensagem = {};
  try {
    mensagem = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("Push recebido com conteúdo inválido:", error);
  }

  const dados = mensagem.data || {};
  event.waitUntil(
    self.registration.showNotification(mensagem.title || "Novo agendamento", {
      body: mensagem.body || "Um cliente agendou um horário.",
      icon: "/favicon.svg",
      data: {
        url:
          dados.url ||
          `/?pushProfessional=${encodeURIComponent(
            dados.profissional_id || ""
          )}&pushDate=${encodeURIComponent(dados.data || "")}`,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clientes) => {
        const existente = clientes.find((cliente) => {
          try {
            return new URL(cliente.url).origin === self.location.origin;
          } catch (error) {
            return false;
          }
        });
        if (existente) {
          return existente.navigate(destino).then(() => existente.focus());
        }
        return self.clients.openWindow(destino);
      }
    )
  );
});
