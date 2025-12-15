import React, { useState } from 'react';
import type { RoomInput, Room } from '@/api/rooms';

// Re-export Room type for use in other components
export type { Room };

interface RoomManagementProps {
  rooms: Room[];
  onAdd: (data: RoomInput) => void;
  onDelete: (id: number) => void;
  onEdit?: (id: number, data: RoomInput) => void;
}

const initialForm: RoomInput = {
  name: '',
  description: '',
  capacity: 1,
  type: '',
  floor: '',
  status: 'activa',
  amenities: [],
  basePrice: undefined,
};


export const RoomManagement: React.FC<RoomManagementProps> = ({ rooms, onAdd, onDelete, onEdit }) => {
  const [form, setForm] = useState<RoomInput>(initialForm);
  const [amenityInput, setAmenityInput] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: name === 'capacity' ? (value === '' ? '' : Number(value)) : value
    }));
  };

  const handleAddAmenity = () => {
    if (amenityInput.trim()) {
      setForm(f => ({ ...f, amenities: [...(f.amenities || []), amenityInput.trim()] }));
      setAmenityInput('');
    }
  };

  const handleRemoveAmenity = (idx: number) => {
    setForm(f => ({ ...f, amenities: (f.amenities || []).filter((_, i) => i !== idx) }));
  };


  const handleAdd = () => {
    if (form.name.trim() && form.capacity > 0) {
      if (editingId && onEdit) {
        onEdit(editingId, form);
      } else {
        onAdd(form);
      }
      setForm(initialForm);
      setEditingId(null);
    }
  };

  const handleEditClick = (room: Room) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      description: room.description || '',
      capacity: room.capacity || 1,
      type: room.type || '',
      floor: room.floor || '',
      status: room.status || 'activa',
      amenities: room.amenities || [],
      basePrice: room.basePrice,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(initialForm);
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">Gestión de Habitaciones</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Nombre o número de habitación"
          name="name"
          value={form.name}
          onChange={handleChange}
        />
        <div className="flex flex-col">
          <label htmlFor="type" className="text-xs font-medium text-gray-700 mb-1">Tipo de habitación</label>
          <select
            id="type"
            className="border px-2 py-1 rounded"
            name="type"
            value={form.type}
            onChange={handleChange}
          >
            <option value="">Selecciona tipo</option>
            <option value="Sencilla">Sencilla</option>
            <option value="Doble">Doble</option>
            <option value="Suite">Suite</option>
            <option value="Familiar">Familiar</option>
            <option value="Deluxe">Deluxe</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <input
          className="border px-2 py-1 rounded"
          placeholder="Piso o ubicación"
          name="floor"
          value={form.floor}
          onChange={handleChange}
        />
        <div className="flex flex-col">
          <label htmlFor="capacity" className="text-xs font-medium text-gray-700 mb-1">Capacidad</label>
          <input
            id="capacity"
            className="border px-2 py-1 rounded"
            placeholder="Ej: 2"
            name="capacity"
            type="number"
            min={1}
            value={form.capacity === undefined ? '' : form.capacity}
            onChange={handleChange}
          />
        </div>
        <input
          className="border px-2 py-1 rounded"
          placeholder="Precio base (opcional)"
          name="basePrice"
          type="number"
          min={0}
          value={form.basePrice ?? ''}
          onChange={handleChange}
        />
        <select
          className="border px-2 py-1 rounded"
          name="status"
          value={form.status}
          onChange={handleChange}
        >
          <option value="activa">Activa</option>
          <option value="inactiva">Inactiva</option>
          <option value="mantenimiento">Mantenimiento</option>
        </select>
        <textarea
          className="border px-2 py-1 rounded col-span-1 md:col-span-2"
          placeholder="Descripción (opcional)"
          name="description"
          value={form.description}
          onChange={handleChange}
        />
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <input
              className="border px-2 py-1 rounded flex-1"
              placeholder="Amenidad (ej: TV, Balcón)"
              value={amenityInput}
              onChange={e => setAmenityInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' ? (e.preventDefault(), handleAddAmenity()) : undefined}
            />
            <button
              className="bg-blue-600 text-white px-3 py-1 rounded"
              type="button"
              onClick={handleAddAmenity}
            >
              Añadir
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(form.amenities) ? form.amenities : []).map((a, idx) => (
              <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                {a}
                <button type="button" className="ml-1 text-red-500 hover:text-red-700" onClick={() => handleRemoveAmenity(idx)}>&times;</button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className={`px-6 py-2 rounded shadow transition text-white ${editingId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={handleAdd}
        >
          {editingId ? 'Guardar cambios' : 'Agregar habitación'}
        </button>
        {editingId && (
          <button
            className="px-4 py-2 rounded shadow bg-gray-300 hover:bg-gray-400 text-gray-800"
            onClick={handleCancelEdit}
          >
            Cancelar
          </button>
        )}
      </div>
      <ul className="list-disc pl-5 mt-6">
        {rooms.map(room => (
          <li key={room.id} className="flex items-center justify-between mb-1 border-b py-2">
            <span>
              <span className="font-semibold text-blue-900">{room.name}</span>
              {room.type && <span className="ml-2 text-xs text-blue-700">({room.type})</span>}
              {room.floor && <span className="ml-2 text-xs text-gray-500">Piso: {room.floor}</span>}
              {room.capacity && <span className="ml-2 text-xs text-gray-700">Capacidad: {room.capacity}</span>}
              {room.status && <span className="ml-2 text-xs text-green-700">{room.status}</span>}
              {room.basePrice && <span className="ml-2 text-xs text-yellow-700">${room.basePrice}</span>}
              {Array.isArray(room.amenities) && room.amenities.length > 0 && (
                <span className="ml-2 text-xs text-blue-500">[{room.amenities.join(', ')}]</span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                className="text-blue-600 hover:underline text-xs"
                onClick={() => handleEditClick(room)}
              >
                Editar
              </button>
              <button
                className="text-red-600 hover:underline text-xs"
                onClick={() => onDelete(room.id)}
              >
                Quitar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
