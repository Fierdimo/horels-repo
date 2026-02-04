import { Request, Response } from 'express';
import PlatformSetting from '../models/PlatformSetting';
import { CreditCalculationService } from '../services/CreditCalculationService';

// Default settings
const DEFAULT_SETTINGS = {
  commissionRate: '10',
  swapFee: '25',
  creditConversionFee: '5',
  creditToEurRate: '0.10',
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
    
    // Map database keys to frontend keys
    const keyMapping: Record<string, string> = {
      'marketplace_commission_rate': 'commissionRate',
      'swap_fee': 'swapFee',
      'credit_conversion_fee': 'creditConversionFee',
      'charge_swap_fee_to_requester': 'chargeSwapFeeToRequester',
      'charge_swap_fee_to_responder': 'chargeSwapFeeToResponder',
      'credit_to_eur_rate': 'creditToEurRate',
      'auto_approve_guests': 'autoApproveGuests',
      'auto_approve_staff': 'autoApproveStaff',
      'require_email_verification': 'requireEmailVerification',
      'email_notifications': 'emailNotifications',
      'booking_alerts': 'bookingAlerts',
      'system_alerts': 'systemAlerts',
      'maintenance_mode': 'maintenanceMode',
      'allow_registrations': 'allowRegistrations',
    };
    
    // Convert array to object with defaults
    const settingsObject: Record<string, string> = { ...DEFAULT_SETTINGS };
    settings.forEach((setting: any) => {
      const dbKey = setting.get('key');
      const frontendKey = keyMapping[dbKey] || dbKey;
      settingsObject[frontendKey] = setting.get('value');
    });

    // Obtener creditToEurRate dinámicamente desde el servicio
    const creditRate = await CreditCalculationService.getCreditToEurRate();
    settingsObject['creditToEurRate'] = String(creditRate);

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
      where: { key: key },
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
        key: setting.get('key'),
        value: setting.get('value'),
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
    
    console.log('🔍 Backend received settings:', settings);

    if (!settings || typeof settings !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid settings format',
      });
      return;
    }

    // Map frontend keys to database keys
    const keyMapping: Record<string, string> = {
      'commissionRate': 'marketplace_commission_rate',
      'swapFee': 'swap_fee',
      'creditConversionFee': 'credit_conversion_fee',
      'chargeSwapFeeToRequester': 'charge_swap_fee_to_requester',
      'chargeSwapFeeToResponder': 'charge_swap_fee_to_responder',
      'creditToEurRate': 'credit_to_eur_rate',
      'autoApproveGuests': 'auto_approve_guests',
      'autoApproveStaff': 'auto_approve_staff',
      'requireEmailVerification': 'require_email_verification',
      'emailNotifications': 'email_notifications',
      'bookingAlerts': 'booking_alerts',
      'systemAlerts': 'system_alerts',
      'maintenanceMode': 'maintenance_mode',
      'allowRegistrations': 'allow_registrations',
    };

    // Update or create each setting
    const promises = Object.entries(settings).map(async ([frontendKey, value]) => {
      const dbKey = keyMapping[frontendKey] || frontendKey;
      
      console.log(`💾 Saving: ${frontendKey} → ${dbKey} = ${value}`);
      
      const [setting, created] = await PlatformSetting.findOrCreate({
        where: { key: dbKey },
        defaults: {
          key: dbKey,
          value: String(value),
        },
      });

      if (!created) {
        await setting.update({ value: String(value) });
      }

      return setting;
    });

    await Promise.all(promises);
    
    console.log('✅ Settings saved successfully');

    // Fetch updated settings
    const updatedSettings = await PlatformSetting.findAll();
    const settingsObject: Record<string, string> = { ...DEFAULT_SETTINGS };
    updatedSettings.forEach((setting: any) => {
      settingsObject[setting.get('key')] = setting.get('value');
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
      where: { key: key },
      defaults: {
        key: key,
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
        key: setting.get('key'),
        value: setting.get('value'),
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
      where: { key: key },
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

/**
 * Get public swap fee (public endpoint - no authentication required)
 */
export const getSwapFee = async (req: Request, res: Response): Promise<void> => {
  try {
    const setting = await PlatformSetting.findOne({
      where: { key: 'swapFee' },
    });

    const swapFee = setting ? setting.get('value') : DEFAULT_SETTINGS.swapFee;

    res.json({
      success: true,
      swapFee: Number(swapFee) || Number(DEFAULT_SETTINGS.swapFee),
    });
  } catch (error: any) {
    console.error('Error fetching swap fee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch swap fee',
    });
  }
};
