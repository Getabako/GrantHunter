import { ashioto2026 } from "./ashioto2026";
import type { ProgramTemplate, ProgramInfo } from "./types";

export const PROGRAMS: ProgramTemplate[] = [ashioto2026];

export function getProgram(id: string): ProgramTemplate | null {
  return PROGRAMS.find((p) => p.id === id) ?? null;
}

export function toInfo(p: ProgramTemplate): ProgramInfo {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    url: p.url,
    deadline: p.deadline,
    sections: p.sections,
    questions: p.questions,
  };
}
