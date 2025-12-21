/**
 * Room Synchronization Service
 * 
 * REFERENCE ONLY Architecture:
 * Solo guarda el mapeo entre PMS y BD local (pms_resource_id).
 * Los datos de habitaciones (name, capacity, type, etc) se obtienen del PMS en tiempo real.
 * Ver roomEnrichmentService para enriquecimiento de datos.
 */

import Room from '../models/room';
import Property from '../models/Property';
import { PMSFactory } from './pms/PMSFactory';

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  errors: string[];
  summary?: string;
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
   * Sincroniza habitaciones desde el PMS para una propiedad específica.
   * Solo guarda el mapeo y datos complementarios, NO data del PMS.
   */
  async syncRoomsFromPMS(propertyId: number): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      created: 0,
      updated: 0,
      errors: [],
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
      const availability = await pmsService.getAvailability({});
      const resources: PMSResource[] = availability?.resources || [];

      if (resources.length === 0) {
        result.errors.push('No resources found in PMS');
        return result;
      }

      // 4. Sincronizar mapeos
      // Solo guardamos: pms_resource_id, property_id, y metadata local
      for (const resource of resources) {
        try {
          // Saltar recursos inactivos
          if (resource.IsActive === false) {
            continue;
          }

          // Buscar si ya existe el mapeo en BD
          const existingRoom = await Room.findOne({
            where: {
              propertyId,
              pmsResourceId: resource.Id
            }
          });

          // Solo guardar: mapeo + metadata local
          const roomData = {
            propertyId,
            pmsResourceId: resource.Id,
            pmsLastSync: new Date(),
            // Defaults para datos locales
            isMarketplaceEnabled: false, // Staff debe activar explícitamente
            // No guardar: name, capacity, floor, type, status, basePrice, amenities
            // Esos datos vienen del PMS en tiempo real
          };

          if (existingRoom) {
            // Solo actualizar pmsLastSync
            await existingRoom.update({
              pmsLastSync: new Date()
            });
            result.updated++;
          } else {
            // Crear nuevo mapeo
            await Room.create(roomData);
            result.created++;
          }
        } catch (error: any) {
          result.errors.push(`Error syncing resource ${resource.Id}: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0 || (result.created + result.updated) > 0;
      result.summary = `Sync complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`;
      
      return result;

    } catch (error: any) {
      result.errors.push(`Sync failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Marca una habitación como sincronizada
   * Se usa internamente cuando se obtiene data del PMS
   */
  async markAsSynced(roomId: number): Promise<void> {
    await Room.update(
      { pmsLastSync: new Date() },
      { where: { id: roomId } }
    );
  }

  /**
   * Obtiene habitaciones no sincronizadas recientemente (+ de X minutos)
   */
  async getStaleRooms(propertyId: number, thresholdMinutes: number = 60): Promise<Room[]> {
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    return Room.findAll({
      where: {
        propertyId,
        pmsLastSync: { $lt: thresholdTime } // Sequelize syntax
      }
    });
  }
}

