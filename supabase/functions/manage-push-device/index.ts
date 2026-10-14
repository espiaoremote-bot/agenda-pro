import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

type Platform = "android" | "web";

type RequestBody = {
  action?: "register" | "associate" | "remove";
  deviceId?: string;
  profissionalId?: number;
  profissionalSenha?: string;
  plataforma?: Platform;
  tokenFcm?: string;
  assinaturaWeb?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Secrets Supabase ausentes na função de gestão de push.");
    return jsonResponse({ error: "Push backend is not configured." }, 503);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const profissionalId = body.profissionalId;
  const senha = body.profissionalSenha;
  if (
    typeof profissionalId !== "number" ||
    !Number.isSafeInteger(profissionalId) ||
    profissionalId < 1 ||
    typeof senha !== "string" ||
    senha.length === 0 ||
    senha.length > 256 ||
    typeof body.deviceId !== "string" ||
    !uuidPattern.test(body.deviceId)
  ) {
    return jsonResponse({ error: "Invalid device registration." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verificacao, error: profissionalError } = await admin
    .rpc("push_verify", { p_id: profissionalId, p_senha: senha });

  if (profissionalError) {
    console.error("Falha ao validar profissional para gestão de push:", profissionalError);
    return jsonResponse({ error: "Could not validate professional." }, 500);
  }
  const profissional =
    Array.isArray(verificacao) && verificacao.length > 0 ? verificacao[0] : null;

  if (profissionalError) {
    console.error("Falha ao validar profissional para gestão de push:", profissionalError);
    return jsonResponse({ error: "Could not validate professional." }, 500);
  }
  if (!profissional || !profissional.ativo) {
    return jsonResponse({ error: "Invalid professional credentials." }, 401);
  }

  if (body.action === "register") {
    if (body.plataforma === "android") {
      if (
        typeof body.tokenFcm !== "string" ||
        body.tokenFcm.length === 0 ||
        body.tokenFcm.length > 4096
      ) {
        return jsonResponse({ error: "Invalid Android push token." }, 400);
      }
    } else if (body.plataforma === "web") {
      const assinatura = body.assinaturaWeb;
      let endpoint: URL | null = null;
      try {
        if (typeof assinatura?.endpoint === "string") {
          endpoint = new URL(assinatura.endpoint);
        }
      } catch {
        endpoint = null;
      }
      if (
        !endpoint ||
        endpoint.protocol !== "https:" ||
        endpoint.href.length > 2048 ||
        typeof assinatura?.keys?.p256dh !== "string" ||
        assinatura.keys.p256dh.length === 0 ||
        typeof assinatura.keys.auth !== "string" ||
        assinatura.keys.auth.length === 0
      ) {
        return jsonResponse({ error: "Invalid web push subscription." }, 400);
      }
    } else {
      return jsonResponse({ error: "Invalid push platform." }, 400);
    }

    const plataforma = body.plataforma;
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        id: body.deviceId,
        profissional_id: profissional.id,
        plataforma,
        token_fcm: plataforma === "android" ? body.tokenFcm : null,
        assinatura_web: plataforma === "web" ? body.assinaturaWeb : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      console.error("Falha ao salvar dispositivo push:", error);
      return jsonResponse({ error: "Could not save push device." }, 500);
    }
    return jsonResponse({ registered: true });
  }

  if (body.action === "associate") {
    const { error } = await admin
      .from("push_subscriptions")
      .update({
        profissional_id: profissional.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.deviceId);
    if (error) {
      console.error("Falha ao associar dispositivo push:", error);
      return jsonResponse({ error: "Could not associate push device." }, 500);
    }
    return jsonResponse({ associated: true });
  }

  if (body.action === "remove") {
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("id", body.deviceId)
      .eq("profissional_id", profissional.id);
    if (error) {
      console.error("Falha ao remover dispositivo push:", error);
      return jsonResponse({ error: "Could not remove push device." }, 500);
    }
    return jsonResponse({ removed: true });
  }

  return jsonResponse({ error: "Invalid action." }, 400);
});
