import type {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentInput,
} from "../types/appointment.types";

export interface AppointmentRepository {
  findAll(): Promise<Appointment[]>;
  findById(id: string): Promise<Appointment | null>;
  create(data: CreateAppointmentData): Promise<Appointment>;
  update(id: string, data: UpdateAppointmentInput): Promise<Appointment | null>;
  delete(id: string): Promise<boolean>;
}
