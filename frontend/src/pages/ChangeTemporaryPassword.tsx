import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';

export default function ChangeTemporaryPassword() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) {
      return false;
    }
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Contraseña actual es requerida';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'Nueva contraseña es requerida';
    } else if (!validatePassword(formData.newPassword)) {
      newErrors.newPassword = 'La contraseña debe tener al menos 8 caracteres';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmar contraseña es requerida';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
    }

    if (newErrors.currentPassword || newErrors.newPassword || newErrors.confirmPassword) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/auth/change-temporary-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      toast.success('¡Contraseña cambiada exitosamente!');
      
      // Refresh user data to update must_change_password flag
      await refreshUser();

      // Redirect based on role
      if (user?.role === 'owner') {
        navigate('/owner/dashboard');
      } else if (user?.role === 'staff') {
        navigate('/staff/dashboard');
      } else if (user?.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Error al cambiar contraseña';
      toast.error(message);
      if (message.includes('incorrect')) {
        setErrors(prev => ({ ...prev, currentPassword: 'Contraseña actual incorrecta' }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <Lock className="h-8 w-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Cambiar Contraseña Temporal
          </h1>
          <p className="text-gray-600 mt-2">
            Por seguridad, debes cambiar tu contraseña temporal antes de continuar
          </p>
        </div>

        {/* Alert */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Contraseña temporal detectada</p>
            <p className="text-yellow-700">
              Esta es tu primera vez iniciando sesión. Debes establecer una contraseña personal.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña Temporal
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className={`w-full rounded-md border ${
                  errors.currentPassword ? 'border-red-300' : 'border-gray-300'
                } shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10`}
                placeholder="Ingresa tu contraseña temporal"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className={`w-full rounded-md border ${
                  errors.newPassword ? 'border-red-300' : 'border-gray-300'
                } shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10`}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
            )}
            {formData.newPassword && !errors.newPassword && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Contraseña válida</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full rounded-md border ${
                  errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                } shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10`}
                placeholder="Repite tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
            )}
            {formData.confirmPassword && !errors.confirmPassword && formData.newPassword === formData.confirmPassword && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Las contraseñas coinciden</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cambiando contraseña...' : 'Cambiar Contraseña'}
          </button>
        </form>

        {/* Security Tips */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-700 mb-2">Consejos de seguridad:</p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Usa al menos 8 caracteres</li>
            <li>• Combina letras, números y símbolos</li>
            <li>• No uses la misma contraseña en otros sitios</li>
            <li>• Guarda tu contraseña en un lugar seguro</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
