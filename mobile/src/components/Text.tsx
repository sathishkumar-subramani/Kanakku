import React from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'display' | 'h1' | 'h2' | 'body' | 'small' | 'micro' | 'label';
type Tone = 'text' | 'muted' | 'accent' | 'positive' | 'negative' | 'info' | 'onAccent';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  weight?: Weight;
  /** Set money in DM Mono (tabular). */
  mono?: boolean;
  center?: boolean;
};

export function Text({ variant = 'body', tone = 'text', weight, mono, center, style, ...rest }: TextProps) {
  const t = useTheme();
  const base = variantStyle(variant, t.sizes);
  const w = weight ?? base.weight;
  const fontFamily = mono ? t.fonts.mono : t.fonts[w];
  return (
    <RNText
      {...rest}
      style={[
        { fontFamily, fontSize: base.size, lineHeight: base.lineHeight, color: t.colors[tone] },
        mono && styles.tabular,
        center && styles.center,
        style,
      ]}
    />
  );
}

/** Amount text: DM Mono, tabular. */
export function Money(props: Omit<TextProps, 'mono'>) {
  return <Text {...props} mono weight={props.weight ?? 'medium'} />;
}

function variantStyle(
  v: Variant,
  s: { display: number; h1: number; h2: number; body: number; small: number; micro: number },
): { size: number; lineHeight: number; weight: Weight } {
  switch (v) {
    case 'display':
      return { size: s.display, lineHeight: s.display * 1.2, weight: 'bold' };
    case 'h1':
      return { size: s.h1, lineHeight: s.h1 * 1.25, weight: 'bold' };
    case 'h2':
      return { size: s.h2, lineHeight: s.h2 * 1.3, weight: 'semibold' };
    case 'label':
      return { size: s.small, lineHeight: s.small * 1.4, weight: 'medium' };
    case 'small':
      return { size: s.small, lineHeight: s.small * 1.45, weight: 'regular' };
    case 'micro':
      return { size: s.micro, lineHeight: s.micro * 1.4, weight: 'medium' };
    default:
      return { size: s.body, lineHeight: s.body * 1.45, weight: 'regular' };
  }
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] } as TextStyle,
  center: { textAlign: 'center' },
});
