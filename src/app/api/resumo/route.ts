import { routineSummaryService } from "@/modules/resumo/routine-summary.container";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await routineSummaryService.getSummary();
    return Response.json(summary, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
