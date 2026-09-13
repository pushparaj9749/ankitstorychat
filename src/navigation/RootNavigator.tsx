/** Root navigation: onboarding stack -> main tabs -> detail screens. */
import React, { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { checkForUpdates, defaultManifestUrl } from '../content/loader';
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
import { ContentUpdates } from '../screens/ContentUpdates';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function tabIcon(name: string, focused: boolean) {
  const map: Record<string, string> = { Home: '🏠', Discover: '🔍', Library: '📚', Settings: '⚙️' };
  return <Text style={{ fontSize: focused ? 22 : 20 }}>{map[name] ?? '•'}</Text>;
}

function MainTabs() {
  const { theme, profile, settings, setUpdateAvailable } = useApp();
  const checked = useRef(false);

  // Silent content check once per launch (best-effort, offline-safe).
  useEffect(() => {
    if (checked.current || !profile) return;
    checked.current = true;
    // Small delay so first paint stays fast.
    const t = setTimeout(() => {
      void (async () => {
        try {
          const url = settings.contentManifestUrl || defaultManifestUrl();
          const res = await checkForUpdates(url, profile.ageGroup);
          if (res.hasUpdate) {
            setUpdateAvailable(true);
            if (settings.notifications.enabled && settings.notifications.contentUpdates) {
              await notifyContentUpdate(res.newStories.length + res.updatedStories.length);
            }
          }
        } catch {
          // Offline or unreachable — the app works fully offline anyway.
        }
      })();
    }, 4000);
    return () => clearTimeout(t);
  }, [profile, settings, setUpdateAvailable]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => tabIcon(route.name, focused),
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
        tabBarStyle: { backgroundColor: theme.bgSoft, borderTopColor: theme.border },
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Discover" component={Discover} />
      <Tab.Screen name="Library" component={Library} />
      <Tab.Screen name="Settings" component={Settings} />
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
            <Stack.Screen name="ContentUpdates" component={ContentUpdates} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
