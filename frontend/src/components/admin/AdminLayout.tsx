import React from 'react';
import { Outlet } from 'react-router-dom';

const AdminLayout: React.FC = () => (
  <div>
    {/* Aquí puedes agregar navegación lateral, header, etc. */}
    <Outlet />
  </div>
);

export default AdminLayout;
