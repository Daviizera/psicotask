import { contextService } from "@/modules/contextos/context.container";
import {
  contextIdParamSchema,
  updateContextSchema,
} from "@/modules/contextos/schemas/context.schema";

export const runtime = "nodejs";

type ContextRouteContext = {
  params: Promise<{ id: string }>;
};

function invalidContextIdResponse() {
  return Response.json(
    {
      error: "Dados inválidos",
      details: [
        {
          path: ["id"],
          message: "O ID do contexto deve ser um inteiro entre 1 e 2147483647.",
        },
      ],
    },
    { status: 400 },
  );
}

export async function GET(_request: Request, { params }: ContextRouteContext) {
  try {
    const { id } = await params;
    const parsedId = contextIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidContextIdResponse();

    const context = await contextService.findById(parsedId.data);

    if (!context) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return Response.json(context, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: ContextRouteContext) {
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

  const result = updateContextSchema.safeParse(body);

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
    const parsedId = contextIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidContextIdResponse();

    const context = await contextService.update(parsedId.data, result.data);

    if (!context) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return Response.json(context, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: ContextRouteContext) {
  try {
    const { id } = await params;
    const parsedId = contextIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidContextIdResponse();

    const deleted = await contextService.delete(parsedId.data);

    if (!deleted) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
