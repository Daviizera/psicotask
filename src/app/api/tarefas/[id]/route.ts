import { updateTaskSchema } from "@/modules/tarefas/schemas/task.schema";
import { taskService } from "@/modules/tarefas/task.container";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: TaskRouteContext) {
  try {
    const { id } = await params;
    const task = await taskService.findById(id);

    if (!task) {
      return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return Response.json(task, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: TaskRouteContext) {
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

  const result = updateTaskSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Dados inválidos",
        details: result.error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }

  if (Object.keys(result.data).length === 0) {
    return Response.json(
      {
        error: "Dados inválidos",
        details: [
          { path: [], message: "Informe ao menos um campo da tarefa para atualizar." },
        ],
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const task = await taskService.update(id, result.data);

    if (!task) {
      return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return Response.json(task, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: TaskRouteContext) {
  try {
    const { id } = await params;
    const deleted = await taskService.delete(id);

    if (!deleted) {
      return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
