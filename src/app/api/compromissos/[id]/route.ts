import { appointmentService } from "@/modules/compromissos/appointment.container";
import { updateAppointmentSchema } from "@/modules/compromissos/schemas/appointment.schema";
import { INVALID_APPOINTMENT_TIME_RANGE } from "@/modules/compromissos/services/appointment.service";

export const runtime = "nodejs";

type AppointmentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: AppointmentRouteContext) {
  try {
    const { id } = await params;
    const appointment = await appointmentService.findById(id);

    if (!appointment) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return Response.json(appointment, { status: 200 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: AppointmentRouteContext) {
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

  const result = updateAppointmentSchema.safeParse(body);

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
    const appointment = await appointmentService.update(id, result.data);

    if (!appointment) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return Response.json(appointment, { status: 200 });
  } catch (error) {
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
}

export async function DELETE(_request: Request, { params }: AppointmentRouteContext) {
  try {
    const { id } = await params;
    const deleted = await appointmentService.delete(id);

    if (!deleted) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
