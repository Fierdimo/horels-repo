/**
 * Product Synchronization Service
 * 
 * Sincroniza productos/servicios desde Mews PMS al catálogo local (AncillaryService).
 * Similar a roomSyncService, solo guarda el mapeo (pms_product_id) y datos básicos.
 * Los productos se gestionan en Mews, aquí solo se reflejan.
 */

import AncillaryService from '../models/AncillaryService';
import Property from '../models/Property';
import { PMSFactory } from './pms/PMSFactory';

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
  summary?: string;
}

interface MewsProduct {
  Id: string;
  ServiceId?: string;
  Names?: { [key: string]: string };
  Descriptions?: { [key: string]: string };
  Price?: {
    GrossValue: number;
    Currency: string;
  };
  Classifications?: {
    Food?: boolean;
    Beverage?: boolean;
    Wellness?: boolean;
    CityTax?: boolean;
  };
  IsActive?: boolean;
  ChargingMode?: string;
  ExternalIdentifier?: string;
}

export class ProductSyncService {
  /**
   * Sincroniza productos desde Mews para una propiedad específica.
   */
  async syncProductsFromPMS(propertyId: number): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      created: 0,
      updated: 0,
      deactivated: 0,
      errors: [],
    };

    try {
      // 1. Obtener property y verificar configuración PMS
      const property = await Property.findByPk(propertyId);
      if (!property) {
        result.errors.push('Property not found');
        return result;
      }

      if (!property.pms_provider || property.pms_provider !== 'mews') {
        result.errors.push('Only Mews PMS is supported for product sync');
        return result;
      }

      if (!property.pms_credentials) {
        result.errors.push('PMS not configured for this property');
        return result;
      }

      // 2. Obtener instancia PMS
      const pmsService = await PMSFactory.getAdapter(propertyId);

      // 3. Verificar si el adapter tiene el método para obtener productos
      if (typeof (pmsService as any).productsGetAll !== 'function') {
        result.errors.push('PMS adapter does not support product sync');
        return result;
      }

      // 4. Obtener productos del PMS (Mews)
      const productsResponse = await (pmsService as any).productsGetAll({});
      const products: MewsProduct[] = productsResponse?.Products || [];

      if (products.length === 0) {
        console.log('[ProductSync] No products found in PMS');
        result.success = true;
        result.summary = 'No products to sync';
        return result;
      }

      console.log(`[ProductSync] Found ${products.length} products in Mews`);

      // 5. Obtener servicios existentes de esta propiedad
      const existingServices = await AncillaryService.findAll({
        where: { property_id: propertyId }
      });

      const existingMap = new Map(
        existingServices.map(s => [s.service_code, s])
      );

      const syncedProductIds = new Set<string>();

      // 6. Procesar productos en lotes
      const BATCH_SIZE = 10;
      const activeProducts = products.filter(p => p.IsActive !== false);

      for (let i = 0; i < activeProducts.length; i += BATCH_SIZE) {
        const batch = activeProducts.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (product) => {
          try {
            const productId = product.Id;
            const productName = product.Names?.['en-US'] || product.Names?.[Object.keys(product.Names || {})[0]] || 'Unknown Product';
            const description = product.Descriptions?.['en-US'] || product.Descriptions?.[Object.keys(product.Descriptions || {})[0]] || '';
            const price = product.Price?.GrossValue || 0;
            const currency = product.Price?.Currency || 'EUR';

            // Determinar categoría basada en Classifications
            let category: 'CLEANING' | 'MINIBAR' | 'PARKING' | 'BREAKFAST' | 'SPA' | 'EXCURSION' | 'TRANSPORT' | 'OTHER' = 'OTHER';
            if (product.Classifications) {
              if (product.Classifications.Food) category = 'BREAKFAST';
              else if (product.Classifications.Beverage) category = 'MINIBAR';
              else if (product.Classifications.Wellness) category = 'SPA';
            }

            // Usar ExternalIdentifier o Id como service_code
            const serviceCode = product.ExternalIdentifier || `MEWS_${productId}`;

            syncedProductIds.add(productId);

            const existing = existingMap.get(serviceCode);

            if (existing) {
              // Actualizar existente
              await existing.update({
                service_name: productName,
                description: description || undefined,
                price_euros: price,
                category,
                is_active: true
              });
              result.updated++;
            } else {
              // Crear nuevo
              await AncillaryService.create({
                property_id: propertyId,
                service_code: serviceCode,
                service_name: productName,
                description: description || undefined,
                price_euros: price,
                category,
                is_mandatory: false,
                is_active: true,
                display_order: i + 1
              });
              result.created++;
            }
          } catch (error: any) {
            console.error(`[ProductSync] Error syncing product ${product.Id}:`, error);
            result.errors.push(`Failed to sync product ${product.Id}: ${error.message}`);
          }
        }));
      }

      // 7. Desactivar productos que ya no existen en Mews
      for (const existing of existingServices) {
        const productIdFromCode = existing.service_code.replace('MEWS_', '');
        if (!syncedProductIds.has(productIdFromCode) && existing.is_active) {
          await existing.update({ is_active: false });
          result.deactivated++;
        }
      }

      result.success = true;
      result.summary = `Created: ${result.created}, Updated: ${result.updated}, Deactivated: ${result.deactivated}`;
      console.log(`[ProductSync] Sync completed: ${result.summary}`);

    } catch (error: any) {
      console.error('[ProductSync] Error during sync:', error);
      result.errors.push(error.message || 'Unknown error during sync');
    }

    return result;
  }

  /**
   * Obtener todos los servicios activos para una propiedad
   */
  async getActiveServices(propertyId: number): Promise<any[]> {
    const services = await AncillaryService.findAll({
      where: {
        property_id: propertyId,
        is_active: true
      },
      order: [
        ['category', 'ASC'],
        ['display_order', 'ASC']
      ]
    });

    return services.map(s => ({
      id: s.id,
      code: s.service_code,
      name: s.service_name,
      description: s.description,
      price: s.price_euros,
      category: s.category
    }));
  }
}

export default new ProductSyncService();
