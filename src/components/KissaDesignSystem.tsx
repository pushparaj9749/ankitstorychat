/**
 * KISSA v4.2 — Design System
 * Centralized reusable components for original Kissa identity.
 * Exports: KissaHeader, StoryCard, FeaturedStory, SectionHeader, CategoryChip,
 * SearchBar, PrimaryButton, SecondaryButton, StoryHero, CharacterCard,
 * MediaCard, ChatMessage, ChatComposer, BottomNavigation, LoadingSkeleton,
 * EmptyState, ErrorState, Modal, BottomSheet
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, Modal as RNModal, ActivityIndicator } from 'react-native';
import { useApp } from '../state/AppContext';
import { RADIUS, withAlpha, TYPE, SPACING } from '../theme';
import { GradientButton, PrimaryButton, SecondaryButton } from './GradientButton';
import { SectionHeader, SelectableChip, Avatar, AgeBadge, GenreChip, KissaHeader as KissaHeaderBase } from './bits';
import { HeroCard, GridCard, WideCard, ContinueCard } from './StoryCard';
import { ChatBubble as ChatMessageBase, TypingIndicator } from './chat';
import { EmptyState, ErrorState, LoadingState, OfflineState, LoadingSkeleton } from './states';
import { KissaBottomTabBar as BottomNavigationBase } from './BottomNavigation';
import { CoverImage } from './CoverImage';
import { NaturalImage } from './NaturalImage';

export const KissaHeader = KissaHeaderBase;
export const StoryCard = GridCard;
export const FeaturedStory = HeroCard;
export { SectionHeader, SelectableChip as CategoryChip, Avatar, AgeBadge, GenreChip };
export { PrimaryButton, SecondaryButton, GradientButton };
export { HeroCard as StoryHero };
export { EmptyState, ErrorState, LoadingState, OfflineState, LoadingSkeleton };
export const BottomNavigation = BottomNavigationBase;
export { CoverImage, NaturalImage };

/* SearchBar — large premium search field */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search stories, characters…',
  onClear,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onClear?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.searchIcon, { color: theme.textFaint }]}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        style={[styles.input, { color: theme.text }]}
        returnKeyType="search"
      />
      {value.length > 0 && onClear ? (
        <Pressable onPress={onClear} hitSlop={8} style={[styles.clearBtn, { backgroundColor: theme.surface2 }]}>
          <Text style={[styles.clearText, { color: theme.textDim }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* CharacterCard */
export function CharacterCard({ name, role, onPress }: { name: string; role?: string; onPress?: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.charCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Avatar id={name} name={name} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.charName, { color: theme.text }]}>{name}</Text>
        {role ? <Text style={[styles.charRole, { color: theme.textDim }]}>{role}</Text> : null}
      </View>
    </Pressable>
  );
}

/* MediaCard — natural ratio */
export function MediaCard({ uri, label, onPress }: { uri: string; label?: string; onPress?: () => void }) {
  const { theme } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.mediaCard, { borderColor: theme.border }]}>
      <NaturalImage source={{ uri }} style={styles.mediaImg} fallback={<Text>◐</Text>} />
      {label ? <Text style={[styles.mediaLabel, { color: theme.textDim }]} numberOfLines={1}>{label}</Text> : null}
    </Pressable>
  );
}

/* ChatMessage alias */
export const ChatMessage = ChatMessageBase;

/* ChatComposer — minimal cinematic */
export function ChatComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
  sending,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  placeholder?: string;
  sending?: boolean;
}) {
  const { theme } = useApp();
  return (
    <View style={[styles.composerBar, { backgroundColor: theme.bgSoft, borderColor: theme.borderSoft }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? 'Write your next move…'}
        placeholderTextColor={theme.textFaint}
        multiline
        maxLength={2000}
        editable={!sending}
        style={[styles.composerInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
      />
      <Pressable onPress={onSend} disabled={sending || !value.trim()} style={[styles.composerSend, { backgroundColor: theme.text, opacity: sending || !value.trim() ? 0.4 : 1 }]}>
        <Text style={[styles.composerSendText, { color: theme.bg }]}>↑</Text>
      </Pressable>
    </View>
  );
}

/* Modal wrapper */
export function KissaModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { theme } = useApp();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modalBox, { backgroundColor: theme.bgSoft, borderColor: theme.border }]}>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

/* BottomSheet */
export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { theme } = useApp();
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <View style={[styles.sheetBox, { backgroundColor: theme.bgSoft, borderColor: theme.border }]}>
          {children}
        </View>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  searchIcon: { fontSize: 16 },
  input: { flex: 1, fontSize: 14, paddingVertical: 10 },
  clearBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 10, fontWeight: '700' },
  charCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.lg, padding: 12 },
  charName: { fontSize: 14, fontWeight: '600' },
  charRole: { fontSize: 11.5, marginTop: 2 },
  mediaCard: { borderRadius: RADIUS.md, borderWidth: 1, overflow: 'hidden', width: 160 },
  mediaImg: { width: 160 },
  mediaLabel: { fontSize: 11, padding: 8 },
  composerBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  composerInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14.5, maxHeight: 120 },
  composerSend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  composerSendText: { fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: RADIUS.xl, borderWidth: 1, padding: 18, width: '100%', maxWidth: 360 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetBox: { borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, borderWidth: 1, borderBottomWidth: 0, padding: 18, minHeight: 200 },
});
