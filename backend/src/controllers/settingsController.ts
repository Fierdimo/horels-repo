import { Request, Response } from 'express';
import PlatformSetting from '../models/PlatformSetting';

// Default settings
const DEFAULT_SETTINGS = {
  commissionRate: '10',
  swapFee: '25',
  creditConversionFee: '5',
  autoApproveGuests: 'false',
  autoApproveStaff: 'false',
  requireEmailVerification: 'true',
  emailNotifications: 'true',
  bookingAlerts: 'true',
  systemAlerts: 'true',
  maintenanceMode: 'false',
  allowRegistrations: 'true',
};

/**
 * Get all platform settings
 */
export const getAllSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await PlatformSetting.findAll();
    
    // Convert array to object
    const settingsObject: Record<string, string> = { ...DEFAULT_SETTINGS };
    settings.forEach((setting: any) => {
      settingsObject[setting.key] = setting.value;
    });

    res.json({
      success: true,
      settings: settingsObject,
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
    });
  }
};

/**
 * Get a specific setting by key
 */
export const getSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;

    const setting = await PlatformSetting.findOne({
      where: { key },
    });

    if (!setting) {
      res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
      return;
    }

    res.json({
      success: true,
      setting: {
        key: (setting as any).key,
        value: (setting as any).value,
      },
    });
  } catch (error: any) {
    console.error('Error fetching setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch setting',
    });
  }
};

/**
 * Update platform settings (bulk update)
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid settings format',
      });
      return;
    }

    // Update or create each setting
    const promises = Object.entries(settings).map(async ([key, value]) => {
      const [setting, created] = await PlatformSetting.findOrCreate({
        where: { key },
        defaults: {
          key,
          value: String(value),
        },
      });

      if (!created) {
        await setting.update({ value: String(value) });
      }

      return setting;
    });

    await Promise.all(promises);

    // Fetch updated settings
    const updatedSettings = await PlatformSetting.findAll();
    const settingsObject: Record<string, string> = { ...DEFAULT_SETTINGS };
    updatedSettings.forEach((setting: any) => {
      settingsObject[setting.key] = setting.value;
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: settingsObject,
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
    });
  }
};

/**
 * Update a single setting
 */
export const updateSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      res.status(400).json({
        success: false,
        error: 'Value is required',
      });
      return;
    }

    const [setting, created] = await PlatformSetting.findOrCreate({
      where: { key },
      defaults: {
        key,
        value: String(value),
      },
    });

    if (!created) {
      await setting.update({ value: String(value) });
    }

    res.json({
      success: true,
      message: 'Setting updated successfully',
      setting: {
        key: (setting as any).key,
        value: (setting as any).value,
      },
    });
  } catch (error: any) {
    console.error('Error updating setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update setting',
    });
  }
};

/**
 * Delete a setting
 */
export const deleteSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.params;

    const deleted = await PlatformSetting.destroy({
      where: { key },
    });

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Setting not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Setting deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete setting',
    });
  }
};

/**
 * Reset all settings to defaults
 */
export const resetSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    // Delete all settings
    await PlatformSetting.destroy({
      where: {},
      truncate: true,
    });

    res.json({
      success: true,
      message: 'Settings reset to defaults',
      settings: DEFAULT_SETTINGS,
    });
  } catch (error: any) {
    console.error('Error resetting settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset settings',
    });
  }
};
