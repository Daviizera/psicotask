import { AuthenticationError } from "@/lib/auth/authentication.error";
import { withAuthentication } from "@/lib/auth/with-authentication";
import { psychologistService } from "@/modules/psicologos/psychologist.container";
import { PSYCHOLOGIST_CONFLICT } from "@/modules/psicologos/errors/psychologist-conflict.error";
import { updatePsychologistSchema } from "@/modules/psicologos/schemas/psychologist.schema";

export const runtime = "nodejs";

export const GET = withAuthentication(async () => {
  try {
    const psychologist = await psychologistService.findCurrent();
    return Response.json(psychologist, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});

export const PUT = withAuthentication(async (request: Request) => {
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

  const result = updatePsychologistSchema.safeParse(body);

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
    const psychologist = await psychologistService.update(result.data);
    return Response.json(psychologist, { status: 200 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === PSYCHOLOGIST_CONFLICT
    ) {
      return Response.json(
        { error: "E-mail ou registro profissional já cadastrado." },
        { status: 409 },
      );
    }

    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});
