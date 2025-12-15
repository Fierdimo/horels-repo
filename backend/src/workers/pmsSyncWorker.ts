import { Property, PMSSyncLog } from '../models';
import { PMSFactory } from '../services/pms/PMSFactory';
import { decryptPMSCredentials } from '../utils/pmsEncryption';
import { Op } from 'sequelize';

export interface SyncOptions {
  syncType?: 'availability' | 'bookings' | 'prices' | 'full';
  forceSync?: boolean; // Ignorar last_sync y forzar sincronización
  propertyIds?: number[]; // Sincronizar solo properties específicas
}

export class PMSSyncWorker {
  private isRunning: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  
  // Intervalo de sincronización en milisegundos (default: 30 minutos)
  private readonly DEFAULT_SYNC_INTERVAL = 30 * 60 * 1000;
  
  // Tiempo mínimo entre sincronizaciones por property (default: 10 minutos)
  private readonly MIN_SYNC_INTERVAL = 10 * 60 * 1000;

  /**
   * Iniciar worker de sincronización periódica
   */
  start(intervalMs: number = this.DEFAULT_SYNC_INTERVAL): void {
    if (this.isRunning) {
      console.log('PMSSyncWorker already running');
      return;
    }

    this.isRunning = true;
    console.log(`PMSSyncWorker started with interval: ${intervalMs}ms`);

    // Ejecutar inmediatamente
    this.syncAll().catch(error => {
      console.error('Error in initial sync:', error);
    });

    // Programar ejecuciones periódicas
    this.syncInterval = setInterval(() => {
      this.syncAll().catch(error => {
        console.error('Error in periodic sync:', error);
      });
    }, intervalMs);
  }

