import type { AppointmentRepository } from "../repositories/appointment.repository";
import type {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentInput,
} from "../types/appointment.types";

export const INVALID_APPOINTMENT_TIME_RANGE = "INVALID_APPOINTMENT_TIME_RANGE";

export class InvalidAppointmentTimeRangeError extends Error {
  readonly code = INVALID_APPOINTMENT_TIME_RANGE;

  constructor() {
    super("A hora de término deve ser posterior à hora de início.");
    this.name = "InvalidAppointmentTimeRangeError";
  }
}

export class AppointmentService {
  constructor(private readonly appointmentRepository: AppointmentRepository) {}

  findAll(): Promise<Appointment[]> {
    return this.appointmentRepository.findAll();
  }

  findById(id: number): Promise<Appointment | null> {
    return this.appointmentRepository.findById(id);
  }

  async create(data: CreateAppointmentData): Promise<Appointment> {
    this.validateTimeRange(data.horaInicio, data.horaFim);
    return this.appointmentRepository.create(data);
  }

  async update(id: number, data: UpdateAppointmentInput): Promise<Appointment | null> {
    const appointment = await this.appointmentRepository.findById(id);

    if (!appointment) {
      return null;
    }

    const horaInicio = data.horaInicio ?? appointment.horaInicio;
    const horaFim = data.horaFim ?? appointment.horaFim;
    this.validateTimeRange(horaInicio, horaFim);

    // Persiste o par validado junto, preservando sua consistência mesmo se
    // atualizações concorrentes tiverem consultado o mesmo estado anterior.
    return this.appointmentRepository.update(id, { ...data, horaInicio, horaFim });
  }

  delete(id: number): Promise<boolean> {
    return this.appointmentRepository.delete(id);
  }

  private validateTimeRange(horaInicio: string, horaFim: string): void {
    // As horas chegam validadas pelo schema no formato fixo HH:mm.
    if (horaFim <= horaInicio) {
      throw new InvalidAppointmentTimeRangeError();
    }
  }
}
