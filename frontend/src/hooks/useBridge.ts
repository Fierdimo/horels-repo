import { useEffect, useCallback } from 'react';
import { useUserStore } from '@/stores/userStore';
import { useAuthStore } from '@/stores/authStore';
import { useTranslation } from 'react-i18next';
import {
  isWebView,
  listenToMobile,
  sendToMobile,
  requestNotificationPermission,
  type BridgeMessage,
  type AuthMessage,
  type LocaleMessage
} from '@/utils/bridge';

export function useBridge() {
  const { setAuth } = useAuthStore();
  const { updatePreferences, setExpoToken } = useUserStore();
  const { i18n } = useTranslation();

  const handleBridgeMessage = useCallback((message: BridgeMessage) => {
    switch (message.type) {
      case 'AUTH_TOKEN': {
        const authMsg = message as AuthMessage;
        if (authMsg.payload) {
          setAuth(authMsg.payload.token, {
            id: authMsg.payload.userId,
            email: authMsg.payload.email,
            role: 'owner', // Will be fetched from API
            created_at: new Date().toISOString()
          });
          localStorage.setItem('sw2_token', authMsg.payload.token);
        }
        break;
      }
      case 'LOCALE': {
        const localeMsg = message as LocaleMessage;
        if (localeMsg.payload?.locale) {
          const locale = localeMsg.payload.locale as 'es' | 'en' | 'de' | 'fr';
          i18n.changeLanguage(locale);
          updatePreferences({ language: locale });
        }
        break;
      }
      case 'NOTIFICATION_TOKEN': {
        if (message.payload?.token) {
          setExpoToken(message.payload.token);
        }
        break;
      }
    }
  }, [setAuth, i18n, updatePreferences, setExpoToken]);

  useEffect(() => {
    if (isWebView()) {
      const cleanup = listenToMobile(handleBridgeMessage);
      
      // Request initial data from mobile app
      sendToMobile({ type: 'REQUEST_AUTH' });
      sendToMobile({ type: 'REQUEST_LOCALE' });
      
      return cleanup;
    }
  }, [handleBridgeMessage]);

  const requestNotifications = async () => {
    if (isWebView()) {
      const token = await requestNotificationPermission();
      if (token) {
        setExpoToken(token);
      }
      return token;
    }
    return null;
  };

  return {
    isWebView: isWebView(),
    sendToMobile,
    requestNotifications
  };
}
