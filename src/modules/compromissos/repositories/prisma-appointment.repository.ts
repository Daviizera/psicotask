import { Prisma } from "@/generated/prisma/client";
import { getCurrentPsychologistId } from "@/lib/current-psychologist";
import { prisma } from "@/lib/prisma";
import { appointmentSchema } from "../schemas/appointment.schema";
import type {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentInput,
} from "../types/appointment.types";
import type { AppointmentRepository } from "./appointment.repository";

const publicAppointmentSelect = {
  id: true,
  titulo: true,
  descricao: true,
  data: true,
  horaInicio: true,
  horaFim: true,
  status: true,
} satisfies Prisma.CompromissoSelect;

// UTC serve apenas para transportar os componentes civis no Date do Prisma.
// Não convertemos DATE/TIME para o fuso local nem vinculamos o horário à data.
function toPrismaDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toPrismaTime(time: string): Date {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

function toAppointment(
  record: Prisma.CompromissoGetPayload<{ select: typeof publicAppointmentSelect }>,
): Appointment {
  return appointmentSchema.parse({
    id: record.id,
    titulo: record.titulo,
    ...(record.descricao === null ? {} : { descricao: record.descricao }),
    data: record.data.toISOString().slice(0, 10),
    horaInicio: record.horaInicio.toISOString().slice(11, 16),
    horaFim: record.horaFim.toISOString().slice(11, 16),
    status: record.status,
  });
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  async findAll(): Promise<Appointment[]> {
    const psicologoId = await getCurrentPsychologistId();
    const appointments = await prisma.compromisso.findMany({
      where: { psicologoId },
      select: publicAppointmentSelect,
    });
    return appointments.map(toAppointment);
  }

  async findById(id: number): Promise<Appointment | null> {
    const psicologoId = await getCurrentPsychologistId();
    const appointment = await prisma.compromisso.findFirst({
      where: { id, psicologoId },
      select: publicAppointmentSelect,
    });
    return appointment ? toAppointment(appointment) : null;
  }

  async create(data: CreateAppointmentData): Promise<Appointment> {
    const psicologoId = await getCurrentPsychologistId();
    const appointment = await prisma.compromisso.create({
      data: {
        psicologoId,
        titulo: data.titulo,
        descricao: data.descricao,
        data: toPrismaDate(data.data),
        horaInicio: toPrismaTime(data.horaInicio),
        horaFim: toPrismaTime(data.horaFim),
        status: data.status,
      },
      select: publicAppointmentSelect,
    });
    return toAppointment(appointment);
  }

  async update(id: number, data: UpdateAppointmentInput): Promise<Appointment | null> {
    const psicologoId = await getCurrentPsychologistId();
    try {
      const appointment = await prisma.compromisso.update({
        // O proprietário é verificado na própria escrita, além da leitura do Service.
        where: { id, psicologoId },
        data: {
          titulo: data.titulo,
          descricao: data.descricao,
          data: data.data === undefined ? undefined : toPrismaDate(data.data),
          horaInicio: data.horaInicio === undefined ? undefined : toPrismaTime(data.horaInicio),
          horaFim: data.horaFim === undefined ? undefined : toPrismaTime(data.horaFim),
          status: data.status,
        },
        select: publicAppointmentSelect,
      });
      return toAppointment(appointment);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }

  async delete(id: number): Promise<boolean> {
    const psicologoId = await getCurrentPsychologistId();
    const result = await prisma.compromisso.deleteMany({ where: { id, psicologoId } });
    return result.count > 0;
  }
}
