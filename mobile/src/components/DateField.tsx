import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { formatDay, parseDay, toDayString, todayString } from '@/utils/dates';
import { Input } from './Input';
import { Text } from './Text';

/**
 * Calendar-day field. `value` is "YYYY-MM-DD" and we only ever emit `toDayString(localDate)`
 * (never toISOString, which would shift IST midnight to the previous UTC day).
 */
export function DateField({ label = 'Date', value, onChange, maxToday = true }: { label?: string; value: string; onChange: (day: string) => void; maxToday?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <Input
        label={label}
        value={value}
        onChangeText={(v) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) onChange(v);
        }}
        placeholder="YYYY-MM-DD"
        mono
      />
    );
  }

  const onPick = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) onChange(toDayString(date));
  };

  const isToday = value === todayString();

  return (
    <View>
      <Text variant="label" tone="muted" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: t.colors.surface2, borderColor: t.colors.border, borderRadius: t.radii.control, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <CalendarDays size={18} color={t.colors.muted} />
        <Text style={{ flex: 1 }}>{isToday ? `Today, ${formatDay(value)}` : formatDay(value, { weekday: true, year: true })}</Text>
        <Text variant="small" tone="accent" weight="medium">
          Change
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={parseDay(value)}
          mode="date"
          display="default"
          maximumDate={maxToday ? new Date() : undefined}
          onChange={onPick}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, minHeight: 48, paddingHorizontal: 12 },
});
