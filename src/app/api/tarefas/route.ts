import { createTaskSchema } from "@/modules/tarefas/schemas/task.schema";
import { taskService } from "@/modules/tarefas/task.container";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tasks = await taskService.findAll();
    return Response.json(tasks, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: "Dados inválidos",
        details: [{ path: [], message: "O corpo deve conter um JSON válido." }],
      },
      { status: 400 },
    );
  }

  const result = createTaskSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Dados inválidos",
        details: result.error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }

  try {
    const task = await taskService.create(result.data);
    return Response.json(task, { status: 201 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
