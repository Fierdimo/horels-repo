import { Outlet } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';

const StaffLayout: React.FC = () => {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};

export default StaffLayout;
