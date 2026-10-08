export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Clientes que não são navegadores podem não enviar Origin.
  if (origin === null) return true;

  try {
    const url = new URL(request.url);
    // Next normaliza endereços de loopback na URL interna. Host preserva
    // o destino recebido; não confiar em X-Forwarded-Host enviado pelo cliente.
    const host = request.headers.get("host") ?? url.host;
    const target = new URL(`${url.protocol}//${host}`);
    if (target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
      return false;
    }
    return origin === target.origin;
  } catch {
    return false;
  }
}
