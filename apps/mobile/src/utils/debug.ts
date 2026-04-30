import { Alert } from 'react-native';

// Set to true to get Alert popups in addition to console logs
export const DEBUG = true;

type LogLevel = 'info' | 'warn' | 'error';

function serializeData(data: unknown): string {
  if (data instanceof Error) {
    return `${data.name}: ${data.message}${data.stack ? '\n' + data.stack : ''}`;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function formatMessage(tag: string, message: string, data?: unknown): string {
  const time = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const dataStr = data !== undefined ? `\n${serializeData(data)}` : '';
  return `[${time}] [${tag}] ${message}${dataStr}`;
}

export function log(tag: string, message: string, data?: unknown, level: LogLevel = 'info') {
  const formatted = formatMessage(tag, message, data);

  switch (level) {
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
    default:
      console.log(formatted);
  }

  if (DEBUG && level !== 'info') {
    // Only alert for warn/error — info goes to console only to avoid alert spam
    const alertTitle = level === 'error' ? '🔴 ERROR' : '🟡 WARN';
    Alert.alert(`${alertTitle} ${tag}`, formatted);
  }
}

export function logInfo(tag: string, message: string, data?: unknown) {
  log(tag, message, data, 'info');
}

export function logWarn(tag: string, message: string, data?: unknown) {
  log(tag, message, data, 'warn');
}

export function logError(tag: string, message: string, data?: unknown) {
  log(tag, message, data, 'error');
}
