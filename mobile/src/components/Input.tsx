import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  mono?: boolean;
};

export const Input = forwardRef<TextInputInstance, InputProps>(function Input(
  { label, hint, error, left, right, containerStyle, style, mono, onFocus, onBlur, ...rest },
  ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.negative : focused ? t.colors.accent : t.colors.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          { backgroundColor: t.colors.surface2, borderColor, borderRadius: t.radii.control },
          focused && { borderWidth: 1.5 },
        ]}
      >
        {left ? <View style={styles.side}>{left}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={t.colors.muted}
          selectionColor={t.colors.accent}
          cursorColor={t.colors.accent}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: t.colors.text, fontFamily: mono ? t.fonts.mono : t.fonts.regular, fontSize: t.sizes.body },
            style,
          ]}
        />
        {right ? <View style={styles.side}>{right}</View> : null}
      </View>
      {error ? (
        <Text variant="small" tone="negative" style={styles.help}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="muted" style={styles.help}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: 48, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, minHeight: 46 },
  side: { marginHorizontal: 4 },
  help: { marginTop: 6 },
});
