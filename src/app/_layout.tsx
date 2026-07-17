console.log('[1] JS Bundle Loaded');

import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, Platform } from 'react-native';
import { Stack } from 'expo-router';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { GlobalErrorProvider } from '@/providers/GlobalErrorProvider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    console.log('[2] RootLayout Mounted');
    console.log('[3] SafeAreaProvider Mounted');
  }, []);

  return (
    <GlobalErrorProvider>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen 
              name="air" 
              options={{
                animation: 'fade',
                animationDuration: 400,
              }}
            />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GlobalErrorProvider>
  );
}
