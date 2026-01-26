import { Capacitor } from '@capacitor/core';

/**
 * Auth debug logging utility for tracking authentication events
 * across web and native platforms
 */

const DEBUG_PREFIX = '[Auth]';

export const logAuthEvent = (event: string, data?: unknown): void => {
  const timestamp = new Date().toISOString();
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  
  const logData = {
    timestamp,
    platform,
    isNative,
    event,
    ...(data && { data }),
  };
  
  console.log(`${DEBUG_PREFIX} ${event}`, logData);
};

export const logAuthError = (event: string, error: unknown): void => {
  const timestamp = new Date().toISOString();
  const platform = Capacitor.getPlatform();
  
  // Extract useful error information
  let errorInfo: Record<string, unknown> = {};
  
  if (error instanceof Error) {
    errorInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    };
  } else if (typeof error === 'object' && error !== null) {
    errorInfo = error as Record<string, unknown>;
  } else {
    errorInfo = { raw: String(error) };
  }
  
  console.error(`${DEBUG_PREFIX} ERROR: ${event}`, {
    timestamp,
    platform,
    error: errorInfo,
  });
};

export const logSessionState = (
  hasSession: boolean,
  userId?: string,
  expiresAt?: number
): void => {
  logAuthEvent('Session State', {
    hasSession,
    userId: userId ? `${userId.slice(0, 8)}...` : null,
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    expiresIn: expiresAt ? Math.round((expiresAt * 1000 - Date.now()) / 1000 / 60) + ' minutes' : null,
  });
};

export const logStorageOperation = (
  operation: 'get' | 'set' | 'remove',
  key: string,
  success: boolean,
  valuePreview?: string
): void => {
  logAuthEvent(`Storage ${operation}`, {
    key,
    success,
    valuePreview: valuePreview ? `${valuePreview.slice(0, 50)}...` : null,
  });
};
