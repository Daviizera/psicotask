import type {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentInput,
} from "../types/appointment.types";
import type { AppointmentRepository } from "./appointment.repository";

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private nextId = 1;
  private appointments: Appointment[] = [
    {
      id: this.nextId++,
      titulo: "Supervisão profissional",
      data: "2026-10-10",
      horaInicio: "09:00",
      horaFim: "10:00",
      status: "AGENDADO",
    },
    {
      id: this.nextId++,
      titulo: "Reunião de planejamento",
      data: "2026-10-14",
      horaInicio: "14:00",
      horaFim: "15:30",
      status: "AGENDADO",
    },
    {
      id: this.nextId++,
      titulo: "Encontro de estudo",
      data: "2026-10-02",
      horaInicio: "16:00",
      horaFim: "17:00",
      status: "CONCLUIDO",
    },
  ];

  async findAll(): Promise<Appointment[]> {
    return this.appointments.map((appointment) => ({ ...appointment }));
  }

  async findById(id: number): Promise<Appointment | null> {
    const appointment = this.appointments.find((appointment) => appointment.id === id);
    return appointment ? { ...appointment } : null;
  }

  async create(data: CreateAppointmentData): Promise<Appointment> {
    const appointment: Appointment = { ...data, id: this.nextId++ };
    this.appointments.push(appointment);
    return { ...appointment };
  }

  async update(id: number, data: UpdateAppointmentInput): Promise<Appointment | null> {
    const appointment = this.appointments.find((appointment) => appointment.id === id);

    if (!appointment) {
      return null;
    }

    // Campos ausentes ou undefined preservam os valores atuais.
    if (data.titulo !== undefined) appointment.titulo = data.titulo;
    if (data.descricao !== undefined) appointment.descricao = data.descricao;
    if (data.data !== undefined) appointment.data = data.data;
    if (data.horaInicio !== undefined) appointment.horaInicio = data.horaInicio;
    if (data.horaFim !== undefined) appointment.horaFim = data.horaFim;
    if (data.status !== undefined) appointment.status = data.status;

    return { ...appointment };
  }

  async delete(id: number): Promise<boolean> {
    const index = this.appointments.findIndex((appointment) => appointment.id === id);

    if (index === -1) {
      return false;
    }

    this.appointments.splice(index, 1);
    return true;
  }
}
