import { AuthenticationError } from "@/lib/auth/authentication.error";
import { withAuthentication } from "@/lib/auth/with-authentication";
import { appointmentService } from "@/modules/compromissos/appointment.container";
import { createAppointmentSchema } from "@/modules/compromissos/schemas/appointment.schema";
import { INVALID_APPOINTMENT_TIME_RANGE } from "@/modules/compromissos/services/appointment.service";

export const runtime = "nodejs";

export const GET = withAuthentication(async () => {
  try {
    const appointments = await appointmentService.findAll();
    return Response.json(appointments, { status: 200 });
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

  const result = createAppointmentSchema.safeParse(body);

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
    const appointment = await appointmentService.create(result.data);
    return Response.json(appointment, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === INVALID_APPOINTMENT_TIME_RANGE
    ) {
      return Response.json(
        {
          error: "Dados inválidos",
          details: [
            { path: ["horaFim"], message: "A hora de término deve ser posterior à hora de início." },
          ],
        },
        { status: 400 },
      );
    }

    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
});
