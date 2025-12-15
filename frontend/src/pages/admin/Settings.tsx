import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Settings as SettingsIcon, 
  DollarSign, 
  UserCheck, 
  Globe, 
  Bell, 
  Shield, 
  Mail,
  Save,
  RefreshCw,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as settingsApi from '@/api/settings';

export default function Settings() {
  const { t } = useTranslation();
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Commission Settings State
  const [commissionRate, setCommissionRate] = useState(10);
  const [swapFee, setSwapFee] = useState(25);
  const [creditConversionFee, setCreditConversionFee] = useState(5);
  
  // Auto-Approval Settings State
  const [autoApproveGuests, setAutoApproveGuests] = useState(false);
  const [autoApproveStaff, setAutoApproveStaff] = useState(false);
  const [requireEmailVerification, setRequireEmailVerification] = useState(true);
  
  // Notification Settings State
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bookingAlerts, setBookingAlerts] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  
  // System Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegistrations, setAllowRegistrations] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await settingsApi.getAllSettings();
      
      // Update state with loaded settings
      setCommissionRate(Number(settings.commissionRate) || 10);
      setSwapFee(Number(settings.swapFee) || 25);
      setCreditConversionFee(Number(settings.creditConversionFee) || 5);
      setAutoApproveGuests(settings.autoApproveGuests === 'true');
      setAutoApproveStaff(settings.autoApproveStaff === 'true');
      setRequireEmailVerification(settings.requireEmailVerification === 'true');
      setEmailNotifications(settings.emailNotifications === 'true');
      setBookingAlerts(settings.bookingAlerts === 'true');
      setSystemAlerts(settings.systemAlerts === 'true');
      setMaintenanceMode(settings.maintenanceMode === 'true');
      setAllowRegistrations(settings.allowRegistrations === 'true');
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast.error(error.response?.data?.error || t('admin.settings.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCommission = async () => {
    try {
      setIsSaving(true);
      await settingsApi.updateSettings({
        commissionRate: String(commissionRate),
        swapFee: String(swapFee),
        creditConversionFee: String(creditConversionFee),
      });
      toast.success(t('admin.settings.settingsSaved'));
    } catch (error: any) {
      console.error('Error saving commission settings:', error);
      toast.error(error.response?.data?.error || t('admin.settings.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAutoApproval = async () => {
    try {
      setIsSaving(true);
      await settingsApi.updateSettings({
        autoApproveGuests: String(autoApproveGuests),
        autoApproveStaff: String(autoApproveStaff),
        requireEmailVerification: String(requireEmailVerification),
      });
      toast.success(t('admin.settings.settingsSaved'));
    } catch (error: any) {
      console.error('Error saving auto-approval settings:', error);
      toast.error(error.response?.data?.error || t('admin.settings.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true);
      await settingsApi.updateSettings({
        emailNotifications: String(emailNotifications),
        bookingAlerts: String(bookingAlerts),
        systemAlerts: String(systemAlerts),
      });
      toast.success(t('admin.settings.settingsSaved'));
    } catch (error: any) {
      console.error('Error saving notification settings:', error);
      toast.error(error.response?.data?.error || t('admin.settings.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSystem = async () => {
    try {
      setIsSaving(true);
      await settingsApi.updateSettings({
        maintenanceMode: String(maintenanceMode),
        allowRegistrations: String(allowRegistrations),
      });
      toast.success(t('admin.settings.settingsSaved'));
    } catch (error: any) {
      console.error('Error saving system settings:', error);
      toast.error(error.response?.data?.error || t('admin.settings.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm(t('admin.settings.confirmReset'))) {
      return;
    }

    try {
      setIsLoading(true);
      await settingsApi.resetSettings();
      toast.success(t('admin.settings.settingsReset'));
      await loadSettings();
    } catch (error: any) {
      console.error('Error resetting settings:', error);
      toast.error(error.response?.data?.error || t('admin.settings.failedToReset'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.settings.title')}</h1>
          <p className="text-gray-600 mt-1">{t('admin.settings.subtitle')}</p>
        </div>
        <button
          onClick={handleResetSettings}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t('admin.settings.resetToDefaults')}
        </button>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Commission Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('admin.settings.commissionSettings')}</h2>
              <p className="text-sm text-gray-600">{t('admin.settings.commissionDesc')}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Platform Commission */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.settings.platformCommission')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('admin.settings.commissionHelp')}</p>
            </div>

            {/* Swap Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.settings.swapFee')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  value={swapFee}
                  onChange={(e) => setSwapFee(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('admin.settings.swapFeeHelp')}</p>
            </div>

            {/* Credit Conversion Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.settings.creditConversionFee')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={creditConversionFee}
                  onChange={(e) => setCreditConversionFee(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute right-3 top-2 text-gray-500">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('admin.settings.creditConversionHelp')}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveCommission}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

        {/* Auto-Approval Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('admin.settings.autoApprovalSettings')}</h2>
              <p className="text-sm text-gray-600">{t('admin.settings.autoApprovalDesc')}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Auto-approve Guests */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.autoApproveGuests')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.autoApproveGuestsDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={autoApproveGuests}
                  onChange={(e) => setAutoApproveGuests(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Auto-approve Staff */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.autoApproveStaff')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.autoApproveStaffDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={autoApproveStaff}
                  onChange={(e) => setAutoApproveStaff(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Require Email Verification */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.requireEmailVerification')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.requireEmailVerificationDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={requireEmailVerification}
                  onChange={(e) => setRequireEmailVerification(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveAutoApproval}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bell className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('admin.settings.notificationSettings')}</h2>
              <p className="text-sm text-gray-600">{t('admin.settings.notificationDesc')}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Email Notifications */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.emailNotifications')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.emailNotificationsDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Booking Alerts */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.bookingAlerts')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.bookingAlertsDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={bookingAlerts}
                  onChange={(e) => setBookingAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* System Alerts */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.systemAlerts')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.systemAlertsDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={systemAlerts}
                  onChange={(e) => setSystemAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveNotifications}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('admin.settings.systemSettings')}</h2>
              <p className="text-sm text-gray-600">{t('admin.settings.systemDesc')}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Maintenance Mode */}
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.maintenanceMode')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.maintenanceModeDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Allow Registrations */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{t('admin.settings.allowRegistrations')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('admin.settings.allowRegistrationsDesc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={allowRegistrations}
                  onChange={(e) => setAllowRegistrations(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveSystem}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
