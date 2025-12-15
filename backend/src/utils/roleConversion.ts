import { User, Role, Week } from '../models';

/**
 * Convierte automáticamente un guest a owner cuando recibe su primera semana
 * 
 * @param userId - ID del usuario a verificar
 * @returns true si se realizó la conversión, false si no fue necesaria
 */
export async function autoConvertGuestToOwner(userId: number): Promise<boolean> {
  try {
    // Obtener usuario con su rol
    const user = await User.findByPk(userId, {
      include: [{ model: Role }]
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const userRole = (user as any).Role?.name;

    // Solo convertir si es guest
    if (userRole !== 'guest') {
      return false;
    }

    // Verificar si tiene al menos una semana
    const weekCount = await Week.count({
      where: { owner_id: userId }
    });

    if (weekCount === 0) {
      return false; // No tiene semanas, no convertir
    }

    // Convertir a owner
    const ownerRole = await Role.findOne({ where: { name: 'owner' } });
    
    if (!ownerRole) {
      throw new Error('Owner role not found in database');
    }

    await user.update({ role_id: ownerRole.id });

    console.log(`[RoleConversion] User ${userId} (${user.email}) converted from guest to owner (has ${weekCount} week(s))`);

    return true;
  } catch (error) {
    console.error(`[RoleConversion] Error converting user ${userId}:`, error);
    throw error;
  }
}

/**
 * Middleware para convertir automáticamente guest a owner después de asignar semanas
 * Usar después de crear/asignar semanas en endpoints
 */
export async function checkAndConvertToOwner(userId: number): Promise<void> {
  try {
    await autoConvertGuestToOwner(userId);
  } catch (error) {
    // Log pero no fallar la operación principal
    console.error('[RoleConversion] Auto-conversion failed but continuing:', error);
  }
}

/**
 * Validar que un usuario es owner (tiene al menos una semana)
 * 
 * @param userId - ID del usuario
 * @returns true si es owner con semanas, false en caso contrario
 */
export async function validateOwnerWithWeeks(userId: number): Promise<boolean> {
  const user = await User.findByPk(userId, {
    include: [{ model: Role }]
  });

  if (!user) {
    return false;
  }

  const userRole = (user as any).Role?.name;
  
  if (userRole !== 'owner') {
    return false;
  }

  const weekCount = await Week.count({
    where: { owner_id: userId }
  });

  return weekCount > 0;
}
