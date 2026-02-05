import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  UserPlus, AlertCircle, CheckCircle, User, Building2, 
  Calendar, DollarSign, FileText, Loader2, Copy, X, Mail, Link2, QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import WeekPicker from '@/components/WeekPicker';

interface EmailStatus {
  exists: boolean;
  role?: string;
  name?: string;
  scenario?: 'new_user' | 'guest_converted' | 'existing_owner';
}

interface RegistrationResult {
  success: boolean;
  scenario: string;
  temporary_password?: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
  ownership: any;
  email_sent?: any;
}

export default function RegisterOwnership() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  // Form state
  const [formData, setFormData] = useState({
    owner_email: '',
    owner_first_name: '',
    owner_last_name: '',
    owner_phone: '',
    unit_id: '',
    type: 'FIXED_WEEK',
    fixed_week_number: '',

    purchase_date: '',
    contract_start_year: new Date().getFullYear().toString(),
    contract_end_year: '',
    notes: ''
  });

  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [isGeneratingInvitation, setIsGeneratingInvitation] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Fetch units for dropdown
  const { data: unitsData } = useQuery({
    queryKey: ['staff-timeshare-units'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hotel-staff/inventory/units');
      return data;
    }
  });

  const units = unitsData?.data || [];

  // Fetch occupied weeks for selected unit
  const { data: occupiedWeeksData } = useQuery({
    queryKey: ['unit-occupied-weeks', formData.unit_id],
    queryFn: async () => {
      if (!formData.unit_id) return { data: [] };
      const { data } = await apiClient.get(`/hotel-staff/inventory/units/${formData.unit_id}/occupied-weeks`);
      return data;
    },
    enabled: !!formData.unit_id
  });

  const occupiedWeeksInfo = occupiedWeeksData?.data || [];
  const totalUnits = occupiedWeeksData?.total_units || 1;
  
  // Solo deshabilitar semanas que están 100% llenas
  const occupiedWeeks = occupiedWeeksInfo
    .filter((item: any) => item.is_fully_occupied)
    .map((item: any) => item.week_number);

  // Auto-generate invitation when modal opens
  useEffect(() => {
    const generateInvitationAutomatically = async () => {
      if (showInvitationModal && registrationResult?.ownership?.id && !invitationData) {
        setIsGeneratingInvitation(true);
        try {
          const { data } = await apiClient.post(
            `/hotel-staff/ownerships/${registrationResult.ownership.id}/generate-invitation`
          );
          setInvitationData(data.data);
        } catch (error: any) {
          toast.error(error.response?.data?.error || t('staff.registerTimeshare.invitationGenerationError'));
        } finally {
          setIsGeneratingInvitation(false);
        }
      }
    };

    generateInvitationAutomatically();
  }, [showInvitationModal, registrationResult, invitationData]);

  // Check email status (debounced)
  useEffect(() => {
    const checkEmail = async () => {
      if (!formData.owner_email || formData.owner_email.length < 5) {
        setEmailStatus(null);
        return;
      }

      setIsCheckingEmail(true);
      try {
        const { data } = await apiClient.get('/hotel-staff/users/check-email', {
          params: { email: formData.owner_email }
        });
        setEmailStatus(data.data);
      } catch (error) {
        console.error('Error checking email:', error);
        setEmailStatus(null);
      } finally {
        setIsCheckingEmail(false);
      }
    };

    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [formData.owner_email]);

  // Register ownership mutation
  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/hotel-staff/ownerships/register', data);
      return response.data;
    },
    onSuccess: (result: RegistrationResult) => {
      toast.success(t('staff.registerTimeshare.registrationSuccess'));
      
      setRegistrationResult(result);
      // Ir directo al modal de invitación (sin mostrar contraseña temporal)
      setShowInvitationModal(true);

      // Reset form
      setFormData({
        owner_email: '',
        owner_first_name: '',
        owner_last_name: '',
        owner_phone: '',
        unit_id: '',
        type: 'FIXED_WEEK',
        fixed_week_number: '',
        purchase_date: '',
        contract_start_year: new Date().getFullYear().toString(),
        contract_end_year: '',
        notes: ''
      });
      setEmailStatus(null);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['staff-ownerships'] });
      queryClient.invalidateQueries({ queryKey: ['staff-inventory-weeks'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || t('staff.registerTimeshare.registrationError');
      toast.error(message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.owner_email) {
      toast.error(t('staff.registerTimeshare.emailRequired'));
      return;
    }

    if (!emailStatus?.exists && (!formData.owner_first_name || !formData.owner_last_name)) {
      toast.error(t('staff.registerTimeshare.nameRequired'));
      return;
    }

    if (!formData.unit_id) {
      toast.error(t('staff.registerTimeshare.unitRequired'));
      return;
    }

    if (formData.type === 'FIXED_WEEK' && !formData.fixed_week_number) {
      toast.error(t('staff.registerTimeshare.weekRequired'));
      return;
    }

    // Submit
    registerMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateInvitation = async () => {
    if (!registrationResult?.ownership?.id) return;
    
    setIsGeneratingInvitation(true);
    try {
      const { data } = await apiClient.post(
        `/hotel-staff/ownerships/${registrationResult.ownership.id}/generate-invitation`
      );
      setInvitationData(data.data);
      toast.success('¡Invitación generada!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al generar invitación');
    } finally {
      setIsGeneratingInvitation(false);
    }
  };

  const handleCopyLink = () => {
    if (invitationData?.invitationLink) {
      navigator.clipboard.writeText(invitationData.invitationLink);
      toast.success(t('staff.registerTimeshare.linkCopied'));
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('invitation-qr');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');

      const downloadLink = document.createElement('a');
      downloadLink.download = 'invitation-qr.png';
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success(t('staff.registerTimeshare.qrDownloaded'));
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSendInvitationEmail = async () => {
    if (!registrationResult?.ownership?.id) return;
    
    setIsSendingEmail(true);
    try {
      await apiClient.post(
        `/hotel-staff/ownerships/${registrationResult.ownership.id}/send-invitation-email`
      );
      toast.success(t('staff.registerTimeshare.emailSentSuccess'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('staff.registerTimeshare.emailSendError'));
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getScenarioBadge = () => {
    if (!emailStatus) return null;

    if (isCheckingEmail) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('staff.registerTimeshare.verifying')}
        </div>
      );
    }

    if (emailStatus.scenario === 'new_user') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full">
          <UserPlus className="h-3 w-3" />
          {t('staff.registerTimeshare.newUser')}
        </div>
      );
    }

    if (emailStatus.scenario === 'guest_converted') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full">
          <CheckCircle className="h-3 w-3" />
          {t('staff.registerTimeshare.guestConverted')}
        </div>
      );
    }

    if (emailStatus.scenario === 'existing_owner') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded-full">
          <User className="h-3 w-3" />
          {t('staff.registerTimeshare.existingOwner')}
        </div>
      );
    }

    return null;
  };

  const requiresUserInfo = !emailStatus?.exists;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-blue-600" />
            {t('staff.registerTimeshare.title')}
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            {t('staff.registerTimeshare.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna Izquierda */}
          <div className="space-y-6">
            {/* Email Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                {t('staff.registerTimeshare.clientData')}
              </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.registerTimeshare.clientEmail')} *
                </label>
                <input
                  type="email"
                  name="owner_email"
                  value={formData.owner_email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('staff.registerTimeshare.clientEmailPlaceholder')}
                />
                <div className="mt-2">
                  {getScenarioBadge()}
                </div>
                {emailStatus?.exists && emailStatus.name && (
                  <p className="mt-1 text-sm text-gray-600">
                    {t('staff.registerTimeshare.userFound')}: <strong>{emailStatus.name}</strong> ({emailStatus.role})
                  </p>
                )}
              </div>

              {requiresUserInfo && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('staff.registerTimeshare.firstName')} *
                    </label>
                    <input
                      type="text"
                      name="owner_first_name"
                      value={formData.owner_first_name}
                      onChange={handleChange}
                      required={requiresUserInfo}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder={t('staff.registerTimeshare.firstNamePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('staff.registerTimeshare.lastName')} *
                    </label>
                    <input
                      type="text"
                      name="owner_last_name"
                      value={formData.owner_last_name}
                      onChange={handleChange}
                      required={requiresUserInfo}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder={t('staff.registerTimeshare.lastNamePlaceholder')}
                    />
                  </div>
                </>
              )}

              {/* Teléfono - Siempre opcional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('staff.registerTimeshare.phone')} <span className="text-gray-400 text-xs">{t('staff.registerTimeshare.optional')}</span>
                </label>
                <input
                  type="tel"
                  name="owner_phone"
                  value={formData.owner_phone}
                  onChange={handleChange}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('staff.registerTimeshare.phonePlaceholder')}
                />
              </div>
            </div>
            </div>

            {/* Datos del Contrato - Solo para usuario nuevo o guest */}
            {(!emailStatus?.exists || emailStatus?.scenario === 'guest_converted') && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  {t('staff.registerTimeshare.contractData')}
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t('staff.registerTimeshare.signatureDate')} <span className="text-gray-400 text-xs">{t('staff.registerTimeshare.optional')}</span>
                    </label>
                    <input
                      type="date"
                      name="purchase_date"
                      value={formData.purchase_date}
                      onChange={handleChange}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('staff.registerTimeshare.validFrom')} *
                      </label>
                      <input
                        type="number"
                        name="contract_start_year"
                        value={formData.contract_start_year}
                        onChange={handleChange}
                        min="2020"
                        max="2050"
                        required
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('staff.registerTimeshare.validUntil')} <span className="text-gray-400 text-xs">{t('staff.registerTimeshare.optional')}</span>
                    </label>
                    <input
                      type="number"
                      name="contract_end_year"
                      value={formData.contract_end_year}
                      onChange={handleChange}
                      min={parseInt(formData.contract_start_year) + 1}
                      max="2100"
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder={t('staff.registerTimeshare.validUntilPlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('staff.registerTimeshare.notes')} <span className="text-gray-400 text-xs">{t('staff.registerTimeshare.optional')}</span>
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder={t('staff.registerTimeshare.notesPlaceholder')}
                  />
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Columna Derecha */}
          <div className="space-y-6">
            {/* Timeshare Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              {t('staff.registerTimeshare.timeshareData')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('staff.registerTimeshare.unit')} *
                </label>
                <select
                  name="unit_id"
                  value={formData.unit_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">{t('staff.registerTimeshare.selectUnit')}</option>
                  {units.map((unit: any) => (
                    <option key={unit.id} value={unit.id}>
                      {t('staff.registerTimeshare.unitDescription', { 
                        category: unit.category, 
                        min: unit.capacity_min, 
                        max: unit.capacity_max, 
                        quantity: unit.quantity 
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('staff.registerTimeshare.assignedWeek')} *
                </label>
                {!formData.unit_id && (
                  <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    {t('staff.registerTimeshare.selectUnitFirst')}
                  </div>
                )}
                {formData.unit_id && (
                  <WeekPicker
                    selectedWeek={formData.fixed_week_number ? parseInt(formData.fixed_week_number) : null}
                    onSelectWeek={(weekNumber) => {
                      setFormData({ ...formData, fixed_week_number: weekNumber.toString() });
                    }}
                    year={parseInt(formData.contract_start_year) || new Date().getFullYear()}
                    disabledWeeks={occupiedWeeks}
                    occupiedWeeksInfo={occupiedWeeksInfo}
                    totalUnits={totalUnits}
                  />
                )}
                {formData.unit_id && occupiedWeeksInfo.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 bg-yellow-50 border-2 border-yellow-300 rounded"></div>
                      <span className="text-gray-600">{t('staff.registerTimeshare.partiallyOccupied')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 bg-gray-100 border-2 border-gray-300 rounded"></div>
                      <span className="text-gray-600">{t('staff.registerTimeshare.fullyOccupied')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Actions - Full Width */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('staff.registerTimeshare.requiredFields')}
              </div>
              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-medium shadow-sm"
              >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('staff.registerTimeshare.registering')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  {t('staff.registerTimeshare.registerButton')}
                </>
              )}
            </button>
            </div>
          </div>
        </form>
      </div>

      {/* Temporary Password Modal */}
      {showPasswordModal && registrationResult?.temporary_password && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('staff.registerTimeshare.successModalTitle')}
                </h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 mb-2">
                  {t('staff.registerTimeshare.newUserCreated')}: <strong>{registrationResult.user.email}</strong>
                </p>
                <p className="text-xs text-green-700">
                  {t('staff.registerTimeshare.accessInstructions')}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-900 mb-2">
                  {t('staff.registerTimeshare.temporaryPassword')}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <code className="flex-1 bg-yellow-100 px-3 py-2 rounded border border-yellow-300 text-lg font-mono text-yellow-900">
                    {registrationResult.temporary_password}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(registrationResult.temporary_password!);
                      toast.success(t('staff.registerTimeshare.passwordCopied'));
                    }}
                    className="p-2 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 text-yellow-700"
                    title={t('staff.registerTimeshare.copyPassword')}
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-yellow-800">
                  {t('staff.registerTimeshare.passwordWarning')}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-700">
                  <strong>Nota:</strong> {t('staff.registerTimeshare.passwordNote')}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setShowInvitationModal(true);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {t('staff.registerTimeshare.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitation Modal */}
      {showInvitationModal && registrationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">
                  {t('staff.registerTimeshare.invitationModalTitle')}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowInvitationModal(false);
                  setInvitationData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  {t('staff.registerTimeshare.owner')}: <strong>{registrationResult.user.email}</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {t('staff.registerTimeshare.shareInstructions')}
                </p>
              </div>

              {isGeneratingInvitation ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">{t('staff.registerTimeshare.generatingInvitation')}</p>
                </div>
              ) : invitationData ? (
                <div className="space-y-4">
                  {/* Send Email Button - Prominent */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="h-6 w-6 text-blue-600" />
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {t('staff.registerTimeshare.sendEmailButton')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {t('staff.registerTimeshare.sendEmailDescription')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSendInvitationEmail}
                      disabled={isSendingEmail}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium shadow-sm"
                    >
                      {isSendingEmail ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {t('staff.registerTimeshare.sending')}
                        </>
                      ) : (
                        <>
                          <Mail className="h-5 w-5" />
                          {t('staff.registerTimeshare.sendInvitationEmail')}
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">{t('staff.registerTimeshare.orShareManually')}</span>
                    </div>
                  </div>

                  {/* Link Section */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="h-4 w-4 text-gray-600" />
                      <p className="text-sm font-medium text-gray-900">
                        {t('staff.registerTimeshare.invitationLink')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={invitationData.invitationLink}
                        readOnly
                        className="flex-1 bg-white px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 font-mono"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        title={t('staff.registerTimeshare.copyLink')}
                      >
                        <Copy className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* QR Code Section */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <QrCode className="h-4 w-4 text-gray-600" />
                      <p className="text-sm font-medium text-gray-900">
                        {t('staff.registerTimeshare.qrCode')}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
                        <QRCodeSVG
                          id="invitation-qr"
                          value={invitationData.invitationLink}
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <button
                        onClick={handleDownloadQR}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        {t('staff.registerTimeshare.downloadQR')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-200 p-4 flex-shrink-0">
              <button
                onClick={() => {
                  setShowInvitationModal(false);
                  setInvitationData(null);
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                disabled={isGeneratingInvitation}
              >
                {t('staff.registerTimeshare.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
