/** Root navigation: onboarding stack -> main tabs -> detail screens. */
import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { checkForUpdates, effectiveContentApiBaseUrl } from '../content/loader';
import { notifyContentUpdate } from '../lib/notifications';
import { setAmbientPlaying } from '../lib/sound';

import { OnboardingName } from '../screens/OnboardingName';
import { OnboardingAge } from '../screens/OnboardingAge';
import { Home } from '../screens/Home';
import { Discover } from '../screens/Discover';
import { Library } from '../screens/Library';
import { Settings } from '../screens/Settings';
import { StoryDetail } from '../screens/StoryDetail';
import { Saves } from '../screens/Saves';
import { Chat } from '../screens/Chat';
import { Memory } from '../screens/Memory';
import { AIAddons } from '../screens/AIAddons';
import { ProviderEditor } from '../screens/ProviderEditor';
import { SettingsProfile } from '../screens/SettingsProfile';
import { SettingsAppearance } from '../screens/SettingsAppearance';
import { SettingsAudio } from '../screens/SettingsAudio';
import { SettingsNotifications } from '../screens/SettingsNotifications';
import { SettingsStorage } from '../screens/SettingsStorage';
import { Terms } from '../screens/Terms';
import { Privacy } from '../screens/Privacy';
import { About } from '../screens/About';
import { SubmitStory } from '../screens/SubmitStory';
import { SubmissionSuccess } from '../screens/SubmissionSuccess';
import { MySubmissions } from '../screens/MySubmissions';
import { AdminPanel } from '../screens/AdminPanel';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_META: Record<string, { glyph: string; label: string }> = {
  Home: { glyph: '◆', label: 'Home' },
  Discover: { glyph: '◎', label: 'Shows' },
  Library: { glyph: '▣', label: 'Library' },
  Settings: { glyph: '○', label: 'You' },
};

function tabIcon(name: string, focused: boolean, color: string) {
  const meta = TAB_META[name] ?? { glyph: '•', label: name };
  return (
    <View style={{ alignItems: 'center', minWidth: 48 }}>
      <Text style={{ fontSize: focused ? 16 : 15, color, fontWeight: focused ? '800' : '500' }}>
        {meta.glyph}
      </Text>
    </View>
  );
}

function MainTabs() {
  const { theme, profile, settings } = useApp();
  const checked = useRef(false);

  // Silent content check once per launch (best-effort, offline-safe). Stories
  // are fetched/cached automatically — there is no manual "update" UI.
  useEffect(() => {
    if (checked.current || !profile) return;
    checked.current = true;
    // Small delay so first paint stays fast.
    const t = setTimeout(() => {
      void (async () => {
        try {
          const base = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
          const res = await checkForUpdates(base, profile.ageGroup);
          if (res.hasUpdate && settings.notifications.enabled && settings.notifications.contentUpdates) {
            await notifyContentUpdate(res.newStories.length + res.updatedStories.length);
          }
        } catch {
          // Offline or unreachable — the app works fully offline anyway.
        }
      })();
    }, 4000);
    return () => clearTimeout(t);
  }, [profile, settings]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => tabIcon(route.name, focused, color),
        tabBarLabel: TAB_META[route.name]?.label ?? route.name,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: theme.bgSoft,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
          height: 62,
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen name="Home" component={Home} options={{ tabBarAccessibilityLabel: 'Home' }} />
      <Tab.Screen name="Discover" component={Discover} options={{ tabBarAccessibilityLabel: 'Discover shows' }} />
      <Tab.Screen name="Library" component={Library} options={{ tabBarAccessibilityLabel: 'Library' }} />
      <Tab.Screen name="Settings" component={Settings} options={{ tabBarAccessibilityLabel: 'You, settings' }} />
    </Tab.Navigator>
  );
}

/** One-time side effects after boot (ambient music, etc.). */
function BootEffects() {
  const { settings } = useApp();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (settings.music) setAmbientPlaying(true);
  }, [settings.music]);
  return null;
}

export function RootNavigator() {
  const { theme, profile } = useApp();
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: theme.primary,
          background: theme.bg,
          card: theme.bgSoft,
          text: theme.text,
          border: theme.border,
          notification: theme.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <BootEffects />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!profile ? (
          <>
            <Stack.Screen name="OnboardingName" component={OnboardingName} />
            <Stack.Screen name="OnboardingAge" component={OnboardingAge} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="StoryDetail" component={StoryDetail} />
            <Stack.Screen name="Saves" component={Saves} />
            <Stack.Screen name="Chat" component={Chat} options={{ animation: 'fade' }} />
            <Stack.Screen name="Memory" component={Memory} />
            <Stack.Screen name="AIAddons" component={AIAddons} />
            <Stack.Screen name="ProviderEditor" component={ProviderEditor} />
            <Stack.Screen name="SettingsProfile" component={SettingsProfile} />
            <Stack.Screen name="SettingsAppearance" component={SettingsAppearance} />
            <Stack.Screen name="SettingsAudio" component={SettingsAudio} />
            <Stack.Screen name="SettingsNotifications" component={SettingsNotifications} />
            <Stack.Screen name="SettingsStorage" component={SettingsStorage} />
            <Stack.Screen name="Terms" component={Terms} />
            <Stack.Screen name="Privacy" component={Privacy} />
            <Stack.Screen name="About" component={About} />
            <Stack.Screen name="SubmitStory" component={SubmitStory} />
            <Stack.Screen name="SubmissionSuccess" component={SubmissionSuccess} />
            <Stack.Screen name="MySubmissions" component={MySubmissions} />
            <Stack.Screen name="AdminPanel" component={AdminPanel} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
