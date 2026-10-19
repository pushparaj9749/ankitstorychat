/**
 * KISSA UI templates — the user picks the whole-app look in
 * Settings → Appearance:
 *
 *   'noir'    v2.7 "Kissa Noir" (default): neutral midnight, single rose accent
 *   'classic' pre-v2.7 "Kissa Night": plum night, pink→violet gradients
 *
 * Screens whose LAYOUT differs between templates are routed through these
 * wrappers; everything else follows `theme` from useApp (the palette switches
 * with the template). Story logic, memory and data are shared — only the look
 * changes.
 */
import React from 'react';
import type { BottomTabBarProps, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../types';
import { useApp } from '../state/AppContext';
import { Home } from '../screens/Home';
import { StoryDetail } from '../screens/StoryDetail';
import { KissaBottomTabBar } from '../components/BottomNavigation';
import { ChatBubble as NoirChatBubble, TypingIndicator as NoirTypingIndicator } from '../components/chat';
import { Home as ClassicHome } from './classic/Home';
import { StoryDetail as ClassicStoryDetail } from './classic/StoryDetail';
import { KissaBottomTabBar as ClassicTabBar } from './classic/BottomNavigation';
import { ChatBubble as ClassicChatBubble, TypingIndicator as ClassicTypingIndicator } from './classic/chat';

export function useUiTemplate() {
  return useApp().uiTemplate;
}

export function HomeRoute(props: BottomTabScreenProps<MainTabParamList, 'Home'>) {
  return useUiTemplate() === 'classic' ? <ClassicHome {...props} /> : <Home {...props} />;
}

export function StoryDetailRoute(props: NativeStackScreenProps<RootStackParamList, 'StoryDetail'>) {
  return useUiTemplate() === 'classic' ? <ClassicStoryDetail {...props} /> : <StoryDetail {...props} />;
}

export function TemplateTabBar(props: BottomTabBarProps) {
  return useUiTemplate() === 'classic' ? <ClassicTabBar {...props} /> : <KissaBottomTabBar {...props} />;
}

/** Chat parts for the active template (the Chat screen's logic is shared). */
export function useChatParts() {
  const classic = useUiTemplate() === 'classic';
  return classic
    ? { ChatBubble: ClassicChatBubble, TypingIndicator: ClassicTypingIndicator }
    : { ChatBubble: NoirChatBubble, TypingIndicator: NoirTypingIndicator };
}
