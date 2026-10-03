import { InMemoryAppointmentRepository } from "./repositories/in-memory-appointment.repository";
import { AppointmentService } from "./services/appointment.service";

// Persistência temporária da pré-validação: compartilha as instâncias entre as
// rotas no mesmo contexto global, inclusive ao reavaliar módulos em desenvolvimento.
// Os dados são perdidos ao reiniciar e não são compartilhados entre processos.
const globalForAppointments = globalThis as typeof globalThis & {
  psicoAppointmentRepository?: InMemoryAppointmentRepository;
  psicoAppointmentService?: AppointmentService;
};

const appointmentRepository = (globalForAppointments.psicoAppointmentRepository ??=
  new InMemoryAppointmentRepository());

export const appointmentService = (globalForAppointments.psicoAppointmentService ??=
  new AppointmentService(appointmentRepository));
