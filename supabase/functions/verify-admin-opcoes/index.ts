import { corsHeaders, jsonResponse } from "../_shared/http.ts";

type RequestBody = {
  senha?: string;
};

// Verifica a "segunda senha" de administrador SEM expo-la no codigo do app.
// O valor real vive apenas como secret do Supabase (ADMIN_SENHA_OPCOES),
// nunca no bundle do site/APK. O cliente so recebe "certo" ou "errado".
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const senhaCorreta = Deno.env.get("ADMIN_SENHA_OPCOES");
  if (!senhaCorreta) {
    console.error("Secret ADMIN_SENHA_OPCOES nao configurado.");
    return jsonResponse({ error: "Admin unlock is not configured." }, 503);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const senha = body.senha;
  if (typeof senha !== "string" || senha.length === 0 || senha.length > 256) {
    return jsonResponse({ ok: false }, 401);
  }

  // Comparacao de tempo constante para nao vazar tamanho/conteudo por timing.
  const a = new TextEncoder().encode(senha);
  const b = new TextEncoder().encode(senhaCorreta);
  let diff = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  if (diff !== 0) {
    return jsonResponse({ ok: false }, 401);
  }

  return jsonResponse({ ok: true }, 200);
});
