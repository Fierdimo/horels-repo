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
    locale: 'es' | 'en' | 'de' | 'fr';
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

export interface NotificationTokenMessage extends BridgeMessage {
  type: 'NOTIFICATION_TOKEN';
  payload: {
    messageId: string;
    token: string;
  };
}
