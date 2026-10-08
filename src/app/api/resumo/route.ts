import { AuthenticationError } from "@/lib/auth/authentication.error";
import { withAuthentication } from "@/lib/auth/with-authentication";
import { routineSummaryService } from "@/modules/resumo/routine-summary.container";

export const runtime = "nodejs";

export const GET = withAuthentication(async () => {
  try {
    const summary = await routineSummaryService.getSummary();
    return Response.json(summary, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});
