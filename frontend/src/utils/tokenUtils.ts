/**
 * Decodifica un JWT token sin validar la firma
 * Nota: Solo extrae el payload, no valida la autenticidad
 */
export function decodeToken(token: string): any {
  try {
    // Un JWT tiene 3 partes separadas por puntos: header.payload.signature
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decodificar el payload (segunda parte)
    const decoded = atob(parts[1]);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Extrae información del usuario del JWT
 */
export function extractUserFromToken(token: string) {
  const decoded = decodeToken(token);
  
  if (!decoded) {
    return null;
  }

  const user = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    status: decoded.status,
    property_id: decoded.property_id || null
  };

  return user;
}
