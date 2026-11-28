/**
 * Field — one text input that cannot become invisible.
 *
 * WHY THIS EXISTS
 * The Welcome/login screen shipped inputs with `height: SCALE.h2`. SCALE is the
 * FONT-SIZE scale (h2 = 22), so every input was 22px tall — Android's TextInput
 * keeps its own vertical padding and a 15px line inside 22px, and both the
 * placeholder and the typed text ended up clipped out of view. Users typed
 * their username and password into a field that looked empty. (Reported from a
 * real device: two identical empty boxes, no cursor text.)
 *
 * So the height here is a TOUCH target, never a type token:
 *   - minHeight = 56 (comfortable, above the 44 minimum)
 *   - explicit vertical padding so the line box is never squeezed
 *   - textAlignVertical: 'center' so Android centres the value, not the clip
 *   - no fixed height that could disagree with the font scale
 *
 * Everything else (label, hint, error, reveal button) lives here too, so the
 * two auth screens and ForgotPassword cannot drift apart again.
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useApp } from '../state/AppContext';
import { Icon } from './icons';
import { RADIUS, SPACING, TYPE, withAlpha } from '../theme';
import { lightBuzz } from '../lib/haptics';

export const FIELD_HEIGHT = 56;

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  prefix,
  secret,
  onFocusChange,
  inputProps,
  inputRef,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** Always-visible helper line (rules, format). */
  hint?: string;
  /** Replaces the hint in red when the value is invalid. */
  error?: string | null;
  /** Leading glyph, e.g. '@' for a username. */
  prefix?: string;
  /** Renders the show/hide eye; the parent owns the shared `show` state. */
  secret?: { shown: boolean; onToggle: () => void };
  onFocusChange?: (focused: boolean) => void;
  inputProps?: TextInputProps;
  /** Forwarded to the TextInput so screens can chain focus (next → go). */
  inputRef?: React.Ref<TextInput>;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useApp();
  const [focused, setFocused] = useState(false);
  const bad = !!error;
  const accent = bad ? theme.danger : focused ? theme.primary : theme.border;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.label, { color: focused ? theme.textDim : theme.textFaint }]}>
        {label.toUpperCase()}
      </Text>

      <View
        style={[
          styles.box,
          {
            borderColor: accent,
            backgroundColor: withAlpha(theme.surface2, focused ? 1 : 0.72),
          },
          // Do not add/remove elevation or shadow on focus: Fabric can remount
          // the native input and immediately dismiss the keyboard (RN #45798).
          focused && { borderWidth: 1.5 },
        ]}
      >
        {prefix ? <Text style={[styles.prefix, { color: focused ? theme.textDim : theme.textFaint }]}>{prefix}</Text> : null}

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={secret ? !secret.shown : false}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
          style={[styles.input, { color: theme.text }]}
          selectionColor={theme.primary}
          cursorColor={theme.primary}
          accessibilityLabel={label}
          {...inputProps}
        />

        {secret ? (
          <Pressable
            onPress={() => {
              lightBuzz();
              secret.onToggle();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={secret.shown ? 'Password chhupao' : 'Password dikhao'}
            style={styles.eye}
          >
            <Icon name={secret.shown ? 'eye-off' : 'eye'} size={19} color={focused ? theme.textDim : theme.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {error || hint ? (
        <Text
          style={[styles.hint, { color: bad ? theme.danger : theme.textFaint }]}
          accessibilityLiveRegion={bad ? 'polite' : 'none'}
          numberOfLines={2}
        >
          {error ?? hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { ...TYPE.overline, fontSize: 10.5, letterSpacing: 1.5 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    // A touch target — deliberately NOT a type token. See the header note.
    minHeight: FIELD_HEIGHT,
    paddingVertical: 14,
    gap: 8,
  },
  prefix: { ...TYPE.body, fontWeight: '700', fontSize: 16, marginTop: -1 },
  input: {
    flex: 1,
    ...TYPE.body,
    fontSize: 16,
    lineHeight: 21,
    // Android: without this the value is laid out from the top and clipped.
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  eye: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  hint: { ...TYPE.caption, fontSize: 11.5, lineHeight: 16, letterSpacing: 0.2, marginTop: -1 },
  spacer: { height: SPACING.md },
});
