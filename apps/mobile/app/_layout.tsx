import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDataStore } from '../src/stores/dataStore';
import { AsyncStorageAdapter } from '../src/storage/AsyncStorageAdapter';
import { Spinner } from '../src/components/ui';
import { colors, spacing, typography } from '../src/theme';
import { logInfo, logError } from '../src/utils/debug';

const storage = new AsyncStorageAdapter();

export default function RootLayout() {
  const init = useDataStore((s) => s.init);
  const initialized = useDataStore((s) => s._initialized);
  const activeUserId = useDataStore((s) => s.activeUserId);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    logInfo('Layout', 'Calling init(storage)');
    init(storage).catch((e) => logError('Layout', 'init() threw', e));
  }, []);

  useEffect(() => {
    logInfo('Layout', 'Auth guard effect', { initialized, activeUserId, segments });
    if (!initialized) {
      logInfo('Layout', 'Not initialized yet — skipping guard');
      return;
    }
    const first = (segments as readonly string[])[0];
    const onIndex = first === undefined;
    const onMain = first === 'main';
    if (!activeUserId && !onIndex) {
      logInfo('Layout', 'No active user → redirect to /');
      router.replace('/');
    } else if (activeUserId && !onMain) {
      logInfo('Layout', 'Active user → redirect to /main');
      router.replace('/main');
    } else {
      logInfo('Layout', 'Guard: no redirect needed');
    }
  }, [initialized, activeUserId, segments]);

  if (!initialized) {
    logInfo('Layout', 'Rendering splash (not initialized)');
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <View style={styles.splashLogo}>
            <Text style={styles.splashLogoText}>B</Text>
          </View>
          <Text style={styles.splashTitle}>BryBo</Text>
          <Text style={styles.splashSubtitle}>your day, logged</Text>
          <View style={styles.splashSpinner}>
            <Spinner size="small" />
          </View>
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  logInfo('Layout', 'Rendering Slot (initialized)', { activeUserId });
  return (
    <SafeAreaProvider>
      <Slot />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  splashLogo: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  splashLogoText: {
    color: '#fff',
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    letterSpacing: -1,
  },
  splashTitle: {
    color: colors.text.primary,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    letterSpacing: -0.5,
  },
  splashSubtitle: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  splashSpinner: {
    marginTop: spacing[6],
  },
});
