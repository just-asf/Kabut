import React, { useState, useEffect } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkSupabaseConnection, ConnectionTestResult, supabaseInitError } from '@/lib/supabase';

export default function SupabaseTestScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [timestamp, setTimestamp] = useState<string>('');

  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

  const isUrlValid = envUrl.startsWith('https://') || envUrl.startsWith('http://');
  const isKeyFormatValid = (envKey.startsWith('eyJ') && envKey.split('.').length === 3) || envKey.startsWith('sb_publishable_');

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await checkSupabaseConnection();
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        success: false,
        message: `Unexpected UI connection check crash: ${msg}`,
        error: err instanceof Error ? err : { message: msg },
        details: { envValid: !!(envUrl && envKey), clientCreated: false },
      });
    } finally {
      setLoading(false);
      setTimestamp(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format keys to hide secrets but show validation
  const formatSecret = (secret: string) => {
    if (!secret) return 'Not Set';
    if (secret.length <= 15) return secret;
    return `${secret.substring(0, 8)}...${secret.substring(secret.length - 8)}`;
  };

  const getStatusColor = () => {
    if (supabaseInitError) return '#dc3545'; // Red
    if (loading) return '#e0a800'; // Amber/Yellow
    if (!testResult) return '#60646C'; // Gray
    return testResult.success ? '#28a745' : '#dc3545'; // Green / Red
  };

  const getStatusText = () => {
    if (supabaseInitError) return 'INIT ERROR';
    if (loading) return 'CONNECTING...';
    if (!testResult) return 'PENDING';
    return testResult.success ? 'SUCCESS' : 'FAILURE';
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <Pressable 
              onPress={() => router.back()} 
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back to the previous screen"
            >
              <ThemedText style={{ color: theme.textSecondary }}>← Back</ThemedText>
            </Pressable>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Supabase Status
            </ThemedText>
          </ThemedView>

          {/* Connection Status Card */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedView style={styles.badgeRow}>
              <ThemedText type="smallBold" style={styles.cardSectionTitle}>
                CONNECTION STATUS
              </ThemedText>
              <ThemedView
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor() },
                ]}
              >
                <ThemedText type="code" style={styles.statusBadgeText}>
                  {getStatusText()}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.separator} />

            <ThemedView style={styles.infoRow}>
              <ThemedText type="small" style={styles.label}>
                Supabase Reachable:
              </ThemedText>
              <ThemedText type="smallBold">
                {testResult ? (testResult.success ? 'Yes' : 'No') : 'Checking...'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoRow}>
              <ThemedText type="small" style={styles.label}>
                Last Checked:
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {timestamp || 'Never'}
              </ThemedText>
            </ThemedView>

            {supabaseInitError && (
              <ThemedView type="backgroundSelected" style={styles.errorBanner}>
                <ThemedText type="smallBold" style={styles.errorText}>
                  🚨 Initialization Failure:
                </ThemedText>
                <ThemedText type="small" style={[styles.errorText, { marginTop: Spacing.half }]}>
                  {supabaseInitError}
                </ThemedText>
              </ThemedView>
            )}

            {!supabaseInitError && testResult && !testResult.success && (
              <ThemedView type="backgroundSelected" style={styles.errorBanner}>
                <ThemedText type="smallBold" style={styles.errorText}>
                  ⚠️ Connection Error:
                </ThemedText>
                <ThemedText type="small" style={[styles.errorText, { marginTop: Spacing.half }]}>
                  {testResult.message}
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Environment Variables Card */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardSectionTitle}>
              ENVIRONMENT CONFIGURATION
            </ThemedText>
            <ThemedView style={styles.separator} />

            {/* URL */}
            <ThemedView style={styles.variableRow}>
              <ThemedView style={styles.variableInfo}>
                <ThemedText type="code" style={styles.variableName}>
                  EXPO_PUBLIC_SUPABASE_URL
                </ThemedText>
                <ThemedText type="small" style={styles.variableValue}>
                  {envUrl ? envUrl : 'Missing'}
                </ThemedText>
              </ThemedView>
              <ThemedView
                style={[
                  styles.dotBadge,
                  { backgroundColor: envUrl && isUrlValid ? '#28a745' : '#dc3545' },
                ]}
              >
                <ThemedText type="code" style={styles.dotBadgeText}>
                  {envUrl && isUrlValid ? 'Valid URL' : 'Invalid'}
                </ThemedText>
              </ThemedView>
            </ThemedView>

            {/* Key */}
            <ThemedView style={styles.variableRow}>
              <ThemedView style={styles.variableInfo}>
                <ThemedText type="code" style={styles.variableName}>
                  EXPO_PUBLIC_SUPABASE_ANON_KEY
                </ThemedText>
                <ThemedText type="small" style={styles.variableValue}>
                  {formatSecret(envKey)}
                </ThemedText>
              </ThemedView>
              <ThemedView
                style={[
                  styles.dotBadge,
                  { backgroundColor: envKey && isKeyFormatValid ? '#28a745' : '#dc3545' },
                ]}
              >
                <ThemedText type="code" style={styles.dotBadgeText}>
                  {envKey && isKeyFormatValid ? 'Valid JWT' : 'Invalid'}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>

          {/* Connection Test Diagnostics */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" style={styles.cardSectionTitle}>
              DIAGNOSTIC OUTPUT
            </ThemedText>
            <ThemedView style={styles.separator} />
            <ScrollView style={styles.jsonConsole} nestedScrollEnabled>
              <ThemedText type="code" style={styles.jsonText}>
                {JSON.stringify(
                  testResult || { pending: true, message: 'Initiating diagnostics...' },
                  null,
                  2
                )}
              </ThemedText>
            </ScrollView>
          </ThemedView>

          {/* Test Action Trigger */}
          <Pressable
            disabled={loading}
            onPress={runTest}
            accessibilityRole="button"
            accessibilityLabel="Run Supabase Connection Test"
            accessibilityState={{ disabled: loading }}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: loading ? '#60646C' : theme.text,
                opacity: pressed ? 0.8 : 1.0,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <ThemedText style={[styles.actionButtonText, { color: theme.background }]}>
                Run Connection Test
              </ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  scrollContent: {
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  backButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    marginRight: Spacing.two,
  },
  headerTitle: {
    fontWeight: '700',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardSectionTitle: {
    letterSpacing: 1.1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginVertical: Spacing.half,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    opacity: 0.8,
  },
  errorBanner: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    marginTop: Spacing.two,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
  },
  variableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.half,
  },
  variableInfo: {
    flex: 1,
    marginRight: Spacing.three,
  },
  variableName: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
  variableValue: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.7,
  },
  dotBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
  },
  dotBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  jsonConsole: {
    maxHeight: 180,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: Spacing.two,
    padding: Spacing.two,
  },
  jsonText: {
    fontSize: 11,
    lineHeight: 16,
  },
  actionButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  actionButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
