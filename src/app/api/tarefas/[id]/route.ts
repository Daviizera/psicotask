import { AuthenticationError } from "@/lib/auth/authentication.error";
import { withAuthentication } from "@/lib/auth/with-authentication";
import { TaskContextNotFoundError } from "@/modules/tarefas/errors/task-context-not-found.error";
import { taskIdParamSchema, updateTaskSchema } from "@/modules/tarefas/schemas/task.schema";
import { taskService } from "@/modules/tarefas/task.container";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

function invalidTaskIdResponse() {
  return Response.json(
    {
      error: "Dados inválidos",
      details: [{ path: ["id"], message: "O ID da tarefa deve ser um inteiro entre 1 e 2147483647." }],
    },
    { status: 400 },
  );
}

export const GET = withAuthentication(async (_request: Request, { params }: TaskRouteContext) => {
  try {
    const { id } = await params;
    const parsedId = taskIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidTaskIdResponse();
    const task = await taskService.findById(parsedId.data);

    if (!task) {
      return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return Response.json(task, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});

export const PUT = withAuthentication(async (request: Request, { params }: TaskRouteContext) => {
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

  try {
    const { id } = await params;
    const parsedId = taskIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidTaskIdResponse();
    const task = await taskService.update(parsedId.data, result.data);

    if (!task) {
      return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return Response.json(task, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    if (error instanceof TaskContextNotFoundError) {
      return Response.json({ error: "Contexto não encontrado" }, { status: 404 });
    }
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});

export const DELETE = withAuthentication(async (_request: Request, { params }: TaskRouteContext) => {
  try {
    const { id } = await params;
    const parsedId = taskIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidTaskIdResponse();
    const deleted = await taskService.delete(parsedId.data);

    if (!deleted) {
      return Response.json({ error: "Tarefa não encontrada" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});
