import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'es' | 'en' | 'de' | 'fr';
  notifications: boolean;
}

interface UserState {
  preferences: UserPreferences;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  expoToken: string | null;
  setExpoToken: (token: string | null) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      preferences: {
        theme: 'system',
        language: 'es',
        notifications: true
      },
      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences }
        })),
      expoToken: null,
      setExpoToken: (token) => set({ expoToken: token })
    }),
    {
      name: 'sw2-user'
    }
  )
);
