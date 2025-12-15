/**
 * Room Synchronization Service
 * 
 * Sincroniza habitaciones desde el PMS (Mews) hacia la base de datos local
 * Mantiene coherencia entre el inventario del PMS y el marketplace
 */

import Room from '../models/room';
import Property from '../models/Property';
import { PMSFactory } from './pms/PMSFactory';

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  rooms?: any[];
}

interface PMSResource {
  Id: string;
  Name: string;
  ServiceId?: string;
  IsActive?: boolean;
  FloorNumber?: string;
  Capacity?: number;
  Description?: string;
  Data?: any;
}

export class RoomSyncService {
  /**
   * Sincroniza habitaciones desde el PMS para una propiedad específica
   */
  async syncRoomsFromPMS(propertyId: number): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      created: 0,
      updated: 0,
      errors: [],
      rooms: []
    };

    try {
      // 1. Obtener property y verificar configuración PMS
      const property = await Property.findByPk(propertyId);
      if (!property) {
        result.errors.push('Property not found');
        return result;
      }

      if (!property.pms_provider || !property.pms_credentials) {
        result.errors.push('PMS not configured for this property');
        return result;
      }

      // 2. Obtener instancia PMS
      const pmsService = await PMSFactory.getAdapter(propertyId);

      // 3. Obtener recursos (habitaciones) del PMS
      // getAvailability retorna tanto resources como services
      const availability = await pmsService.getAvailability({});
      const resources: PMSResource[] = availability?.resources || [];
      const services = availability?.services || [];

      if (resources.length === 0) {
        result.errors.push('No resources found in PMS');
        return result;
      }

      // 4. Crear mapa de services por ID
      const servicesMap = new Map(services.map((s: any) => [s.Id, s]));

      // 5. Sincronizar cada recurso
      for (const resource of resources) {
        try {
          // Saltar recursos inactivos
          if (resource.IsActive === false) {
            continue;
          }

          // Obtener información del service asociado
          const service: any = resource.ServiceId ? servicesMap.get(resource.ServiceId) : null;

          // Buscar si ya existe en DB
          const existingRoom = await Room.findOne({
            where: {
              propertyId,
              pmsResourceId: resource.Id
            }
          });

          // Preparar datos de habitación
          const roomData: any = {
            name: resource.Name || `Room ${resource.Id.substring(0, 8)}`,
            description: resource.Description || service?.Name || '',
            capacity: resource.Capacity || 2,
            type: service?.Name || 'Standard',
            floor: resource.FloorNumber?.toString() || undefined,
            status: 'available',
            propertyId,
            pmsResourceId: resource.Id,
            pmsLastSync: new Date(),
            // Precio base desde el service si está disponible
            basePrice: service?.DefaultPrice || null,
            // Por defecto NO habilitar en marketplace (staff decide después)
            isMarketplaceEnabled: false,
          };

          if (existingRoom) {
            // Actualizar habitación existente
            await existingRoom.update(roomData);
            result.updated++;
            result.rooms?.push(existingRoom);
          } else {
            // Crear nueva habitación
            const newRoom = await Room.create(roomData);
            result.created++;
            result.rooms?.push(newRoom);
          }
        } catch (error: any) {
          result.errors.push(`Error syncing resource ${resource.Id}: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0 || (result.created + result.updated) > 0;
      return result;

    } catch (error: any) {
      result.errors.push(`Sync failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Actualiza el estado de disponibilidad de una habitación basado en bookings
   */
  async updateRoomStatus(roomId: number): Promise<void> {
    const room = await Room.findByPk(roomId);
    if (!room) return;

    // TODO: Implementar lógica para determinar estado basado en bookings activas
    // Por ahora mantener el estado actual
    // En el futuro: consultar bookings activas y cambiar a 'ocupada' si aplica
  }

  /**
   * Verifica disponibilidad de habitación en fechas específicas
   */
  async checkRoomAvailability(
    roomId: number, 
    checkIn: Date, 
    checkOut: Date
  ): Promise<boolean> {
    // TODO: Consultar tabla de bookings
    // Verificar si hay bookings que se solapen con las fechas
    const room = await Room.findByPk(roomId);
    if (!room) return false;
    
    // Por ahora retornar basado en estado
    return room.status === 'activa';
  }

  /**
   * Actualiza precios desde el PMS
   * TODO: Implementar cuando se defina el mapeo de rates a rooms
   */
  async syncPrices(propertyId: number): Promise<void> {
    const property = await Property.findByPk(propertyId);
    if (!property?.pms_provider) return;

    const pmsService = await PMSFactory.getAdapter(propertyId);

    // Obtener availability que incluye pricing info
    const availability = await pmsService.getAvailability({});
    
    // TODO: Mapear pricing info a habitaciones
    // Esto requiere conocer la relación entre rates y resources en el PMS
    console.log('syncPrices not yet fully implemented');
  }
}

export default new RoomSyncService();
