/**
 * Script para sincronizar habitaciones desde el PMS
 * Uso: npx ts-node scripts/sync-rooms-from-pms.ts <propertyId>
 */

import { RoomSyncService } from '../src/services/roomSyncService';
import Room from '../src/models/room';

async function syncRooms(propertyId: number) {
  try {
    console.log(`\n🔄 Sincronizando habitaciones desde PMS para propiedad ${propertyId}...\n`);

    const roomSyncService = new RoomSyncService();

    // Ejecutar sincronización
    console.log('⏳ Obteniendo habitaciones del PMS...');
    const result = await roomSyncService.syncRoomsFromPMS(propertyId);

    // Mostrar resultado
    console.log('\n📊 Resultado de la sincronización:');
    console.log(`   ✅ Creadas: ${result.created}`);
    console.log(`   🔄 Actualizadas: ${result.updated}`);
    console.log(`   ❌ Errores: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n   Errores encontrados:');
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`   ... y ${result.errors.length - 5} errores más`);
      }
    }

    console.log(`\n   ${result.summary}`);

    // Verificar habitaciones en BD
    console.log('\n🏨 Verificando habitaciones en la base de datos...');
    const rooms = await Room.findAll({
      where: { propertyId },
      limit: 5,
      order: [['id', 'ASC']]
    });

    console.log(`   Total en BD: ${rooms.length > 0 ? 'al menos ' + rooms.length : '0'}`);
    
    if (rooms.length > 0) {
      console.log('\n   Primeras 5 habitaciones:');
      rooms.forEach((room, i) => {
        console.log(`   ${i + 1}. ID: ${room.id}, PMS Resource: ${room.pmsResourceId}, Marketplace: ${room.isMarketplaceEnabled}`);
      });
    }

    // Contar total
    const totalCount = await Room.count({ where: { propertyId } });
    console.log(`\n   Total de habitaciones sincronizadas: ${totalCount}`);

    if (result.success) {
      console.log('\n✅ Sincronización completada exitosamente\n');
    } else {
      console.log('\n⚠️  Sincronización completada con errores\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error durante la sincronización:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Parse args
const propertyId = parseInt(process.argv[2] || '29', 10);

if (require.main === module) {
  console.log('⚡ Sincronización de habitaciones desde PMS');
  console.log('==========================================');
  syncRooms(propertyId)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { syncRooms };
