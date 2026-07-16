import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
<<<<<<< HEAD

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
=======
import { Stack } from 'expo-router';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
>>>>>>> 2adb8929331c0ac5a7eae9b2e21552dbed5215b8
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
<<<<<<< HEAD
      <AppTabs />
=======
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="air" />
        <Stack.Screen name="supabase-test" />
      </Stack>
>>>>>>> 2adb8929331c0ac5a7eae9b2e21552dbed5215b8
    </ThemeProvider>
  );
}
