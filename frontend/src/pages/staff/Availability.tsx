import React, { useState } from 'react';
import { RoomWeekAvailability, RoomWeek } from '@/components/staff/RoomWeekAvailability';
import { RoomManagement, Room } from '@/components/staff/RoomManagement';
import type { RoomInput } from '@/api/rooms';


const mockRoomWeeks: RoomWeek[] = [
  { id: 1, habitacion: '101', semana: '2025-W01', estado: 'disponible' },
  { id: 2, habitacion: '102', semana: '2025-W01', estado: 'reservada', usuarioAsignado: 'Juan Pérez' },
  { id: 3, habitacion: '103', semana: '2025-W02', estado: 'bloqueada' },
  { id: 4, habitacion: '101', semana: '2025-W02', estado: 'no_disponible' },
  { id: 5, habitacion: '102', semana: '2025-W02', estado: 'disponible' },
];

const Availability: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([
    { id: 1, name: '101', capacity: 2, status: 'available', basePrice: 100 },
    { id: 2, name: '102', capacity: 2, status: 'available', basePrice: 100 },
    { id: 3, name: '103', capacity: 4, status: 'available', basePrice: 150 },
  ]);
  const [roomWeeks, setRoomWeeks] = useState<RoomWeek[]>(mockRoomWeeks);

  const handleAddRoom = (data: RoomInput) => {
    const newRoom: Room = {
      id: Date.now(),
      name: data.name,
      capacity: data.capacity,
      status: data.status || 'available',
      basePrice: data.basePrice
    };
    setRooms((prev) => [...prev, newRoom]);
    // TODO: Llamar API para agregar habitación
  };

  const handleDeleteRoom = (id: number) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    // TODO: Llamar API para eliminar habitación
    setRoomWeeks((prev) => prev.filter((rw) => rw.habitacion !== rooms.find(r => r.id === id)?.name));
  };

  const handleChange = (id: number, estado: RoomWeek['estado']) => {
    setRoomWeeks((prev) => prev.map((rw) => rw.id === id ? { ...rw, estado } : rw));
    // TODO: Llamar API para actualizar en backend
  };

  const handleAssign = (id: number) => {
    // TODO: Mostrar modal para seleccionar usuario y asignar
    alert('Asignar usuario a la semana/room ' + id);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Gestión de Disponibilidad de Semanas y Habitaciones</h2>
      <div className="text-gray-500 mb-2">Marca qué habitaciones están disponibles para semanas compartidas y asigna usuarios cuando corresponda.</div>
      <RoomManagement rooms={rooms} onAdd={handleAddRoom} onDelete={handleDeleteRoom} />
      <RoomWeekAvailability data={roomWeeks} onChange={handleChange} onAssign={handleAssign} />
    </div>
  );
};

export default Availability;
