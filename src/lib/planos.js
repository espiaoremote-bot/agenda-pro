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
