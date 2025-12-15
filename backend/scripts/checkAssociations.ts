import '../src/config/database';
import { Booking, Role } from '../src/models';

console.log('Booking.associations keys:', Object.keys((Booking as any).associations || {}));
console.log('Booking has Property association:', !!(Booking as any).associations?.Property);

console.log('Role.associations keys:', Object.keys((Role as any).associations || {}));
console.log('Role has Permissions association:', !!(Role as any).associations?.Permissions);

process.exit(0);
