import apiClient from './client';

export interface Booking {
  id: number;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  total_amount: number;
}

export interface Room {
  id: number;
  name: string;
  description?: string;
  capacity: number;
  type?: string;
  floor?: string;
  status: string;
  amenities?: string[];
  basePrice?: number;
  bookings?: Booking[];
  hasActiveBooking?: boolean;
  isMarketplaceEnabled?: boolean;
  pmsResourceId?: string;
  customPrice?: number;
}

export async function fetchRooms(): Promise<Room[]> {
  const res = await apiClient.get('/admin/rooms');
  return res.data;
}

export interface RoomInput {
  name: string;
  description?: string;
  capacity: number;
  type?: string;
  floor?: string;
  status?: string;
  amenities?: string[];
  basePrice?: number;
}

export async function addRoom(data: RoomInput): Promise<Room> {
  const res = await apiClient.post('/admin/rooms', data);
  return res.data;
}

export async function deleteRoom(id: number): Promise<void> {
  await apiClient.delete(`/admin/rooms/${id}`);
}
