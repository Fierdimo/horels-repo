import apiClient from './client';

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
