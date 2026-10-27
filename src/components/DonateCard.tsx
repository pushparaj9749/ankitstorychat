/**
 * v2.12.0 — "Help the Developer" card (About screen).
 *
 * With no UPI ID configured it is the old "Coming Soon" card. With one, it
 * offers a voluntary UPI donation: a button that opens the user's own UPI
 * app, a scannable QR, and the UPI ID itself. No server, no tracking,
 * nothing unlocked — see src/lib/donate.ts.
 */
import React, { useMemo } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useApp } from '../state/AppContext';
import { GradientButton } from './GradientButton';
import { Icon, ICON_SIZE } from './icons';
import { DONATE_PAYEE_NAME, DONATE_UPI_ID, isValidUpiId, upiPayUrl } from '../lib/donate';
import { qrMatrix, qrPath } from '../lib/qr';
import { RADIUS, SCALE, SHADOWS, SPACING, withAlpha } from '../theme';

const QR_QUIET = 4;
const QR_PX = 200;

export function UpiQr({ value, size = QR_PX }: { value: string; size?: number }) {
  const { path, box } = useMemo(() => {
    const m = qrMatrix(value);
    return { path: qrPath(m, QR_QUIET), box: m.size + QR_QUIET * 2 };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} accessibilityLabel="UPI QR code">
      <Rect x={0} y={0} width={box} height={box} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}

async function shareUpiId(upiId: string) {
  try {
    await Share.share({ message: `Kissa (Ankit) UPI ID: ${upiId}` });
  } catch {
    /* user dismissed */
  }
}

async function openUpi(url: string, upiId: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // No UPI app on this device — let the user copy/send the ID instead.
    await shareUpiId(upiId);
  }
}

export function DonateCard({ upiId = DONATE_UPI_ID, repoUrl }: { upiId?: string; repoUrl: string }) {
  const { theme } = useApp();
  const id = upiId.trim();
  const url = isValidUpiId(id) ? upiPayUrl(id) : null;

  const cardStyle = [
    styles.dev,
    { backgroundColor: withAlpha(theme.surface, 0.9), borderColor: theme.border },
    SHADOWS.card,
  ];

  if (!url) {
    return (
      <View style={cardStyle}>
        <Icon name="heart" size={ICON_SIZE.xl} color={theme.accent} />
        <Text style={[styles.devTitle, { color: theme.text }]}>Help the Developer</Text>
        <Text style={[styles.soon, { backgroundColor: theme.primarySoft, color: theme.accent }]}>
          Coming Soon
        </Text>
        <Text style={[styles.devDesc, { color: theme.textDim }]}>
          Voluntary donations are on the way. Until then — immerse yourself in stories, share with fellow storytellers, and star the repo on GitHub!
        </Text>
        <Pressable onPress={() => void Linking.openURL(repoUrl)} accessibilityRole="button">
          <Text style={[styles.link, { color: theme.accent }]}>Star on GitHub</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={cardStyle} testID="donate-card">
      <Icon name="heart" size={ICON_SIZE.xl} color={theme.accent} />
      <Text style={[styles.devTitle, { color: theme.text }]}>Help the Developer</Text>
      <Text style={[styles.soon, { backgroundColor: theme.primarySoft, color: theme.accent }]}>
        100% Optional
      </Text>
      <Text style={[styles.devDesc, { color: theme.textDim }]}>
        Kissa free hai aur free hi rahega — koi feature lock nahi, koi ads nahi. Agar kahaniyan pasand aa rahi hain aur
        support karna chaho, toh UPI se jo dil kare bhej do.
      </Text>

      <View style={styles.btn}>
        <GradientButton
          title="Donate via UPI"
          iconName="heart"
          accessibilityLabel={`Donate to ${DONATE_PAYEE_NAME} via UPI`}
          onPress={() => void openUpi(url, id)}
        />
      </View>

      <View style={[styles.qrBox, SHADOWS.card]}>
        <UpiQr value={url} />
      </View>
      <Text style={[styles.qrHint, { color: theme.textFaint }]}>Doosre phone se scan karke bhi bhej sakte ho</Text>

      <View style={[styles.idRow, { borderColor: theme.border, backgroundColor: withAlpha(theme.bg, 0.5) }]}>
        <Text selectable style={[styles.idText, { color: theme.text }]} numberOfLines={1}>
          {id}
        </Text>
        <Pressable
          onPress={() => void shareUpiId(id)}
          accessibilityRole="button"
          accessibilityLabel="Share UPI ID"
          hitSlop={10}
          style={styles.idShare}
        >
          <Icon name="share" size={ICON_SIZE.sm} color={theme.accent} />
        </Pressable>
      </View>
      <Text style={[styles.payee, { color: theme.textFaint }]}>Payee: {DONATE_PAYEE_NAME}</Text>

      <Text style={[styles.fine, { color: theme.textFaint }]}>
        Payment seedha aapke UPI app se hota hai — Kissa ko koi payment data nahi milta, aur donate karne se app mein kuch
        badalta nahi.
      </Text>

      <Pressable onPress={() => void Linking.openURL(repoUrl)} accessibilityRole="button">
        <Text style={[styles.link, { color: theme.accent }]}>Star on GitHub</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dev: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  devTitle: { fontSize: SCALE.title, fontWeight: '700', marginTop: 8 },
  soon: {
    fontSize: SCALE.micro,
    fontWeight: '700',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  devDesc: { fontSize: SCALE.small, textAlign: 'center', lineHeight: 21, marginTop: 10 },
  btn: { alignSelf: 'stretch', marginTop: SPACING.lg },
  qrBox: {
    marginTop: SPACING.lg,
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  qrHint: { fontSize: SCALE.micro, marginTop: 8, textAlign: 'center' },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: SPACING.md,
  },
  idText: { flex: 1, fontSize: SCALE.small, fontWeight: '700', textAlign: 'center' },
  idShare: { padding: 8 },
  payee: { fontSize: SCALE.micro, marginTop: 6 },
  fine: { fontSize: SCALE.micro, textAlign: 'center', lineHeight: 17, marginTop: SPACING.md },
  link: { fontWeight: '700', marginTop: 12, fontSize: SCALE.small },
});