  /**
   * Detener worker de sincronización
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('PMSSyncWorker stopped');
  }

  /**
   * Sincronizar todas las properties habilitadas
   */
  async syncAll(options: SyncOptions = {}): Promise<void> {
    try {
      const { syncType = 'full', forceSync = false, propertyIds } = options;

      console.log(`[PMSSyncWorker] Starting sync - type: ${syncType}, force: ${forceSync}`);

      // Buscar properties con sincronización habilitada
      const where: any = {
        pms_sync_enabled: true,
        pms_provider: { [Op.ne]: 'none' },
        pms_credentials: { [Op.ne]: null }
      };

      // Filtrar por IDs específicas si se proporcionan
      if (propertyIds && propertyIds.length > 0) {
        where.id = { [Op.in]: propertyIds };
      }

      // Si no es forzado, solo sincronizar properties que no se hayan sincronizado recientemente
      if (!forceSync) {
        where[Op.or] = [
          { pms_last_sync: null },
          { 
            pms_last_sync: { 
              [Op.lt]: new Date(Date.now() - this.MIN_SYNC_INTERVAL) 
            } 
          }
        ];
      }

      const properties = await Property.findAll({ where });

      console.log(`[PMSSyncWorker] Found ${properties.length} properties to sync`);

      // Sincronizar cada property
      const results = await Promise.allSettled(
        properties.map(property => this.syncProperty(property, syncType))
      );

      // Resumen de resultados
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`[PMSSyncWorker] Sync completed - Success: ${successful}, Failed: ${failed}`);
    } catch (error) {
      console.error('[PMSSyncWorker] Error in syncAll:', error);
      throw error;
    }
  }

  /**
   * Sincronizar una property específica
   */
  async syncProperty(
    property: Property, 
    syncType: 'availability' | 'bookings' | 'prices' | 'full' = 'full'
  ): Promise<void> {
    const startTime = Date.now();
    let syncLog: PMSSyncLog | null = null;

    try {
      console.log(`[PMSSyncWorker] Syncing property ${property.id} - ${property.name}`);

      // Crear registro de sincronización
      syncLog = await PMSSyncLog.create({
        property_id: property.id,
        sync_type: syncType,
        status: 'running',
        started_at: new Date()
      });

      // Verificar credenciales
      if (!property.pms_credentials) {
        throw new Error('PMS credentials not configured');
      }

      // Desencriptar credenciales
      const credentials = decryptPMSCredentials(property.pms_credentials);

      // Crear adapter PMS
      const adapter = PMSFactory.createAdapter(
        property.pms_provider,
        credentials
      );

      // Ejecutar sincronizaciones según el tipo
      const syncResults: any = {};

      if (syncType === 'full' || syncType === 'availability') {
        syncResults.availability = await this.syncAvailability(adapter, property);
      }

      if (syncType === 'full' || syncType === 'bookings') {
        syncResults.bookings = await this.syncBookings(adapter, property);
      }

      if (syncType === 'full' || syncType === 'prices') {
        syncResults.prices = await this.syncPrices(adapter, property);
      }

      // Actualizar property
      await property.update({
        pms_last_sync: new Date(),
        pms_sync_status: 'success'
      });

      // Actualizar log de sincronización
      const duration = Date.now() - startTime;
      await syncLog.update({
        status: 'completed',
        completed_at: new Date(),
        records_processed: this.countProcessedRecords(syncResults)
      });

      console.log(`[PMSSyncWorker] Property ${property.id} synced successfully in ${duration}ms`);
    } catch (error: any) {
      console.error(`[PMSSyncWorker] Error syncing property ${property.id}:`, error);

      // Actualizar property con error
      await property.update({
        pms_last_sync: new Date(),
        pms_sync_status: 'failed'
      });

      // Actualizar log con error
      if (syncLog) {
        const duration = Date.now() - startTime;
        await syncLog.update({
          status: 'failed',
          completed_at: new Date(),
          errors: error.message,
          error_details: JSON.stringify({
            name: error.name,
            stack: error.stack
          })
        });
      }

      throw error;
    }
  }

  /**
   * Sincronizar disponibilidad
   */
  private async syncAvailability(adapter: any, property: Property): Promise<any> {
    try {
      // Obtener disponibilidad para los próximos 90 días
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);

      const availability = await adapter.getAvailability(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Aquí se podría guardar la disponibilidad en una tabla de caché
      // Por ahora solo retornamos los resultados

      return {
        success: true,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        rooms: availability?.rooms?.length || 0
      };
    } catch (error: any) {
      console.error(`Error syncing availability for property ${property.id}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sincronizar bookings
   */
  private async syncBookings(adapter: any, property: Property): Promise<any> {
    try {
      // Obtener bookings recientes (últimos 30 días)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();

      // Nota: El método depende de la implementación del adapter
      // Por ahora retornamos resultado básico
      
      return {
        success: true,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        bookings: 0 // Se actualizaría con datos reales del PMS
      };
    } catch (error: any) {
      console.error(`Error syncing bookings for property ${property.id}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sincronizar precios
   */
  private async syncPrices(adapter: any, property: Property): Promise<any> {
    try {
      // Obtener precios para los próximos 90 días
      // Nota: El método depende de la implementación del adapter
      
      return {
        success: true,
        rooms: 0 // Se actualizaría con datos reales del PMS
      };
    } catch (error: any) {
      console.error(`Error syncing prices for property ${property.id}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Contar registros procesados en los resultados
   */
  private countProcessedRecords(syncResults: any): number {
    let count = 0;

    if (syncResults.availability?.rooms) {
      count += syncResults.availability.rooms;
    }

    if (syncResults.bookings?.bookings) {
      count += syncResults.bookings.bookings;
    }

    if (syncResults.prices?.rooms) {
      count += syncResults.prices.rooms;
    }

    return count;
  }

  /**
   * Obtener estado del worker
   */
  getStatus(): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.isRunning,
      interval: this.DEFAULT_SYNC_INTERVAL
    };
  }
}

// Exportar instancia singleton
export const pmsSyncWorker = new PMSSyncWorker();
