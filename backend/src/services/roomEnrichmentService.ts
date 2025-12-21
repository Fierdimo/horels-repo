/**
 * Room Enrichment Service
 * 
 * Enriquece los datos de habitaciones locales con información fresca del PMS.
 * 
 * La arquitectura REFERENCE ONLY mantiene solo:
 * - pms_resource_id (mapeo único)
 * - Datos complementarios (custom_price, images, is_marketplace_enabled, etc)
 * 
 * Todo lo demás (name, capacity, type, etc) viene del PMS en tiempo real.
 */

import Room from '../models/room';
import { PMSFactory } from './pms/PMSFactory';
import Property from '../models/Property';

export interface EnrichedRoom {
  // Local data
  id: number;
  pmsResourceId: string;
  propertyId: number;
  roomTypeId?: number;
  customPrice?: number;
  isMarketplaceEnabled: boolean;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;

  // PMS data (enriched at runtime)
  name: string;
  description?: string;
  capacity: number;
  floor?: string;
  type: string;
  status: string;
  basePrice?: number;
  amenities?: any[];

  // Calculated
  price: number; // customPrice OR basePrice
}

export class RoomEnrichmentService {
  /**
   * Enriquece una habitación local con datos del PMS
   */
  static async enrichRoom(roomLocal: Room): Promise<EnrichedRoom> {
    try {
      if (!roomLocal.propertyId || !roomLocal.pmsResourceId) {
        throw new Error('Room must have propertyId and pmsResourceId');
      }

      // Obtener datos del PMS
      const pmsService = await PMSFactory.getAdapter(roomLocal.propertyId);
      const availability = await pmsService.getAvailability({});
      
      // Encontrar el recurso (habitación) específico
      const resources = availability?.resources || [];
      const pmsRoom = resources.find((r: any) => r.Id === roomLocal.pmsResourceId);

      if (!pmsRoom) {
        throw new Error(`Room not found in PMS: ${roomLocal.pmsResourceId}`);
      }

      // También obtener información del servicio si existe
      const services = availability?.services || [];
      const service = pmsRoom.ServiceId ? services.find((s: any) => s.Id === pmsRoom.ServiceId) : null;

      // Combinar datos locales + PMS
      const enriched: EnrichedRoom = {
        // Local data
        id: roomLocal.id,
        pmsResourceId: roomLocal.pmsResourceId,
        propertyId: roomLocal.propertyId,
        roomTypeId: roomLocal.roomTypeId,
        customPrice: roomLocal.customPrice,
        isMarketplaceEnabled: roomLocal.isMarketplaceEnabled || false,
        images: roomLocal.images,
        createdAt: roomLocal.createdAt,
        updatedAt: roomLocal.updatedAt,

        // PMS data
        name: pmsRoom.name || `Room ${roomLocal.pmsResourceId}`,
        description: pmsRoom.description || service?.Name,
        capacity: pmsRoom.capacity || 2,
        floor: pmsRoom.floor,
        type: service?.Name || pmsRoom.type || 'Standard',
        status: pmsRoom.status || 'available',
        basePrice: service?.DefaultPrice || pmsRoom.basePrice,
        amenities: pmsRoom.amenities,

        // Calculated: custom price takes precedence
        price: roomLocal.customPrice ? 
          Number(roomLocal.customPrice) : 
          (service?.DefaultPrice || pmsRoom.basePrice || 0),
      };

      return enriched;
    } catch (error: any) {
      console.error(`Error enriching room ${roomLocal.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Enriquece múltiples habitaciones
   * Hace una sola llamada a getAvailability() para todas las habitaciones de la propiedad
   * para evitar rate limiting del API
   * También obtiene imágenes desde resourceCategoryImageAssignments
   */
  static async enrichRooms(roomsLocal: Room[]): Promise<EnrichedRoom[]> {
    if (roomsLocal.length === 0) {
      return [];
    }

    try {
      // Obtener propertyId del primer room (todas son de la misma propiedad en esta llamada)
      const propertyId = roomsLocal[0].propertyId;
      const pmsService = await PMSFactory.getAdapter(propertyId);
      
      // Hacer UNA sola llamada a getAvailability para obtener TODOS los datos del PMS
      const availability = await pmsService.getAvailability({});
      const resources = availability?.resources || [];
      const services = availability?.services || [];

      // Obtener imágenes si el adaptador tiene el método
      let imageAssignments: any = {};
      let imageUrls: any = {};
      let resourceCategoryAssignments: any = [];
      
      try {
        if (typeof (pmsService as any).resourceCategoryImageAssignmentsGetAll === 'function') {
          try {
            const imageAssignmentsData = await (pmsService as any).resourceCategoryImageAssignmentsGetAll();
            const imageAssignmentList = imageAssignmentsData?.ResourceCategoryImageAssignments || [];
            
            // Mapear ImageIds por CategoryId
            imageAssignments = {};
            const imageIds: string[] = [];
            imageAssignmentList.forEach((assignment: any) => {
              if (!imageAssignments[assignment.CategoryId]) {
                imageAssignments[assignment.CategoryId] = [];
              }
              imageAssignments[assignment.CategoryId].push({
                id: assignment.ImageId,
                ordering: assignment.Ordering
              });
              imageIds.push(assignment.ImageId);
            });

            // Obtener ResourceCategoryAssignments para mapear recursos a categorías
            if (typeof (pmsService as any).resourceCategoryAssignmentsGetAll === 'function') {
              try {
                const assignmentsData = await (pmsService as any).resourceCategoryAssignmentsGetAll();
                resourceCategoryAssignments = assignmentsData?.ResourceCategoryAssignments || [];
              } catch (assignmentError: any) {
                console.warn('Warning: Could not fetch resource category assignments:', assignmentError.message);
              }
            }

            // Obtener URLs de imágenes si hay ImageIds
            if (imageIds.length > 0 && typeof (pmsService as any).imagesGetUrls === 'function') {
              try {
                const imagesData = await (pmsService as any).imagesGetUrls(imageIds, 600, 400, 'Fit');
                const imageUrlsList = imagesData?.ImageUrls || [];
                imageUrlsList.forEach((imgUrl: any) => {
                  imageUrls[imgUrl.ImageId] = imgUrl.Url;
                });
              } catch (imageUrlError: any) {
                console.warn('Warning: Could not fetch image URLs:', imageUrlError.message);
              }
            }
          } catch (imageAssignmentError: any) {
            console.warn('Warning: Could not fetch image assignments:', imageAssignmentError.message);
          }
        }
      } catch (imageError: any) {
        console.warn('Warning: Could not fetch images from PMS:', imageError.message);
        // Continuar sin imágenes
      }

      // Crear mapa de ResourceId -> CategoryIds
      const resourceToCategories: any = {};
      resourceCategoryAssignments.forEach((assignment: any) => {
        if (!resourceToCategories[assignment.ResourceId]) {
          resourceToCategories[assignment.ResourceId] = [];
        }
        resourceToCategories[assignment.ResourceId].push(assignment.CategoryId);
      });

      // Enriquecer cada habitación con los datos del PMS obtenidos en una sola llamada
      const enriched = roomsLocal.map((roomLocal: Room) => {
        try {
          // Encontrar el recurso (habitación) específico
          const pmsRoom = resources.find((r: any) => r.Id === roomLocal.pmsResourceId);

          if (!pmsRoom) {
            console.warn(`Room ${roomLocal.id} (${roomLocal.pmsResourceId}) not found in PMS availability`);
            // Retornar con datos mínimos si no está en PMS
            return {
              id: roomLocal.id,
              pmsResourceId: roomLocal.pmsResourceId,
              propertyId: roomLocal.propertyId,
              roomTypeId: roomLocal.roomTypeId,
              customPrice: roomLocal.customPrice,
              isMarketplaceEnabled: roomLocal.isMarketplaceEnabled || false,
              images: roomLocal.images,
              createdAt: roomLocal.createdAt,
              updatedAt: roomLocal.updatedAt,
              name: `Room ${roomLocal.pmsResourceId}`,
              description: undefined,
              capacity: 2,
              floor: undefined,
              type: 'Unknown',
              status: 'unknown',
              basePrice: 0,
              amenities: undefined,
              price: roomLocal.customPrice || 0,
            } as EnrichedRoom;
          }

          // Obtener servicio asociado
          const service = pmsRoom.ServiceId ? services.find((s: any) => s.Id === pmsRoom.ServiceId) : null;

          // Obtener imágenes de categorías asociadas
          const images = roomLocal.images || [];
          const categoryIds = resourceToCategories[pmsRoom.Id] || [];
          for (const categoryId of categoryIds) {
            const categoryImages = imageAssignments[categoryId] || [];
            // Ordenar por ordering y obtener URLs
            categoryImages.sort((a: any, b: any) => a.ordering - b.ordering);
            categoryImages.forEach((img: any) => {
              const url = imageUrls[img.id];
              if (url && !images.includes(url)) {
                images.push(url);
              }
            });
          }

          // Combinar datos locales + PMS
          const enriched: EnrichedRoom = {
            // Local data
            id: roomLocal.id,
            pmsResourceId: roomLocal.pmsResourceId,
            propertyId: roomLocal.propertyId,
            roomTypeId: roomLocal.roomTypeId,
            customPrice: roomLocal.customPrice,
            isMarketplaceEnabled: roomLocal.isMarketplaceEnabled || false,
            images: images.length > 0 ? images : undefined,
            createdAt: roomLocal.createdAt,
            updatedAt: roomLocal.updatedAt,

            // PMS data
            name: pmsRoom.name || `Room ${roomLocal.pmsResourceId}`,
            description: pmsRoom.description || service?.Name,
            capacity: pmsRoom.capacity || 2,
            floor: pmsRoom.floor,
            type: service?.Name || pmsRoom.type || 'Standard',
            status: pmsRoom.status || 'available',
            basePrice: service?.DefaultPrice || pmsRoom.basePrice,
            amenities: pmsRoom.amenities,

            // Calculated: custom price takes precedence
            price: roomLocal.customPrice ? 
              Number(roomLocal.customPrice) : 
              (service?.DefaultPrice || pmsRoom.basePrice || 0),
          };

          return enriched;
        } catch (roomError: any) {
          console.error(`Error enriching room ${roomLocal.id}:`, roomError.message);
          // Retornar room con datos mínimos si hay error en este room específico
          return {
            id: roomLocal.id,
            pmsResourceId: roomLocal.pmsResourceId,
            propertyId: roomLocal.propertyId,
            roomTypeId: roomLocal.roomTypeId,
            customPrice: roomLocal.customPrice,
            isMarketplaceEnabled: roomLocal.isMarketplaceEnabled || false,
            images: roomLocal.images,
            createdAt: roomLocal.createdAt,
            updatedAt: roomLocal.updatedAt,
            name: `Room ${roomLocal.pmsResourceId}`,
            description: undefined,
            capacity: 2,
            floor: undefined,
            type: 'Unknown',
            status: 'unknown',
            basePrice: 0,
            amenities: undefined,
            price: roomLocal.customPrice || 0,
          } as EnrichedRoom;
        }
      });

      return enriched;
    } catch (error: any) {
      console.error('Error enriching rooms batch:', error.message);
      // Si falla completamente, retornar rooms sin PMS data
      return roomsLocal.map((roomLocal: Room) => ({
        id: roomLocal.id,
        pmsResourceId: roomLocal.pmsResourceId,
        propertyId: roomLocal.propertyId,
        roomTypeId: roomLocal.roomTypeId,
        customPrice: roomLocal.customPrice,
        isMarketplaceEnabled: roomLocal.isMarketplaceEnabled || false,
        images: roomLocal.images,
        createdAt: roomLocal.createdAt,
        updatedAt: roomLocal.updatedAt,
        name: `Room ${roomLocal.pmsResourceId}`,
        description: undefined,
        capacity: 2,
        floor: undefined,
        type: 'Unknown',
        status: 'unknown',
        basePrice: 0,
        amenities: undefined,
        price: roomLocal.customPrice || 0,
      } as EnrichedRoom));
    }
  }

  /**
   * Obtiene todas las habitaciones enriquecidas de una propiedad
   */
  static async getRoomsForProperty(propertyId: number, filters?: {
    isMarketplaceEnabled?: boolean;
  }): Promise<EnrichedRoom[]> {
    const where: any = { propertyId };

    if (filters?.isMarketplaceEnabled !== undefined) {
      where.isMarketplaceEnabled = filters.isMarketplaceEnabled;
    }

    const roomsLocal = await Room.findAll({ where });
    return this.enrichRooms(roomsLocal);
  }

  /**
   * Obtiene una habitación enriquecida por ID
   */
  static async getRoomById(roomId: number): Promise<EnrichedRoom> {
    const roomLocal = await Room.findByPk(roomId);
    if (!roomLocal) {
      throw new Error(`Room ${roomId} not found`);
    }
    return this.enrichRoom(roomLocal);
  }

  /**
   * Obtiene una habitación enriquecida por pmsResourceId
   */
  static async getRoomByPMSId(propertyId: number, pmsResourceId: string): Promise<EnrichedRoom> {
    const roomLocal = await Room.findOne({
      where: { propertyId, pmsResourceId }
    });
    if (!roomLocal) {
      throw new Error(`Room ${pmsResourceId} not found in property ${propertyId}`);
    }
    return this.enrichRoom(roomLocal);
  }

  /**
   * Verifica si una habitación está disponible en un rango de fechas
   * Consulta el PMS para determinar disponibilidad
   */
  static async checkAvailability(
    propertyId: number,
    pmsResourceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<boolean> {
    try {
      const pmsService = await PMSFactory.getAdapter(propertyId);
      const availability = await pmsService.getAvailability({
        start_date: startDate,
        end_date: endDate,
      });

      // Buscar el recurso en los resultados
      const resource = availability?.resources?.find(
        (r: any) => r.Id === pmsResourceId
      );

      return !!resource;
    } catch (error: any) {
      console.error(`Error checking availability:`, error.message);
      throw error;
    }
  }
}

export default RoomEnrichmentService;
