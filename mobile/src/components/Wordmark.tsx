import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

/** Ledger "K" mark + wordmark. */
export function Wordmark({ size = 40, showText = true }: { size?: number; showText?: boolean }) {
  const t = useTheme();
  const r = size * 0.28;
  return (
    <View style={styles.row}>
      <View style={[styles.tile, { width: size, height: size, borderRadius: r, backgroundColor: t.colors.accent }]}>
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 100 100">
          <Path d="M28 18 V82" stroke={t.colors.onAccent} strokeWidth={13} strokeLinecap="round" fill="none" />
          <Path d="M30 52 L62 18" stroke={t.colors.onAccent} strokeWidth={13} strokeLinecap="round" fill="none" />
          <Path d="M38 46 L66 82" stroke={t.colors.onAccent} strokeWidth={13} strokeLinecap="round" fill="none" />
          <Line x1={78} y1={32} x2={92} y2={32} stroke={t.colors.onAccent} strokeWidth={7} strokeLinecap="round" />
          <Line x1={78} y1={50} x2={88} y2={50} stroke={t.colors.onAccent} strokeWidth={7} strokeLinecap="round" />
          <Line x1={78} y1={68} x2={92} y2={68} stroke={t.colors.onAccent} strokeWidth={7} strokeLinecap="round" />
        </Svg>
      </View>
      {showText ? (
        <View>
          <Text variant="h1" style={{ letterSpacing: -0.5 }}>
            Kanakku
          </Text>
          <Text variant="micro" tone="muted" style={{ letterSpacing: 0.4 }}>
            YOUR SHARED LEDGER
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
