import { AuthenticationError } from "@/lib/auth/authentication.error";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { getCurrentPsychologistId } from "@/lib/current-psychologist";

// Autentica antes de validar corpos/IDs, inclusive quando o handler rejeita
// a entrada antes de consultar o repository. A identidade pertence à requisição.
export function withAuthentication<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      await getCurrentPsychologistId();

      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
        !isSameOriginRequest(request)
      ) {
        return Response.json(
          { error: "Origem não permitida" },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }

      const response = await handler(request, ...args);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      const unauthenticated = error instanceof AuthenticationError;
      return Response.json(
        { error: unauthenticated ? "Não autenticado" : "Erro interno do servidor" },
        {
          status: unauthenticated ? 401 : 500,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  };
}
