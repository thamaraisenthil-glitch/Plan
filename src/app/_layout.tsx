import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast } from '../components/Toast';
import { useNotificationResponses, SNOOZE_MINUTES } from '../lib/notifications';
import { StoreProvider, useStore } from '../lib/store';
import { useColors } from '../lib/theme';

function AppStack() {
  const c = useColors();
  const { ready } = useStore();
  const toast = useToast();
  useNotificationResponses(
    () => router.navigate('/'),
    () => toast(`Snoozed for ${SNOOZE_MINUTES} minutes`)
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const modal = { presentation: 'modal' as const, headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg } };
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="event" options={{ ...modal, title: 'Schedule item' }} />
      <Stack.Screen name="task" options={{ ...modal, title: 'Task' }} />
      <Stack.Screen name="settings" options={{ ...modal, title: 'Settings' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ToastProvider>
          <StatusBar style="auto" />
          <AppStack />
        </ToastProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
