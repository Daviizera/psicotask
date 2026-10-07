import { appointmentService } from "@/modules/compromissos/appointment.container";
import {
  appointmentIdParamSchema,
  updateAppointmentSchema,
} from "@/modules/compromissos/schemas/appointment.schema";
import { INVALID_APPOINTMENT_TIME_RANGE } from "@/modules/compromissos/services/appointment.service";

export const runtime = "nodejs";

type AppointmentRouteContext = {
  params: Promise<{ id: string }>;
};

function invalidAppointmentIdResponse() {
  return Response.json(
    {
      error: "Dados inválidos",
      details: [
        { path: ["id"], message: "O ID do compromisso deve ser um inteiro entre 1 e 2147483647." },
      ],
    },
    { status: 400 },
  );
}

export async function GET(_request: Request, { params }: AppointmentRouteContext) {
  try {
    const { id } = await params;
    const parsedId = appointmentIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidAppointmentIdResponse();
    const appointment = await appointmentService.findById(parsedId.data);

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
    const parsedId = appointmentIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidAppointmentIdResponse();
    const appointment = await appointmentService.update(parsedId.data, result.data);

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
    const parsedId = appointmentIdParamSchema.safeParse(id);
    if (!parsedId.success) return invalidAppointmentIdResponse();
    const deleted = await appointmentService.delete(parsedId.data);

    if (!deleted) {
      return Response.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
