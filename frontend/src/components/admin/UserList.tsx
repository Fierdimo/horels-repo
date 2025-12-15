import React from 'react';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  estado: string;
}

interface UserListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export const UserList: React.FC<UserListProps> = ({ users, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Nombre</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Rol</th>
            <th className="p-2 border">Estado</th>
            <th className="p-2 border">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="p-2 border">{u.nombre}</td>
              <td className="p-2 border">{u.email}</td>
              <td className="p-2 border">{u.rol}</td>
              <td className="p-2 border">{u.estado}</td>
              <td className="p-2 border">
                <button className="mr-2 text-blue-600 hover:underline" onClick={() => onEdit(u)}>Editar</button>
                <button className="text-red-600 hover:underline" onClick={() => onDelete(u)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
