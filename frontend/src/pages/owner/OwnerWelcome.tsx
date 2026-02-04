import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle, LogIn } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

export default function OwnerWelcome() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'validating' | 'valid' | 'invalid' | 'error'>('validating');
  const [invitationData, setInvitationData] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }

      try {
        // Decodificar el token JWT para obtener información básica
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          setStatus('invalid');
          return;
        }

        const payload = JSON.parse(atob(tokenParts[1]));
        
        // Verificar que no haya expirado
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          setStatus('invalid');
          toast.error('El link de invitación ha expirado');
          return;
        }

        setInvitationData(payload);
        setStatus('valid');
      } catch (error) {
        console.error('Error validating token:', error);
        setStatus('error');
      }
    };

    validateToken();
  }, [token]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsSettingPassword(true);
    try {
      // Llamar al endpoint para establecer contraseña con el token
      const { data } = await apiClient.post('/auth/complete-invitation', {
        token,
        password
      });

      toast.success('¡Cuenta activada exitosamente!');
      
      // Guardar el token de sesión
      localStorage.setItem('sw2_token', data.token);
      
      // Redirigir al dashboard del owner
      setTimeout(() => {
        navigate('/owner/dashboard');
      }, 1000);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al configurar contraseña');
    } finally {
      setIsSettingPassword(false);
    }
  };

  if (status === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Validando invitación...
          </h2>
          <p className="text-gray-600">Por favor espera un momento</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid' || status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Link inválido o expirado
          </h2>
          <p className="text-gray-600 mb-6">
            Este link de invitación no es válido o ha expirado. Por favor contacta al equipo de soporte.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Ir a inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Bienvenido!
          </h1>
          <p className="text-gray-600">
            Tu timeshare ha sido registrado exitosamente
          </p>
        </div>

        {invitationData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Email:</strong> {invitationData.email}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Configura tu contraseña para acceder a tu cuenta
            </p>
          </div>
        )}

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Contraseña *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Contraseña *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Repite tu contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={isSettingPassword}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            {isSettingPassword ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Activar Cuenta
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Ya tienes contraseña?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Inicia sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
