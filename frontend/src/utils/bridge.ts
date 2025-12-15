/**
 * WebView Bridge for communication with Secret World mobile app
 * Uses postMessage API for bidirectional communication
 */

export interface BridgeMessage {
  type: string;
  payload?: any;
}

export interface AuthMessage extends BridgeMessage {
  type: 'AUTH_TOKEN';
  payload: {
    token: string;
    userId: number;
    email: string;
  };
}

export interface LocaleMessage extends BridgeMessage {
  type: 'LOCALE';
  payload: {
    locale: string; // 'es', 'en', 'de', 'fr'
  };
}

export interface NotificationMessage extends BridgeMessage {
  type: 'NOTIFICATION';
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
  };
}

/**
 * Check if running inside webview
 */
export function isWebView(): boolean {
  // Check for ReactNativeWebView or custom injected objects
  return !!(window as any).ReactNativeWebView || !!(window as any).SW2Bridge;
}

/**
 * Send message to mobile app
 */
export function sendToMobile(message: BridgeMessage): void {
  if (!isWebView()) {
    console.warn('Not in webview, message not sent:', message);
    return;
  }

  const messageStr = JSON.stringify(message);
  
  // Try ReactNativeWebView first
  if ((window as any).ReactNativeWebView) {
    (window as any).ReactNativeWebView.postMessage(messageStr);
    return;
  }

  // Try custom bridge
  if ((window as any).SW2Bridge && (window as any).SW2Bridge.postMessage) {
    (window as any).SW2Bridge.postMessage(messageStr);
    return;
  }

  console.error('WebView bridge not found');
}

/**
 * Listen for messages from mobile app
 */
export function listenToMobile(callback: (message: BridgeMessage) => void): () => void {
  const handler = (event: MessageEvent) => {
    try {
      const message: BridgeMessage = typeof event.data === 'string' 
        ? JSON.parse(event.data) 
        : event.data;
      
      callback(message);
    } catch (error) {
      console.error('Failed to parse bridge message:', error);
    }
  };

  window.addEventListener('message', handler);
  document.addEventListener('message', handler as EventListener); // For some webviews

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handler);
    document.removeEventListener('message', handler as EventListener);
  };
}

/**
 * Request notification permission and Expo push token
 */
export function requestNotificationPermission(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!isWebView()) {
      resolve(null);
      return;
    }

    const messageId = `notif_${Date.now()}`;
    
    const cleanup = listenToMobile((message) => {
      if (message.type === 'NOTIFICATION_TOKEN' && message.payload?.messageId === messageId) {
        cleanup();
        resolve(message.payload.token || null);
      }
    });

    sendToMobile({
      type: 'REQUEST_NOTIFICATION_PERMISSION',
      payload: { messageId }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);
  });
}

/**
 * Send push notification via Expo (through mobile app)
 */
export function sendPushNotification(notification: {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, any>;
}): void {
  sendToMobile({
    type: 'SEND_PUSH_NOTIFICATION',
    payload: notification
  });
}
