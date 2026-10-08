// Somente para testes isolados: substitui a leitura de cookies do Next.js.
// Assinatura e expiração do JWT são verificadas pelos testes Auth e HTTP.
export async function readSessionPsychologistId() {
  return globalThis.psicoTestSessionPsychologistId ?? null;
}
