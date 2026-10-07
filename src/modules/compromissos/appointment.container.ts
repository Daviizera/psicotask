import { PrismaAppointmentRepository } from "./repositories/prisma-appointment.repository";
import { AppointmentService } from "./services/appointment.service";

// O pool é compartilhado pelo singleton em src/lib/prisma.ts.
const appointmentRepository = new PrismaAppointmentRepository();

export const appointmentService = new AppointmentService(appointmentRepository);
