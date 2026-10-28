import { FileDown, FileSpreadsheet } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useGroups, useReportMonths } from '@/api/queries';
import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Header, Screen } from '@/components/Screen';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { Text } from '@/components/Text';
import { useDownloadReport } from '@/hooks/useDownloadReport';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonth, formatMonthLabel } from '@/utils/dates';

export default function ReportsScreen() {
  const t = useTheme();
  const months = useReportMonths();
  const groups = useGroups();
  const { download, isBusy } = useDownloadReport();
  const [open, setOpen] = useState<string | null>(null);

  const list = months.data && months.data.length > 0 ? months.data : [currentMonth()];

  return (
    <Screen
      refreshing={months.isRefetching && !months.isLoading}
      onRefresh={() => months.refetch()}
      header={<Header title="Reports" subtitle="A PDF or CSV for any month, shared through Android's share sheet." />}
    >
      {months.isError ? (
        <ErrorState message={errorMessage(months.error)} onRetry={() => months.refetch()} />
      ) : months.isLoading ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : months.data && months.data.length === 0 ? (
        <Card>
          <EmptyState emoji="📄" title="No months with data yet" body="Once you add expenses, each month appears here." compact />
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {list.map((m) => {
            const expanded = open === m;
            return (
              <Card key={m} padded={false}>
                <Pressable accessibilityRole="button" onPress={() => setOpen(expanded ? null : m)} style={({ pressed }) => [styles.monthRow, pressed && { backgroundColor: t.colors.surface2 }]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="h2">{formatMonthLabel(m, true)}</Text>
                    <Text variant="small" tone="muted">
                      {expanded ? 'Choose what to download' : 'PDF · CSV'}
                    </Text>
                  </View>
                  <Button title="PDF" size="sm" variant="secondary" icon={<FileDown size={16} color={t.colors.text} />} onPress={() => download(m, 'pdf')} loading={isBusy(m, 'pdf')} />
                </Pressable>
                {expanded ? (
                  <View style={styles.expanded}>
                    <Divider />
                    <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
                      PDF
                    </Text>
                    <DownloadRow label="Everything" sub="All groups + personal" busy={isBusy(m, 'pdf')} onPress={() => download(m, 'pdf')} />
                    <DownloadRow label="Personal only" busy={isBusy(m, 'pdf', 'personal')} onPress={() => download(m, 'pdf', 'personal')} />
                    {(groups.data ?? []).map((g) => (
                      <DownloadRow key={g.id} label={`${g.emoji} ${g.name}`} busy={isBusy(m, 'pdf', g.id)} onPress={() => download(m, 'pdf', g.id)} />
                    ))}
                    <Text variant="micro" tone="muted" weight="semibold" style={[styles.caps, { marginTop: 10 }]}>
                      CSV
                    </Text>
                    <DownloadRow label="Every expense line" sub="Opens in Excel / Sheets" icon="csv" busy={isBusy(m, 'csv')} onPress={() => download(m, 'csv')} />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function DownloadRow({ label, sub, onPress, busy, icon = 'pdf' }: { label: string; sub?: string; onPress: () => void; busy: boolean; icon?: 'pdf' | 'csv' }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={({ pressed }) => [styles.dlRow, pressed && { opacity: 0.7 }]}>
      {icon === 'csv' ? <FileSpreadsheet size={18} color={t.colors.accent} /> : <FileDown size={18} color={t.colors.accent} />}
      <View style={{ flex: 1 }}>
        <Text weight="medium">{label}</Text>
        {sub ? (
          <Text variant="micro" tone="muted">
            {sub}
          </Text>
        ) : null}
      </View>
      <Text variant="small" tone="accent" weight="medium">
        {busy ? 'Preparing…' : 'Download'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  expanded: { paddingHorizontal: 16, paddingBottom: 12, gap: 2 },
  caps: { letterSpacing: 0.6, marginTop: 12, marginBottom: 4 },
  dlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
