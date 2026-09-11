/**
 * Kissa — local-first AI story chat.
 * No backend. No accounts. Your stories stay on your device.
 */
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/state/AppContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initNotificationHandler } from './src/lib/notifications';

export default function App() {
  useEffect(() => {
    initNotificationHandler();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
