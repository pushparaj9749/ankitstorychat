/**
 * Root Navigation — Cinematic Tabs + Stack for Kissa v2.4.2.
 * Memory UI completely removed (internal engine only).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { checkForUpdates, effectiveContentApiBaseUrl } from '../content/loader';
import { notifyContentUpdate } from '../lib/notifications';
import { setAmbientPlaying } from '../lib/sound';
import { NavScrollProvider } from './NavScrollContext';
import { KissaBottomTabBar } from '../components/BottomNavigation';

import { OnboardingName } from '../screens/OnboardingName';
import { OnboardingAge } from '../screens/OnboardingAge';
import { Home } from '../screens/Home';
import { Discover } from '../screens/Discover';
import { Library } from '../screens/Library';
import { Settings } from '../screens/Settings';
import { StoryDetail } from '../screens/StoryDetail';
import { Saves } from '../screens/Saves';
import { Chat } from '../screens/Chat';
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

/* Stable tab-bar renderer (an inline arrow re-created the bar's props every render). */
const renderTabBar = (props: BottomTabBarProps) => <KissaBottomTabBar {...props} />;

/*
 * Performance: screens that are not on top (tabs behind Chat, inactive tabs)
 * are FROZEN — they skip re-renders until they're visible again. Without this
 * every app-state change (a saved message, a favourite, a journey refresh)
 * re-rendered every mounted screen, including card-heavy Home, mid-chat.
 */
const TAB_OPTIONS = { headerShown: false, tabBarHideOnKeyboard: true, freezeOnBlur: true } as const;
const STACK_OPTIONS = { headerShown: false, animation: 'slide_from_right', freezeOnBlur: true } as const;

function MainTabs() {
  const { profile, settings } = useApp();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !profile) return;
    checked.current = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const base = effectiveContentApiBaseUrl(settings.contentApiBaseUrl);
          const res = await checkForUpdates(base, profile.ageGroup);
          if (res.hasUpdate && settings.notifications.enabled && settings.notifications.contentUpdates) {
            await notifyContentUpdate(res.newStories.length + res.updatedStories.length);
          }
        } catch {}
      })();
    }, 4000);
    return () => clearTimeout(t);
  }, [profile, settings]);

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={TAB_OPTIONS}
    >
      <Tab.Screen name="Home" component={Home} options={{ tabBarAccessibilityLabel: 'Home' }} />
      <Tab.Screen name="Discover" component={Discover} options={{ tabBarAccessibilityLabel: 'Explore shows' }} />
      <Tab.Screen name="Library" component={Library} options={{ tabBarAccessibilityLabel: 'Story Library' }} />
      <Tab.Screen name="Settings" component={Settings} options={{ tabBarAccessibilityLabel: 'Profile and Settings' }} />
    </Tab.Navigator>
  );
}

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
  // Memoised: a new theme object on every app-state change made
  // NavigationContainer re-render the ENTIRE navigation tree each time.
  const navTheme = useMemo<Theme>(
    () => ({
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
        heavy: { fontFamily: 'System', fontWeight: '800' },
      },
    }),
    [theme],
  );

  return (
    <NavScrollProvider>
      <NavigationContainer theme={navTheme}>
        <BootEffects />
        <Stack.Navigator screenOptions={STACK_OPTIONS}>
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
    </NavScrollProvider>
  );
}
