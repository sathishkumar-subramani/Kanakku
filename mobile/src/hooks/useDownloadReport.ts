import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { errorMessage, reportsApi } from '@/api';
import type { MonthString, ReportFormat } from '@/api/types';
import { handleReport, type ReportAction } from '@/utils/files';
import { hapticError, hapticSuccess } from '@/utils/misc';

const keyOf = (month: MonthString, format: ReportFormat, groupId: string | undefined, action: ReportAction) =>
  `${month}:${format}:${groupId ?? 'all'}:${action}`;

/**
 * Fetches a monthly report. `action` 'open' shows it in the phone's viewer (falls back to share
 * when no viewer is installed); 'share' goes straight to the share sheet.
 */
export function useDownloadReport() {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const download = useCallback(async (month: MonthString, format: ReportFormat, groupId?: string, action: ReportAction = 'open') => {
    setBusyKey(keyOf(month, format, groupId, action));
    try {
      const file = await reportsApi.monthly(month, format, groupId);
      await handleReport(file, action);
      hapticSuccess();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't get the report", errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }, []);

  const share = useCallback((month: MonthString, format: ReportFormat, groupId?: string) => download(month, format, groupId, 'share'), [download]);

  return {
    download,
    share,
    isBusy: (month: MonthString, format: ReportFormat, groupId?: string, action: ReportAction = 'open') => busyKey === keyOf(month, format, groupId, action),
  };
}
