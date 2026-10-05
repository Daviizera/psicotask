import type { Appointment } from "../../compromissos/types/appointment.types";

export type RoutineSummary = {
  tarefasPendentes: number;
  tarefasPrioritarias: number;
  proximosCompromissos: Appointment[];
};
