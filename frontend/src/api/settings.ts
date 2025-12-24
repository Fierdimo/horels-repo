import apiClient from './client';

export interface PlatformSettings {
  commissionRate: string;
  swapFee: string;
  creditConversionFee: string;
  chargeSwapFeeToRequester?: string;
  chargeSwapFeeToResponder?: string;
  autoApproveGuests: string;
  autoApproveStaff: string;
  requireEmailVerification: string;
  emailNotifications: string;
  bookingAlerts: string;
  systemAlerts: string;
  maintenanceMode: string;
  allowRegistrations: string;
}

/**
 * Get all platform settings
 */
export const getAllSettings = async (): Promise<PlatformSettings> => {
  const response = await apiClient.get('/settings');
  return response.data.settings;
};

/**
 * Get a specific setting by key
 */
export const getSetting = async (key: string): Promise<{ key: string; value: string }> => {
  const response = await apiClient.get(`/settings/${key}`);
  return response.data.setting;
};

/**
 * Update platform settings (bulk update)
 */
export const updateSettings = async (settings: Partial<PlatformSettings>): Promise<PlatformSettings> => {
  const response = await apiClient.put('/settings', { settings });
  return response.data.settings;
};

/**
 * Update a single setting
 */
export const updateSetting = async (key: string, value: string): Promise<{ key: string; value: string }> => {
  const response = await apiClient.put(`/settings/${key}`, { value });
  return response.data.setting;
};

/**
 * Delete a setting
 */
export const deleteSetting = async (key: string): Promise<void> => {
  await apiClient.delete(`/settings/${key}`);
};

/**
 * Reset all settings to defaults
 */
export const resetSettings = async (): Promise<PlatformSettings> => {
  const response = await apiClient.post('/settings/reset');
  return response.data.settings;
};
