import { appointmentService } from "../compromissos/appointment.container";
import { taskService } from "../tarefas/task.container";
import { RoutineSummaryService } from "./services/routine-summary.service";

// Agregação sem estado: reutiliza os serviços e a persistência temporária existentes.
export const routineSummaryService = new RoutineSummaryService(taskService, appointmentService);
