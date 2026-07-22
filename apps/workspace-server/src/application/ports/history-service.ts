import type { GetHistoryResponse } from "@agidn/api-protocol";

export interface HistoryServicePort {
  getHistory(): GetHistoryResponse;
}
