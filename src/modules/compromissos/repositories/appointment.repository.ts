import type {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentInput,
} from "../types/appointment.types";

export interface AppointmentRepository {
  findAll(): Promise<Appointment[]>;
  findById(id: number): Promise<Appointment | null>;
  create(data: CreateAppointmentData): Promise<Appointment>;
  update(id: number, data: UpdateAppointmentInput): Promise<Appointment | null>;
  delete(id: number): Promise<boolean>;
}
