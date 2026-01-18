import type { Report } from "./schema";

export type ReportRecord = {
  id: string;
  createdAt: string;
  exam: string;
  report: Report;
};

export interface ReportStore {
  save(rec: ReportRecord): Promise<void>;
  get(id: string): Promise<ReportRecord | null>;
}

class MemoryStore implements ReportStore {
  private map = new Map<string, ReportRecord>();

  async save(rec: ReportRecord) {
    this.map.set(rec.id, rec);
  }

  async get(id: string) {
    return this.map.get(id) ?? null;
  }
}

export const reportStore: ReportStore = new MemoryStore();
