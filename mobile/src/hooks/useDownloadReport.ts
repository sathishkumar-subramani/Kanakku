import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { errorMessage, reportsApi } from '@/api';
import type { MonthString, ReportFormat } from '@/api/types';
import { saveAndShare } from '@/utils/files';
import { hapticError, hapticSuccess } from '@/utils/misc';

/** Fetches the monthly report and hands it to the share sheet. */
export function useDownloadReport() {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const download = useCallback(async (month: MonthString, format: ReportFormat, groupId?: string) => {
    const key = `${month}:${format}:${groupId ?? 'all'}`;
    setBusyKey(key);
    try {
      const file = await reportsApi.monthly(month, format, groupId);
      await saveAndShare(file);
      hapticSuccess();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't download the report", errorMessage(err));
    } finally {
      setBusyKey(null);
    }
  }, []);

  return { download, busyKey, isBusy: (month: MonthString, format: ReportFormat, groupId?: string) => busyKey === `${month}:${format}:${groupId ?? 'all'}` };
}
