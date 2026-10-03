import type { z } from "zod";

import type {
  appointmentSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from "../schemas/appointment.schema";

export type Appointment = z.output<typeof appointmentSchema>;
export type AppointmentStatus = Appointment["status"];
export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
export type CreateAppointmentData = z.output<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.input<typeof updateAppointmentSchema>;
