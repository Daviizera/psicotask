import { AuthenticationError } from "@/lib/auth/authentication.error";
import { withAuthentication } from "@/lib/auth/with-authentication";
import { TaskContextNotFoundError } from "@/modules/tarefas/errors/task-context-not-found.error";
import { createTaskSchema, taskFiltersSchema } from "@/modules/tarefas/schemas/task.schema";
import { taskService } from "@/modules/tarefas/task.container";

export const runtime = "nodejs";

export const GET = withAuthentication(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const filters = Object.fromEntries(
      Object.keys(taskFiltersSchema.shape).map((field) => {
        const values = searchParams.getAll(field);
        // Cada filtro aceita um único valor; repetições serão rejeitadas pelo schema.
        return [field, values.length > 1 ? values : values[0]];
      }),
    );
    const result = taskFiltersSchema.safeParse(filters);

    if (!result.success) {
      return Response.json(
        {
          error: "Dados inválidos",
          details: result.error.issues.map(({ path, message }) => ({ path, message })),
        },
        { status: 400 },
      );
    }

    const tasks = await taskService.findAll(result.data);
    return Response.json(tasks, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});

export const POST = withAuthentication(async (request: Request) => {
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
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    if (error instanceof TaskContextNotFoundError) {
      return Response.json({ error: "Contexto não encontrado" }, { status: 404 });
    }
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});
