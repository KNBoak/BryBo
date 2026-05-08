import * as SecureStore from 'expo-secure-store';
import { logError, logInfo } from './debug';

const KEY = 'brybo_anthropic_api_key';
const TAG = 'apiKeyStore';

export async function getApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch (e) {
    logError(TAG, 'getApiKey threw', e);
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, key);
    logInfo(TAG, 'API key saved');
  } catch (e) {
    logError(TAG, 'setApiKey threw', e);
    throw e;
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
    logInfo(TAG, 'API key cleared');
  } catch (e) {
    logError(TAG, 'clearApiKey threw', e);
  }
}
