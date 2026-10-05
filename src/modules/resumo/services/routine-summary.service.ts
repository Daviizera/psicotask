import type { AppointmentService } from "../../compromissos/services/appointment.service";
import type { TaskService } from "../../tarefas/services/task.service";
import type { RoutineSummary } from "../types/routine-summary.types";

export class RoutineSummaryService {
  constructor(
    private readonly taskService: TaskService,
    private readonly appointmentService: AppointmentService,
  ) {}

  // A referência opcional usa AAAA-MM-DD; por padrão, considera o dia em Fortaleza.
  async getSummary(referenceDate?: string): Promise<RoutineSummary> {
    const today = referenceDate ?? new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const [tasks, appointments] = await Promise.all([
      this.taskService.findAll(),
      this.appointmentService.findAll(),
    ]);

    return {
      tarefasPendentes: tasks.filter((task) => task.status === "PENDENTE").length,
      tarefasPrioritarias: tasks.filter(
        (task) => task.prioridade === "ALTA" && task.status !== "CONCLUIDA",
      ).length,
      proximosCompromissos: appointments
        .filter((appointment) => appointment.status === "AGENDADO" && appointment.data >= today)
        .sort((first, second) =>
          first.data.localeCompare(second.data) || first.horaInicio.localeCompare(second.horaInicio),
        )
        .slice(0, 5),
    };
  }
}
