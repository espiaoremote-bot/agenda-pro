import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

type Assinatura = {
  assinatura_web: PushSubscriptionJSON | null;
  token_fcm: string | null;
  plataforma: "android" | "web";
};

type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
};

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const encodeJson = (value: unknown) =>
  base64Url(new TextEncoder().encode(JSON.stringify(value)));

const rejeitado = (reason: unknown): PromiseRejectedResult => ({
  status: "rejected",
  reason,
});

async function obterTokenFirebase(
  serviceAccountJson: string,
): Promise<{ account: FirebaseServiceAccount; accessToken: string }> {
  let account: FirebaseServiceAccount;
  try {
    account = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
  }
  if (
    typeof account.project_id !== "string" ||
    typeof account.client_email !== "string" ||
    typeof account.private_key !== "string" ||
    typeof account.token_uri !== "string"
  ) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing required fields.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const unsignedJwt = [
    encodeJson({ alg: "RS256", typ: "JWT" }),
    encodeJson({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: account.token_uri,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  ].join(".");
  const pem = account.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pem), (character) =>
    character.charCodeAt(0)
  );
  const signingKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(unsignedJwt),
  );
  const assertion = `${unsignedJwt}.${base64Url(new Uint8Array(signature))}`;
  const tokenResponse = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!tokenResponse.ok) {
    console.error("Firebase OAuth token request failed:", tokenResponse.status);
    throw new Error("Could not authenticate with Firebase.");
  }
  const tokenBody = await tokenResponse.json();
  if (typeof tokenBody.access_token !== "string") {
    throw new Error("Firebase OAuth response did not contain an access token.");
  }
  return { account, accessToken: tokenBody.access_token };
}

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
  if (!supabaseUrl || !serviceKey) {
    console.error("Supabase secrets are not configured.");
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
    .select("assinatura_web, token_fcm, plataforma")
    .eq("profissional_id", appointment.profissional_id);
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
        erro: "No registered push devices.",
        updated_at: new Date().toISOString(),
      })
      .eq("agendamento_id", appointment.id);
    return jsonResponse({ sent: 0, message: "No registered push devices." });
  }

  const titulo = "Novo agendamento";
  const texto = `${appointment.nome || "Cliente"} · ${
    appointment.servico || "Serviço"
  } · ${appointment.data} às ${appointment.horario}`;
  const dispositivos = subscriptions as Assinatura[];
  const webSubscriptions = dispositivos.filter(
    (subscription) => subscription.plataforma === "web",
  );
  const androidSubscriptions = dispositivos.filter(
    (subscription) => subscription.plataforma === "android",
  );
  const resultados: PromiseSettledResult<void>[] = [];

  if (webSubscriptions.length > 0) {
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error("Web Push secrets are not configured.");
      resultados.push(
        ...webSubscriptions.map(() =>
          rejeitado(new Error("Web Push secrets are not configured."))
        ),
      );
    } else {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      resultados.push(
        ...(await Promise.allSettled(
          webSubscriptions.map(async (subscription) => {
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
              }),
            );
          }),
        )),
      );
    }
  }

  if (androidSubscriptions.length > 0) {
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      resultados.push(
        ...androidSubscriptions.map(() =>
          rejeitado(new Error("FIREBASE_SERVICE_ACCOUNT is not configured."))
        ),
      );
    } else {
      try {
        const { account, accessToken } = await obterTokenFirebase(
          serviceAccountJson,
        );
        resultados.push(
          ...(await Promise.allSettled(
            androidSubscriptions.map(async (subscription) => {
              if (!subscription.token_fcm) {
                throw new Error("Android push token is missing.");
              }
              const response = await fetch(
                `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    message: {
                      token: subscription.token_fcm,
                      notification: { title: titulo, body: texto },
                      data: {
                        profissional_id: String(appointment.profissional_id),
                        data: String(appointment.data),
                      },
                      android: {
                        priority: "HIGH",
                        notification: {
                          channel_id: "agendamentos",
                          default_sound: true,
                          default_vibrate_timings: true,
                          notification_priority: "PRIORITY_MAX",
                          visibility: "PUBLIC",
                        },
                      },
                    },
                  }),
                },
              );
              if (!response.ok) {
                console.error("Firebase push delivery failed:", response.status);
                throw new Error(`Firebase delivery failed (${response.status}).`);
              }
            }),
          )),
        );
      } catch (error) {
        console.error("Firebase push setup failed:", error);
        resultados.push(
          ...androidSubscriptions.map(() => rejeitado(error)),
        );
      }
    }
  }

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
