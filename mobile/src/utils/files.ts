import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { ReportFile } from '@/api/reports';

export type ReportAction = 'open' | 'share';

/**
 * Save a downloaded report into the cache dir, then either
 *  - 'open'  → hand it to the phone's viewer (Drive PDF viewer, Files, Sheets…) via ACTION_VIEW, or
 *  - 'share' → open the Android share sheet (WhatsApp, Gmail…).
 * If no installed app can view the file, 'open' falls back to the share sheet so the user is never stuck.
 * On web (bundle check only) it triggers a normal browser download.
 */
export async function handleReport(report: ReportFile, action: ReportAction): Promise<'opened' | 'shared'> {
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
    return 'opened';
  }

  const file = await writeToCache(report);

  if (action === 'open') {
    try {
      if (await file.canPreview({ mimeType: report.mimeType })) {
        await file.preview({ mimeType: report.mimeType });
        return 'opened';
      }
    } catch {
      // no viewer app / intent failed → fall through to the share sheet
    }
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: report.mimeType,
    dialogTitle: report.filename,
    UTI: report.mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
  return 'shared';
}

async function writeToCache(report: ReportFile): Promise<File> {
  const dir = new Directory(Paths.cache, 'reports');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, safeName(report.filename));
  if (file.exists) file.delete();
  file.create();
  await file.write(new Uint8Array(report.bytes));
  return file;
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_');
}
