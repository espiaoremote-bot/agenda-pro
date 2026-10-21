// Helpers de freemium: determina se o profissional é premium (pago, sem ads) ou free (com ads).
// Premiado é automático: depende apenas de ter plano ativo (dias restantes > 0 ou permanente).
// Quando os dias acabam, vira free sozinho — sem precisar o admin marcar nada.

export function ehPremium(profissional) {
  if (!profissional) return false;
  if (profissional.tipo === "super_admin") return true;
  if (profissional.ativo === false) return false;
  if (profissional.plano_ilimitado) return true;
  if (!profissional.validade_plano) return false;
  const ms = new Date(profissional.validade_plano).getTime();
  if (!Number.isFinite(ms)) return false;
  return ms > Date.now();
}

export function ehFree(profissional) {
  return !ehPremium(profissional);
}

export function diasRestantes(profissional) {
  if (!profissional || profissional.plano_ilimitado) return null;
  if (!profissional.validade_plano) return 0;
  const ms = new Date(profissional.validade_plano).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000)));
}

// Retorna { tipo: string, texto: string } — usado pelo admin para mostrar o plano.
//
// Regras (baseadas nos campos REAIS do banco: `plano_ilimitado`, `validade_plano`):
//  - `plano_ilimitado` ligado            => premium permanente (nunca expira)
//  - `validade_plano` no futuro          => premium com prazo (mostra dias restantes)
//  - `validade_plano` no passado/ausente => free com anúncios (o app segue funcionando)
//  - `tipo === "super_admin"`            => administrador, sempre premium
//
// O `tipo` retornado também vira a classe CSS (`plano-status-<tipo>`).
export function informacaoPlano(profissional) {
  if (!profissional) return { tipo: "free", texto: "Plano: Gratuito com anúncios" };

  // O administrador nunca expira e nunca é afetado pelo plano.
  if (profissional.tipo === "super_admin") {
    return { tipo: "permanente", texto: "Plano: 👑 Administrador" };
  }

  // Plano permanente (ilimitado): nunca expira.
  if (profissional.plano_ilimitado) {
    return { tipo: "permanente", texto: "Plano: ♾️ Permanente — sem anúncios" };
  }

  const ms = profissional.validade_plano
    ? new Date(profissional.validade_plano).getTime()
    : NaN;
  const temValidade = Number.isFinite(ms);

  // Sem validade cadastrada => free com anúncios (não expira sozinho).
  if (!temValidade) {
    return {
      tipo: "free",
      texto: "Plano: 🆓 Gratuito com anúncios — sem data de validade",
    };
  }

  const restantes = Math.max(0, Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000)));

  // Validade vencida => o profissional continua na versão gratuita com anúncios.
  if (restantes <= 0) {
    return {
      tipo: "expirado",
      texto: "Plano: 🆓 Gratuito com anúncios (plano vencido)",
    };
  }

  return {
    tipo: "valido",
    texto: `Plano: ✅ Premium — sem anúncios (${restantes} dia${restantes === 1 ? "" : "s"} restante${restantes === 1 ? "" : "s"})`,
  };
}
