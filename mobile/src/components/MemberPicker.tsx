import { Check, ChevronDown } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { GroupMember } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticSelect } from '@/utils/misc';
import { Avatar } from './Avatar';
import { Sheet } from './Sheet';
import { Text } from './Text';

/** A field that opens a sheet to choose one member. */
export function MemberPicker({
  label,
  members,
  value,
  onChange,
  meId,
  exclude,
}: {
  label: string;
  members: GroupMember[];
  value: string;
  onChange: (userId: string) => void;
  meId?: string;
  exclude?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const selected = members.find((m) => m.userId === value);
  const display = (m: GroupMember) => (m.userId === meId ? `${m.name} (you)` : m.name);

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
        {selected ? <Avatar name={selected.name} color={selected.avatarColor} size={26} /> : null}
        <Text style={{ flex: 1 }} numberOfLines={1}>
          {selected ? display(selected) : 'Choose'}
        </Text>
        <ChevronDown size={18} color={t.colors.muted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {members
          .filter((m) => m.userId !== exclude)
          .map((m) => {
            const active = m.userId === value;
            return (
              <Pressable
                key={m.userId}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  hapticSelect();
                  onChange(m.userId);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, { backgroundColor: active ? t.colors.accentSoft : pressed ? t.colors.surface2 : 'transparent', borderRadius: t.radii.control }]}
              >
                <Avatar name={m.name} color={m.avatarColor} size={34} />
                <View style={{ flex: 1 }}>
                  <Text weight={active ? 'semibold' : 'regular'}>{display(m)}</Text>
                  <Text variant="micro" tone="muted">
                    {m.email}
                  </Text>
                </View>
                {active ? <Check size={18} color={t.colors.accent} /> : null}
              </Pressable>
            );
          })}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, minHeight: 48, paddingHorizontal: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10 },
});
