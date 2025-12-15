/**
 * Booking Status Service
 * 
 * Gestiona la actualización de estados de habitaciones cuando se crean/cancelan reservas
 * Mantiene coherencia entre el estado de la habitación y las reservas activas
 */

import Room from '../models/room';
import Booking from '../models/Booking';
import { Op } from 'sequelize';

export class BookingStatusService {
  /**
   * Actualiza el estado de una habitación basándose en sus reservas activas
   */
  async updateRoomStatus(roomId: number): Promise<void> {
    try {
      const room = await Room.findByPk(roomId);
      if (!room) {
        console.warn(`Room ${roomId} not found`);
        return;
      }

      // Obtener reservas activas para esta habitación
      const now = new Date();
      const activeBooking = await Booking.findOne({
        where: {
          room_id: roomId,
          status: {
            [Op.in]: ['confirmed', 'checked_in']
          },
          check_in: {
            [Op.lte]: now
          },
          check_out: {
            [Op.gte]: now
          }
        }
      });

      // Actualizar estado según si hay booking activo
      if (activeBooking) {
        // Hay una reserva activa, marcar como ocupada
        if (room.status !== 'occupied') {
          await room.update({ status: 'occupied' });
          console.log(`Room ${roomId} marked as occupied (booking ${activeBooking.id})`);
        }
      } else {
        // No hay reserva activa, marcar como disponible
        if (room.status === 'occupied') {
          await room.update({ status: 'available' });
          console.log(`Room ${roomId} marked as available`);
        }
      }
    } catch (error) {
      console.error(`Error updating room ${roomId} status:`, error);
    }
  }

  /**
   * Marca una habitación como ocupada cuando se crea una reserva
   */
  async onBookingCreated(bookingId: number): Promise<void> {
    try {
      const booking = await Booking.findByPk(bookingId);
      if (!booking || !booking.room_id) {
        return;
      }

      // Actualizar estado de la habitación
      await this.updateRoomStatus(booking.room_id);
    } catch (error) {
      console.error(`Error processing booking creation ${bookingId}:`, error);
    }
  }

  /**
   * Actualiza el estado cuando se cancela o completa una reserva
   */
  async onBookingStatusChange(bookingId: number, newStatus: string): Promise<void> {
    try {
      const booking = await Booking.findByPk(bookingId);
      if (!booking || !booking.room_id) {
        return;
      }

      // Si se canceló o completó, verificar si la habitación debe quedar disponible
      if (['cancelled', 'completed', 'checked_out'].includes(newStatus)) {
        await this.updateRoomStatus(booking.room_id);
      } 
      // Si se confirmó o hizo check-in, marcar como ocupada
      else if (['confirmed', 'checked_in'].includes(newStatus)) {
        await this.updateRoomStatus(booking.room_id);
      }
    } catch (error) {
      console.error(`Error processing booking status change ${bookingId}:`, error);
    }
  }

  /**
   * Verifica disponibilidad de una habitación en un rango de fechas
   */
  async checkRoomAvailability(
    roomId: number, 
    checkIn: Date, 
    checkOut: Date,
    excludeBookingId?: number
  ): Promise<boolean> {
    try {
      const room = await Room.findByPk(roomId);
      if (!room || room.status === 'maintenance') {
        return false;
      }

      // Buscar reservas que se solapen con las fechas
      const whereClause: any = {
        room_id: roomId,
        status: {
          [Op.notIn]: ['cancelled', 'rejected']
        },
        [Op.or]: [
          {
            // Check-in dentro del rango
            check_in: {
              [Op.between]: [checkIn, checkOut]
            }
          },
          {
            // Check-out dentro del rango
            check_out: {
              [Op.between]: [checkIn, checkOut]
            }
          },
          {
            // Reserva envuelve el rango completo
            check_in: {
              [Op.lte]: checkIn
            },
            check_out: {
              [Op.gte]: checkOut
            }
          }
        ]
      };

      // Excluir una reserva específica (útil para ediciones)
      if (excludeBookingId) {
        whereClause.id = { [Op.ne]: excludeBookingId };
      }

      const conflictingBookings = await Booking.findAll({
        where: whereClause
      });

      return conflictingBookings.length === 0;
    } catch (error) {
      console.error(`Error checking availability for room ${roomId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene habitaciones disponibles para un property en un rango de fechas
   */
  async getAvailableRooms(
    propertyId: number,
    checkIn: Date,
    checkOut: Date,
    options?: {
      type?: string;
      minCapacity?: number;
      onlyMarketplace?: boolean;
    }
  ): Promise<Room[]> {
    try {
      // Primero obtener todas las habitaciones que cumplen los criterios básicos
      const whereClause: any = {
        propertyId,
        status: {
          [Op.notIn]: ['maintenance', 'inactive']
        }
      };

      if (options?.type) {
        whereClause.type = options.type;
      }

      if (options?.minCapacity) {
        whereClause.capacity = {
          [Op.gte]: options.minCapacity
        };
      }

      if (options?.onlyMarketplace) {
        whereClause.isMarketplaceEnabled = true;
      }

      const rooms = await Room.findAll({
        where: whereClause
      });

      // Filtrar por disponibilidad en las fechas
      const availableRooms: Room[] = [];
      for (const room of rooms) {
        const isAvailable = await this.checkRoomAvailability(
          room.id,
          checkIn,
          checkOut
        );
        if (isAvailable) {
          availableRooms.push(room);
        }
      }

      return availableRooms;
    } catch (error) {
      console.error(`Error getting available rooms for property ${propertyId}:`, error);
      return [];
    }
  }

  /**
   * Ejecuta una actualización masiva de estados de todas las habitaciones
   * Útil para ejecutar periódicamente (cron job) y mantener consistencia
   */
  async syncAllRoomStatuses(propertyId?: number): Promise<void> {
    try {
      const whereClause: any = {};
      if (propertyId) {
        whereClause.propertyId = propertyId;
      }

      const rooms = await Room.findAll({ where: whereClause });
      
      console.log(`Syncing status for ${rooms.length} rooms...`);
      
      for (const room of rooms) {
        await this.updateRoomStatus(room.id);
      }
      
      console.log(`Completed status sync for ${rooms.length} rooms`);
    } catch (error) {
      console.error('Error syncing all room statuses:', error);
    }
  }
}

export default new BookingStatusService();
