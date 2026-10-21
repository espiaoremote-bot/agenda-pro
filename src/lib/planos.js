// Helpers de freemium: determina se o profissional é premium (pago) ou free (com ads).
// Premium = plano ativo (dias restantes > 0 OU plano ilimitado) e ativo === true.
// Free = caso contrário (sem plano pago) -> exibe anúncios.

export function ehPremium(profissional) {
  if (!profissional) return false;
  if (profissional.tipo === "super_admin") return true;
  if (profissional.premium === true) return true;
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
