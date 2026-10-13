import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

type Assinatura = {
  assinatura_web: PushSubscriptionJSON | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (
    !supabaseUrl ||
    !serviceKey ||
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject
  ) {
    console.error("Supabase or Web Push secrets are not configured.");
    return jsonResponse({ error: "Push backend is not configured." }, 503);
  }

  let body: { appointmentId?: number };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  const appointmentId = Number(body.appointmentId);
  if (!Number.isSafeInteger(appointmentId) || appointmentId < 1) {
    return jsonResponse({ error: "Invalid appointment ID." }, 400);
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
    console.error("Falha ao carregar agendamento:", appointmentError);
    return jsonResponse({ error: "Could not load appointment." }, 500);
  }
  if (!appointment) {
    return jsonResponse({ error: "Appointment not found." }, 404);
  }
  if (!["Agendado", "Pendente"].includes(appointment.status)) {
    return jsonResponse({ sent: 0, skipped: true });
  }

  const { data: entregaAnterior, error: buscaEntregaErro } = await admin
    .from("push_deliveries")
    .select("status")
    .eq("agendamento_id", appointment.id)
    .maybeSingle();
  if (buscaEntregaErro) {
    console.error("Falha ao verificar duplicidade do push:", buscaEntregaErro);
    return jsonResponse({ error: "Could not check push delivery." }, 500);
  }
  if (
    entregaAnterior?.status === "sent" ||
    entregaAnterior?.status === "sending"
  ) {
    return jsonResponse({ sent: 0, duplicate: true });
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
    console.error("Falha ao iniciar envio:", claimError);
    return jsonResponse({ error: "Could not start push delivery." }, 500);
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("assinatura_web")
    .eq("profissional_id", appointment.profissional_id)
    .eq("plataforma", "web");
  if (subscriptionsError) {
    console.error("Falha ao carregar dispositivos:", subscriptionsError);
    await admin
      .from("push_deliveries")
      .update({
        status: "failed",
        erro: "Could not load subscriptions.",
        updated_at: new Date().toISOString(),
      })
      .eq("agendamento_id", appointment.id);
    return jsonResponse({ error: "Could not load subscriptions." }, 500);
  }
  if (!subscriptions?.length) {
    await admin
      .from("push_deliveries")
      .update({
        status: "failed",
        erro: "No registered web devices.",
        updated_at: new Date().toISOString(),
      })
      .eq("agendamento_id", appointment.id);
    return jsonResponse({ sent: 0, message: "No registered web devices." });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const titulo = "Novo agendamento";
  const texto = `${appointment.nome || "Cliente"} · ${
    appointment.servico || "Serviço"
  } · ${appointment.data} às ${appointment.horario}`;
  const resultados = await Promise.allSettled(
    (subscriptions as Assinatura[]).map(async (subscription) => {
      if (!subscription.assinatura_web) {
        throw new Error("Web subscription is missing.");
      }
      await webpush.sendNotification(
        subscription.assinatura_web,
        JSON.stringify({
          title: titulo,
          body: texto,
          data: {
            profissional_id: String(appointment.profissional_id),
            data: appointment.data,
          },
        })
      );
    })
  );

  const enviados = resultados.filter(
    (resultado) => resultado.status === "fulfilled"
  ).length;
  const erros = resultados
    .filter((resultado) => resultado.status === "rejected")
    .map((resultado) =>
      resultado.reason instanceof Error
        ? resultado.reason.message
        : "Unknown delivery error."
    );
  const { error: updateError } = await admin
    .from("push_deliveries")
    .update({
      status: enviados > 0 ? "sent" : "failed",
      enviados,
      erro: erros.length ? erros.join("; ").slice(0, 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("agendamento_id", appointment.id);
  if (updateError) {
    console.error("Falha ao atualizar status do push:", updateError);
    return jsonResponse(
      { error: "Could not update push delivery status.", sent: enviados },
      500
    );
  }

  if (erros.length) {
    console.error("Alguns pushes não foram entregues:", erros);
  }
  return jsonResponse({ sent: enviados, failed: erros.length });
});
