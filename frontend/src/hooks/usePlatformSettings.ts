import { useState, useEffect } from 'react';
import apiClient from '@/api/client';

export interface PlatformSettings {
  swapFee: number;
  commissionRate?: number;
  creditConversionFee?: number;
  [key: string]: any;
}

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get('/settings/public/swap-fee');
      setSettings({
        swapFee: Number(response.data.swapFee) || 0,
      });
    } catch (err: any) {
      console.error('Error loading platform settings:', err);
      setError(err.message || 'Failed to load settings');
      // Set default values on error
      setSettings({
        swapFee: 25, // Default fallback
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { settings, isLoading, error, refetch: loadSettings };
}
