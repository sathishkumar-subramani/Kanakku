import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

/** Standard page: safe-area aware, scrollable, pull-to-refresh friendly. */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  header,
  keyboard,
  bottomInset = true,
  ...rest
}: ScrollViewProps & {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  header?: React.ReactNode;
  keyboard?: boolean;
  bottomInset?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const padBottom = bottomInset ? insets.bottom + 24 : 0;

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: padBottom }, contentStyle]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1, paddingBottom: padBottom }, contentStyle]}>{children}</View>
  );

  const inner = (
    <View style={[styles.root, { backgroundColor: t.colors.bg }]}>
      {header}
      {body}
    </View>
  );

  if (keyboard) {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {inner}
      </KeyboardAvoidingView>
    );
  }
  return inner;
}

/** Simple header used on pushed screens and sheets. */
export function Header({
  title,
  subtitle,
  right,
  onBack,
  back = true,
  large,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  back?: boolean;
  large?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const handleBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: t.colors.bg }]}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleBack}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, { backgroundColor: t.colors.surface2, opacity: pressed ? 0.7 : 1 }]}
          >
            <ArrowLeft size={20} color={t.colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerTitle}>
          <Text variant={large ? 'h1' : 'h2'} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Tab page title block. */
export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.pageTitle, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        <Text variant="display">{title}</Text>
        {subtitle ? (
          <Text tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
});
