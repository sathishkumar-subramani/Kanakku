import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { captureApi, errorMessage } from '@/api';
import { useCaptureRules, useGroups, useMe, useSaveCaptureRule } from '@/api/queries';
import type { CaptureRule, CaptureRuleKind, Category, Group } from '@/api/types';
import { learnTemplate, prettyName, ruleKeysFor } from '@/capture/parser';
import { AlreadyRecordedError, saveCaptured, type Choice } from '@/capture/save';
import { useCaptureStore, type InboxItem } from '@/capture/store';
import { displayName, findRule, suggestFor } from '@/capture/suggest';
import { choiceFrom } from '@/capture/sync';
import { AmountInput } from '@/components/AmountInput';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { DirIcon, sourceLabel, timeLabel } from '@/components/CaptureBits';
import { Card } from '@/components/Card';
import { CategoryGrid, Chip, Segmented } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { Input } from '@/components/Input';
import { Header, Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayHeading } from '@/utils/dates';
import { firstName, hapticError, hapticSuccess } from '@/utils/misc';
import { formatMoney, parseAmount, round2 } from '@/utils/money';

type Kind = Exclude<CaptureRuleKind, 'ignore'> | 'skip';

export default function SortPaymentScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const item = useCaptureStore((s) => (key ? s.items[key] : undefined));
  const me = useMe();
  const groups = useGroups();
  const rules = useCaptureRules();

  if (!item) {
    return (
      <Screen header={<Header title="Payment" />}>
        <Card>
          <EmptyState emoji="🔎" title="This payment is no longer in the inbox" compact />
        </Card>
      </Screen>
    );
  }
  if (!me.data || !groups.data) {
    return <Screen header={<Header title="Sort payment" />}>{null}</Screen>;
  }
  return <SortForm item={item} meId={me.data.id} meName={me.data.name} currency={me.data.currency} groups={groups.data} rules={rules.data ?? []} />;
}

