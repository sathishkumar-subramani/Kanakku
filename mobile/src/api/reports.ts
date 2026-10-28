import { api, toApiError } from './client';
import type { MonthString, ReportFormat } from './types';

export type ReportFile = { bytes: ArrayBuffer; filename: string; mimeType: string };

function filenameFromDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return m?.[1] ? decodeURIComponent(m[1]) : fallback;
}

export const reportsApi = {
  months: async (): Promise<MonthString[]> => {
    try {
      const res = await api.get<MonthString[]>('/reports/months');
      return res.data;
    } catch (err) {
      throw toApiError(err);
    }
  },
  /**
   * Downloads the monthly report as raw bytes. `groupId` omitted = everything,
   * "personal" = personal only, or a group id.
   */
  monthly: async (month: MonthString, format: ReportFormat, groupId?: string): Promise<ReportFile> => {
    try {
      const res = await api.get<ArrayBuffer>('/reports/monthly', {
        params: { month, groupId: groupId || undefined, format },
        responseType: 'arraybuffer',
        headers: { Accept: format === 'pdf' ? 'application/pdf' : 'text/csv' },
      });
      const fallback = `kanakku-${month}${groupId ? `-${groupId}` : ''}.${format}`;
      return {
        bytes: res.data,
        filename: filenameFromDisposition(res.headers['content-disposition'], fallback),
        mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
      };
    } catch (err) {
      throw toApiError(err);
    }
  },
};
