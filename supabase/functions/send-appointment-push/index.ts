import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Agendamento = {
  id: number;
  profissional_id: number;
  nome: string;
  servico: string;
  data: string;
  horario: string;
  status: string;
};

type Assinatura = {
  id: string;
  plataforma: "android" | "web";
  token_fcm: string | null;
  assinatura_web: PushSubscriptionJSON | null;
};

function base64Url(bytes: Uint8Array) {
  let texto = "";
  for (const byte of bytes) texto += String.fromCharCode(byte);
  return btoa(texto).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodificarBase64(texto: string) {
  const dados = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(dados, (caractere) => caractere.charCodeAt(0));
}

async function obterTokenFirebase(conta: {
  client_email: string;
  private_key: string;
}) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  );
  const afirmacoes = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: conta.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: agora,
        exp: agora + 3600,
      })
    )
  );
  const mensagem = `${cabecalho}.${afirmacoes}`;
  const chavePrivada = conta.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const chave = await crypto.subtle.importKey(
    "pkcs8",
    decodificarBase64(chavePrivada),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    chave,
    new TextEncoder().encode(mensagem)
  );
  const assertion = `${mensagem}.${base64Url(new Uint8Array(assinatura))}`;
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!resposta.ok) {
    throw new Error(`Firebase OAuth falhou (${resposta.status}).`);
  }
  const dados = await resposta.json();
  return dados.access_token as string;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Secrets Supabase ausentes na função de push.");
    return Response.json({ error: "Push backend is not configured." }, { status: 503 });
  }

  let body: { appointmentId?: number };
  try {
    body = await request.json();
  } catch (error) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const appointmentId = Number(body.appointmentId);
  if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) {
    return Response.json({ error: "Invalid appointment ID." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: appointment, error: appointmentError } = await admin
    .from("agendamentos")
    .select("id, profissional_id, nome, servico, data, horario, status")
    .eq("id", appointmentId)
    .maybeSingle();
  if (appointmentError) {
    console.error("Falha ao carregar agendamento para push:", appointmentError);
    return Response.json({ error: "Could not load appointment." }, { status: 500 });
  }
  if (!appointment) {
    return Response.json({ error: "Appointment not found." }, { status: 404 });
  }
  if (!["Agendado", "Pendente"].includes(appointment.status)) {
    return Response.json({ sent: 0, skipped: true });
  }

  const { data: entregaAnterior, error: buscaEntregaErro } = await admin
    .from("push_deliveries")
    .select("status")
    .eq("agendamento_id", appointment.id)
    .maybeSingle();
  if (buscaEntregaErro) {
    console.error("Falha ao verificar duplicidade do push:", buscaEntregaErro);
    return Response.json({ error: "Could not check push delivery." }, { status: 500 });
  }
  if (entregaAnterior?.status === "sent" || entregaAnterior?.status === "sending") {
    return Response.json({ sent: 0, duplicate: true });
  }

  const { error: claimError } = await admin.from("push_deliveries").upsert(
    {
      agendamento_id: appointment.id,
      status: "sending",
      enviados: 0,
      erro: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agendamento_id" }
  );
  if (claimError) {
    console.error("Falha ao reservar envio do push:", claimError);
    return Response.json({ error: "Could not start push delivery." }, { status: 500 });
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id, plataforma, token_fcm, assinatura_web")
    .eq("profissional_id", appointment.profissional_id);
  if (subscriptionsError) {
    console.error("Falha ao carregar dispositivos push:", subscriptionsError);
    await admin
      .from("push_deliveries")
      .update({
        status: "failed",
        erro: "Could not load subscriptions.",
        updated_at: new Date().toISOString(),
      })
      .eq("agendamento_id", appointment.id);
    return Response.json({ error: "Could not load subscriptions." }, { status: 500 });
  }
  if (!subscriptions?.length) {
    await admin
      .from("push_deliveries")
      .update({
        status: "failed",
        erro: "No registered devices.",
        updated_at: new Date().toISOString(),
      })
      .eq("agendamento_id", appointment.id);
    return Response.json({ sent: 0, message: "No registered devices." });
  }

  const titulo = "Novo agendamento";
  const texto = `${appointment.nome || "Cliente"} · ${appointment.servico || "Serviço"} · ${appointment.data} às ${appointment.horario}`;
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }

  let firebaseAccessToken: string | null = null;
  const firebaseServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  const resultados = await Promise.allSettled(
    (subscriptions as Assinatura[]).map(async (subscription) => {
      const dados = {
        profissional_id: String(appointment.profissional_id),
        data: appointment.data,
      };
      if (subscription.plataforma === "android") {
        if (!firebaseServiceAccount || !subscription.token_fcm) {
          throw new Error("Firebase service account or device token is missing.");
        }
        const conta = JSON.parse(firebaseServiceAccount);
        firebaseAccessToken ??= await obterTokenFirebase(conta);
        const resposta = await fetch(
          `https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${firebaseAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: subscription.token_fcm,
                notification: { title: titulo, body: texto },
                data: dados,
              },
            }),
          }
        );
        if (!resposta.ok) {
          throw new Error(`FCM rejected push (${resposta.status}).`);
        }
        return;
      }

      if (
        !vapidPublicKey ||
        !vapidPrivateKey ||
        !vapidSubject ||
        !subscription.assinatura_web
      ) {
        throw new Error("Web Push configuration or browser subscription is missing.");
      }
      await webpush.sendNotification(
        subscription.assinatura_web,
        JSON.stringify({
          title: titulo,
          body: texto,
          data: dados,
        })
      );
    })
  );

  const enviados = resultados.filter((resultado) => resultado.status === "fulfilled").length;
  const erros = resultados
    .filter((resultado) => resultado.status === "rejected")
    .map((resultado) =>
      resultado.reason instanceof Error
        ? resultado.reason.message
        : "Unknown push delivery error."
    );
  await admin
    .from("push_deliveries")
    .update({
      status: enviados > 0 ? "sent" : "failed",
      enviados,
      erro: erros.length ? erros.join("; ").slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("agendamento_id", appointment.id);

  if (erros.length) console.error("Alguns pushes não foram entregues:", erros);
  return Response.json({ sent: enviados, failed: erros.length });
});
