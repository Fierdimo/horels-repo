import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Middleware que valida que el usuario autenticado tenga el rol 'owner'
 * 
 * Este middleware debe usarse DESPUÉS de authenticateToken en endpoints de timeshare
 * que solo deberían ser accesibles por propietarios (owners) con semanas asignadas.
 * 
 * Casos de uso:
 * - Ver/confirmar semanas propias (GET/POST /timeshare/weeks)
 * - Crear/gestionar swaps (POST/GET /timeshare/swaps)
 * - Convertir semanas a créditos (POST /timeshare/weeks/:id/convert)
 * - Ver/usar créditos nocturnos (GET/POST /timeshare/night-credits)
 * 
 * Nota: Los usuarios con rol 'guest' que intenten acceder recibirán un mensaje
 * explicando que deben poseer semanas de timeshare para convertirse en owners.
 */
export const requireOwnerRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verificar que el usuario tenga el rol 'owner'
    const userRole = user.Role?.name;
    
    if (userRole !== 'owner') {
      return res.status(403).json({ 
        error: 'Owner role required',
        message: 'This feature is only available to timeshare owners. You must own at least one week to access timeshare features.',
        currentRole: userRole,
        hint: 'Purchase or receive a timeshare week to be automatically upgraded to owner status.'
      });
    }

    next();
  } catch (error) {
    console.error('Owner role validation error:', error);
    return res.status(500).json({ error: 'Role validation failed' });
  }
};
