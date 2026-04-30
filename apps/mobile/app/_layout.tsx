import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDataStore } from '../src/stores/dataStore';
import { AsyncStorageAdapter } from '../src/storage/AsyncStorageAdapter';
import { Spinner } from '../src/components/ui';
import { colors } from '../src/theme';
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
    const inTabsGroup = segments[0] === '(tabs)';
    if (!activeUserId && inTabsGroup) {
      logInfo('Layout', 'No active user in tabs → redirect to /');
      router.replace('/');
    } else if (
      activeUserId &&
      !inTabsGroup &&
      segments[0] !== 'accounts' &&
      segments[0] !== 'contacts' &&
      segments[0] !== 'events' &&
      segments[0] !== 'days'
    ) {
      logInfo('Layout', 'Active user, not in tabs → redirect to myday');
      router.replace('/(tabs)/myday');
    } else {
      logInfo('Layout', 'Guard: no redirect needed');
    }
  }, [initialized, activeUserId]);

  if (!initialized) {
    logInfo('Layout', 'Rendering loading spinner (not initialized)');
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <Spinner size="large" />
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
  loading: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