function SortForm({ item, meId, meName, currency, groups, rules }: { item: InboxItem; meId: string; meName: string; currency: string; groups: Group[]; rules: CaptureRule[] }) {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const saveRule = useSaveCaptureRule();

  const suggestion = useMemo(() => suggestFor(item, { rules, groups, meId }), [item, rules, groups, meId]);
  const existingRule = useMemo(() => findRule(item, rules), [item, rules]);
  const debit = item.direction === 'debit';
  const parsedName = displayName(item);

  // ---- form state, seeded from the suggestion ----
  const initialKind: Kind = suggestion.kind === 'ignore' ? 'skip' : suggestion.kind;
  const [kind, setKind] = useState<Kind>(debit ? initialKind : initialKind === 'settlement' ? 'settlement' : 'skip');
  const [amount, setAmount] = useState(String(item.amount));
  const [payee, setPayee] = useState(parsedName ?? '');
  const [description, setDescription] = useState(suggestion.kind === 'personal' || suggestion.kind === 'group' ? suggestion.description : parsedName ?? '');
  const [category, setCategory] = useState<Category>(suggestion.kind === 'personal' || suggestion.kind === 'group' ? suggestion.category : (item.categoryGuess as Category));
  const [date, setDate] = useState(item.date);
  const firstGroup = groups[0]?.id ?? '';
  const [groupId, setGroupId] = useState(suggestion.kind === 'group' || suggestion.kind === 'settlement' ? suggestion.groupId : firstGroup);
  const group = groups.find((g) => g.id === groupId);
  const [splitWith, setSplitWith] = useState<string[]>(suggestion.kind === 'group' ? suggestion.splitWith : (group?.members.map((m) => m.userId) ?? []));
  const [otherId, setOtherId] = useState(suggestion.kind === 'settlement' ? suggestion.otherUserId : '');
  const [remember, setRemember] = useState(existingRule ? true : !!parsedName && suggestion.kind !== 'ignore');
  const [autoSave, setAutoSave] = useState(existingRule?.autoSave ?? false);
  const [showMessage, setShowMessage] = useState(item.confidence === 'low');
  const [fixOpen, setFixOpen] = useState(item.confidence === 'low');
  const [saving, setSaving] = useState(false);

  const n = parseAmount(amount);
  const others = (group?.members ?? []).filter((m) => m.userId !== meId);

  const pickGroup = (id: string) => {
    setGroupId(id);
    const g = groups.find((x) => x.id === id);
    setSplitWith(g?.members.map((m) => m.userId) ?? []);
    if (!g?.members.some((m) => m.userId === otherId)) setOtherId('');
  };
  const toggleSplit = (userId: string) => setSplitWith((cur) => (cur.includes(userId) ? cur.filter((u) => u !== userId) : [...cur, userId]));

  const kindOptions: { value: Kind; label: string }[] = debit
    ? [
        { value: 'personal', label: 'Personal' },
        { value: 'group', label: 'Group' },
        { value: 'settlement', label: 'Settle up' },
        { value: 'skip', label: 'Skip' },
      ]
    : [
        { value: 'settlement', label: 'Settle up' },
        { value: 'skip', label: 'Skip' },
      ];

  const problems = (): string | null => {
    if (!(n > 0)) return 'Enter the amount.';
    if (kind === 'personal' && !description.trim()) return 'What was this for?';
    if (kind === 'group') {
      if (!group) return 'Pick a group.';
      if (!description.trim()) return 'What was this for?';
      if (splitWith.length === 0) return 'Pick who shares this.';
    }
    if (kind === 'settlement') {
      if (!group) return 'Pick a group.';
      if (!otherId) return debit ? 'Who did you pay?' : 'Who paid you?';
    }
    return null;
  };

  const save = async () => {
    const problem = problems();
    if (problem) {
      hapticError();
      Alert.alert('Almost there', problem);
      return;
    }
    setSaving(true);
    const store = useCaptureStore.getState();
    const cleanPayee = payee.trim();
    try {
      // 1) The user corrected what the SMS says → remember the format (only anchor words leave the phone).
      const amountFixed = Math.abs(round2(n) - item.amount) >= 0.005;
      const payeeFixed = !!cleanPayee && cleanPayee.toLowerCase() !== (parsedName ?? '').toLowerCase();
      if (item.source === 'sms' && (amountFixed || payeeFixed || item.confidence === 'low')) {
        const tpl = learnTemplate(item.body, item.senderKey, item.direction, round2(n), cleanPayee || null, meName.split(/\s+/));
        if (tpl) {
          store.addTemplate(tpl);
          captureApi.teach(tpl).catch(() => undefined);
        }
      }
      if (amountFixed || payeeFixed) store.patch(item.key, { amount: round2(n), counterparty: cleanPayee ? prettyName(cleanPayee) : item.counterparty, confidence: cleanPayee ? 'high' : item.confidence });
      const current = { ...item, amount: round2(n), counterparty: cleanPayee ? prettyName(cleanPayee) : item.counterparty };

      // 2) Remember the payee → next time it's pre-filled (or saved automatically).
      const ruleKey = ruleKeysFor(current)[0];
      if (remember && ruleKey) {
        const everyone = group && splitWith.length === group.members.length;
        await saveRule
          .mutateAsync({
            key: ruleKey,
            label: displayName(current) ?? '',
            kind: kind === 'skip' ? 'ignore' : kind,
            groupId: kind === 'group' || kind === 'settlement' ? groupId : null,
            category: kind === 'personal' || kind === 'group' ? category : null,
            description: kind === 'personal' || kind === 'group' ? description.trim() : null,
            splitWith: kind === 'group' && !everyone ? splitWith : [],
            counterpartyUserId: kind === 'settlement' ? otherId : null,
            autoSave: kind !== 'skip' && autoSave,
          })
          .catch(() => undefined); // a rule failing must not block saving the payment
      }

      // 3) Save the payment itself.
      if (kind === 'skip') {
        store.setStatus(item.key, 'ignored');
      } else {
        const choice: Choice =
          kind === 'personal'
            ? { kind, description: description.trim(), category, date, amount: n }
            : kind === 'group'
              ? { kind, groupId, splitWith, description: description.trim(), category, date, amount: n }
              : { kind, groupId, fromUserId: debit ? meId : otherId, toUserId: debit ? otherId : meId, date, amount: n };
        try {
          const saved = await saveCaptured(current, choice, meId, qc);
          store.setStatus(item.key, 'saved', saved);
        } catch (err) {
          if (!(err instanceof AlreadyRecordedError)) throw err;
          store.setStatus(item.key, 'recorded');
          Alert.alert('Already added', 'This payment is already in Kanakku (maybe your roommate added it from their SMS).');
        }
      }
      hapticSuccess();

      // 4) Other payments to the same payee still waiting? Offer to sort them the same way.
      const sameKey = ruleKey;
      const twins = sameKey
        ? Object.values(useCaptureStore.getState().items).filter((i) => i.status === 'pending' && i.key !== item.key && i.direction === item.direction && ruleKeysFor(i).includes(sameKey))
        : [];
      if (twins.length > 0) {
        offerSameForOthers(twins, kind, { groupId, splitWith, description: description.trim(), category, otherId });
      } else {
        router.back();
      }
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const offerSameForOthers = (twins: InboxItem[], k: Kind, f: { groupId: string; splitWith: string[]; description: string; category: Category; otherId: string }) => {
    const label = displayName(twins[0]) ?? 'this payee';
    Alert.alert(`${twins.length} more for ${label}`, k === 'skip' ? 'Skip them too?' : 'Save them the same way?', [
      { text: 'Not now', style: 'cancel', onPress: () => router.back() },
      {
        text: k === 'skip' ? 'Skip all' : 'Save all',
        onPress: async () => {
          const store = useCaptureStore.getState();
          for (const tw of twins) {
            if (k === 'skip') {
              store.setStatus(tw.key, 'ignored');
              continue;
            }
            const s =
              k === 'personal'
                ? ({ kind: 'personal', description: f.description, category: f.category } as const)
                : k === 'group'
                  ? ({ kind: 'group', groupId: f.groupId, splitWith: f.splitWith, description: f.description, category: f.category } as const)
                  : ({ kind: 'settlement', groupId: f.groupId, otherUserId: f.otherId, fromUserId: debit ? meId : f.otherId, toUserId: debit ? f.otherId : meId } as const);
            const choice = choiceFrom(tw, s);
            if (!choice) continue;
            try {
              const saved = await saveCaptured(tw, choice, meId, qc);
              store.setStatus(tw.key, 'saved', saved);
            } catch (err) {
              if (err instanceof AlreadyRecordedError) store.setStatus(tw.key, 'recorded');
            }
          }
          hapticSuccess();
          router.back();
        },
      },
    ]);
  };

  const otherName = others.find((m) => m.userId === otherId)?.name;

  return (
    <Screen
      keyboard
      header={<Header title="Sort payment" subtitle={`${sourceLabel(item)} · ${formatDayHeading(item.date)}, ${timeLabel(item.timestamp)}`} />}
    >
      {/* ---- what happened ---- */}
      <Card style={{ marginBottom: 14 }}>
        <View style={styles.hero}>
          <DirIcon direction={item.direction} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="small" tone="muted">
              {debit ? 'You paid' : 'You received'}
            </Text>
            <Text variant="h2" numberOfLines={2}>
              {payee.trim() ? prettyName(payee) : debit ? 'Payee not found' : 'Sender not found'}
            </Text>
          </View>
          <Money variant="h1" tone={debit ? 'text' : 'positive'}>
            {formatMoney(n > 0 ? n : item.amount, currency)}
          </Money>
        </View>

        {item.confidence === 'low' ? (
          <View style={[styles.note, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.control }]}>
            <Sparkles size={16} color={t.colors.accent} />
            <Text variant="small" style={{ flex: 1 }}>
              Kanakku couldn't read the {debit ? 'payee' : 'sender'} from this message. Type it once below — next time it will know this format.
            </Text>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => setFixOpen((v) => !v)} style={styles.linkRow}>
          <Text variant="small" tone="accent" weight="medium">
            {fixOpen ? 'Hide details' : 'Fix amount or name'}
          </Text>
          {fixOpen ? <ChevronUp size={16} color={t.colors.accent} /> : <ChevronDown size={16} color={t.colors.accent} />}
        </Pressable>
        {fixOpen ? (
          <View style={{ gap: 12, marginTop: 6 }}>
            <AmountInput value={amount} onChangeText={setAmount} currency={currency} label="Amount" />
            <Input
              label={debit ? 'Paid to' : 'Received from'}
              value={payee}
              onChangeText={(v) => {
                setPayee(v);
                if (!description.trim() || description === (parsedName ?? '')) setDescription(v ? prettyName(v) : '');
              }}
              placeholder={debit ? 'Shop or person name' : 'Person name'}
              autoCapitalize="words"
            />
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => setShowMessage((v) => !v)} style={styles.linkRow}>
          <Text variant="small" tone="muted" weight="medium">
            {showMessage ? 'Hide message' : 'Show message'}
          </Text>
          {showMessage ? <ChevronUp size={16} color={t.colors.muted} /> : <ChevronDown size={16} color={t.colors.muted} />}
        </Pressable>
        {showMessage ? (
          <View style={[styles.message, { backgroundColor: t.colors.surface2, borderRadius: t.radii.control }]}>
            {item.title ? (
              <Text variant="small" weight="semibold">
                {item.title}
              </Text>
            ) : null}
            <Text variant="small" mono selectable>
              {item.body}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* ---- what is it ---- */}
      <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
        WHAT IS IT?
      </Text>
      <Card style={{ marginBottom: 14, gap: 14 }}>
        <Segmented<Kind> value={kind} onChange={setKind} options={kindOptions} />

        {kind === 'skip' ? (
          <Text tone="muted" variant="small">
            {debit ? 'Not an expense you want to track (e.g. transfer to your own account).' : 'Money in that is not a roommate paying you back — salary, refund, gifts…'}
          </Text>
        ) : null}

        {(kind === 'group' || kind === 'settlement') && groups.length === 0 ? (
          <Text tone="muted" variant="small">
            You are not in any group yet.
          </Text>
        ) : null}

        {(kind === 'group' || kind === 'settlement') && groups.length > 0 ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: 6 }}>
              Group
            </Text>
            <View style={styles.wrap}>
              {groups.map((g) => (
                <Chip key={g.id} label={g.name} emoji={g.emoji} color={g.color} selected={g.id === groupId} onPress={() => pickGroup(g.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {kind === 'group' && group ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: 6 }}>
              You paid · split equally with
            </Text>
            <View style={styles.wrap}>
              {group.members.map((m) => (
                <Chip key={m.userId} label={m.userId === meId ? 'You' : firstName(m.name)} selected={splitWith.includes(m.userId)} onPress={() => toggleSplit(m.userId)} />
              ))}
            </View>
            {splitWith.length > 0 && n > 0 ? (
              <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
                {formatMoney(round2(n / splitWith.length), currency)} each
              </Text>
            ) : null}
          </View>
        ) : null}

        {kind === 'settlement' && group ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: 6 }}>
              {debit ? 'You paid back' : 'Who paid you back?'}
            </Text>
            {others.length === 0 ? (
              <Text variant="small" tone="muted">
                No one else in this group yet.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {others.map((m) => {
                  const active = m.userId === otherId;
                  return (
                    <Pressable
                      key={m.userId}
                      accessibilityRole="button"
                      onPress={() => setOtherId(m.userId)}
                      style={[styles.person, { backgroundColor: active ? t.colors.accentSoft : t.colors.surface2, borderColor: active ? t.colors.accent : t.colors.border, borderRadius: t.radii.control }]}
                    >
                      <Avatar name={m.name} color={m.avatarColor} size={28} />
                      <Text weight={active ? 'semibold' : 'regular'} style={{ flex: 1 }}>
                        {m.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {otherName ? (
              <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
                {debit ? `You → ${otherName}` : `${otherName} → You`} · {formatMoney(n > 0 ? n : 0, currency)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {kind === 'personal' || kind === 'group' ? (
          <>
            <Input label="Description" value={description} onChangeText={setDescription} placeholder="What was it for?" maxLength={120} />
            <View>
              <Text variant="label" tone="muted" style={{ marginBottom: 6 }}>
                Category
              </Text>
              <CategoryGrid value={category} onChange={setCategory} />
            </View>
          </>
        ) : null}

        {kind !== 'skip' ? <DateField value={date} onChange={setDate} /> : null}
      </Card>

      {/* ---- remember ---- */}
      {ruleKeysFor({ vpa: item.vpa, counterparty: payee.trim() || item.counterparty }).length > 0 ? (
        <Card style={{ marginBottom: 16, gap: 12 }}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text weight="medium">Remember for {payee.trim() ? prettyName(payee) : (displayName(item) ?? 'this payee')}</Text>
              <Text variant="micro" tone="muted">
                Next payment here comes pre-filled like this.
              </Text>
            </View>
            <Switch value={remember} onValueChange={setRemember} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor="#FFFFFF" />
          </View>
          {remember && kind !== 'skip' ? (
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text weight="medium">Save automatically</Text>
                <Text variant="micro" tone="muted">
                  Skip the inbox next time. You can undo from the inbox.
                </Text>
              </View>
              <Switch value={autoSave} onValueChange={setAutoSave} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor="#FFFFFF" />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Button title={kind === 'skip' ? 'Skip this payment' : 'Save'} onPress={save} loading={saving} fullWidth size="lg" variant={kind === 'skip' ? 'secondary' : 'primary'} />
      <View style={{ height: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, marginTop: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 12 },
  message: { padding: 10, marginTop: 8, gap: 4 },
  caps: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
