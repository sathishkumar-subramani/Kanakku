import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { ReportFile } from '@/api/reports';

/**
 * Write a downloaded report into the cache dir and open the Android share sheet.
 * On web (bundle check only) it triggers a normal browser download.
 */
export async function saveAndShare(report: ReportFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([report.bytes], { type: report.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const dir = new Directory(Paths.cache, 'reports');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, safeName(report.filename));
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(report.bytes));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: report.mimeType,
    dialogTitle: report.filename,
    UTI: report.mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_');
}
