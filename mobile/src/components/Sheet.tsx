import { X } from 'lucide-react-native';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

/**
 * Bottom sheet built on the core Modal (no extra native modules, works in Expo Go).
 * Used for pickers and quick forms that live inside a screen.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: t.colors.border }]} />
            {title ? (
              <View style={styles.titleRow}>
                <Text variant="h2" style={{ flex: 1 }}>
                  {title}
                </Text>
                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={[styles.close, { backgroundColor: t.colors.surface2 }]}>
                  <X size={16} color={t.colors.muted} />
                </Pressable>
              </View>
            ) : null}
            {scroll ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
            ) : (
              <View style={styles.body}>{children}</View>
            )}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10, 10, 14, 0.45)' },
  kav: { justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    paddingTop: 8,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  close: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 8, gap: 14 },
  footer: { paddingHorizontal: 18, paddingTop: 10, gap: 10 },
});
