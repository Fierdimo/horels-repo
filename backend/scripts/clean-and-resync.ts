/**
 * Script para limpiar datos de habitaciones y resincronizar desde el PMS
 * 
 * Uso:
 *   npm run clean-resync -- [propertyId]
 *   npm run clean-resync -- --all
 * 
 * Este script:
 * 1. Limpia todos los registros de habitaciones
 * 2. Opcionalmente limpia bookings relacionados
 * 3. Resincroniza las habitaciones desde el PMS
 */

import 'dotenv/config';
import sequelize from '../src/config/database';
import Room from '../src/models/room';
import Property from '../src/models/Property';
import Booking from '../src/models/Booking';
import { RoomSyncService } from '../src/services/roomSyncService';

interface CleanOptions {
  propertyId?: number;
  cleanBookings?: boolean;
  resync?: boolean;
}

class DataCleaner {
  private roomSyncService: RoomSyncService;

  constructor() {
    this.roomSyncService = new RoomSyncService();
  }

  /**
   * Limpia las habitaciones de una propiedad específica o de todas
   */
  async cleanRooms(options: CleanOptions): Promise<void> {
    console.log('\n🧹 Iniciando limpieza de habitaciones...\n');

    try {
      const whereClause: any = {};
      
      if (options.propertyId) {
        whereClause.propertyId = options.propertyId;
        console.log(`📍 Propiedad: ${options.propertyId}`);
      } else {
        console.log('📍 Todas las propiedades');
      }

      // Contar habitaciones antes de limpiar
      const roomCount = await Room.count({ where: whereClause });
      console.log(`📊 Habitaciones a eliminar: ${roomCount}`);

      if (roomCount === 0) {
        console.log('✨ No hay habitaciones para limpiar');
        return;
      }

      // Verificar bookings asociados
      const bookingCount = await Booking.count({ 
        where: { 
          ...(options.propertyId && { propertyId: options.propertyId })
        } 
      });

      if (bookingCount > 0 && !options.cleanBookings) {
        console.warn(`⚠️  ADVERTENCIA: Hay ${bookingCount} bookings en la base de datos`);
        console.warn('⚠️  Las habitaciones con bookings activos no se eliminarán');
        console.warn('⚠️  Usa --clean-bookings para eliminar también los bookings\n');
      }

      // Eliminar habitaciones
      const deleted = await Room.destroy({ where: whereClause });
      console.log(`✅ Eliminadas ${deleted} habitaciones\n`);

      // Limpiar bookings si se especificó
      if (options.cleanBookings && bookingCount > 0) {
        console.log('🧹 Limpiando bookings asociados...');
        const deletedBookings = await Booking.destroy({
          where: {
            ...(options.propertyId && { propertyId: options.propertyId })
          }
        });
        console.log(`✅ Eliminados ${deletedBookings} bookings\n`);
      }

    } catch (error: any) {
      console.error('❌ Error al limpiar datos:', error.message);
      throw error;
    }
  }

  /**
   * Resincroniza habitaciones desde el PMS
   */
  async resyncRooms(propertyId: number): Promise<void> {
    console.log(`\n🔄 Resincronizando habitaciones para propiedad ${propertyId}...\n`);

    try {
      const property = await Property.findByPk(propertyId);
      
      if (!property) {
        throw new Error(`Propiedad ${propertyId} no encontrada`);
      }

      console.log(`📍 Propiedad: ${property.name}`);
      console.log(`🔌 PMS: ${property.pms_provider || 'none'}`);

      if (!property.pms_provider || property.pms_provider === 'none') {
        console.warn('⚠️  Esta propiedad no tiene PMS configurado');
        console.log('💡 Configura el PMS antes de sincronizar');
        return;
      }

      if (!property.pms_credentials) {
        console.warn('⚠️  Esta propiedad no tiene credenciales PMS configuradas');
        return;
      }

      console.log('⏳ Obteniendo habitaciones del PMS...');
      const result = await this.roomSyncService.syncRoomsFromPMS(propertyId);

      if (!result.success) {
        console.error('❌ Error en la sincronización:');
        result.errors.forEach(err => console.error(`   - ${err}`));
        return;
      }

      console.log('\n✅ Sincronización completada:');
      console.log(`   • Habitaciones creadas: ${result.created}`);
      console.log(`   • Habitaciones actualizadas: ${result.updated}`);
      
      if (result.errors.length > 0) {
        console.log(`   • Errores: ${result.errors.length}`);
        result.errors.forEach(err => console.log(`     - ${err}`));
      }

      // Mostrar habitaciones sincronizadas
      const rooms = await Room.findAll({ 
        where: { propertyId },
        order: [['id', 'ASC']]
      });

      console.log(`\n📋 Total de habitaciones en BD: ${rooms.length}`);
      if (rooms.length > 0) {
        console.log('\n🏠 Habitaciones sincronizadas:');
        rooms.forEach(room => {
          console.log(`   • ID: ${room.id} | PMS Resource ID: ${room.pmsResourceId} | Marketplace: ${room.isMarketplaceEnabled ? '✓' : '✗'}`);
        });
      }

    } catch (error: any) {
      console.error('❌ Error al resincronizar:', error.message);
      throw error;
    }
  }

  /**
   * Muestra el estado actual de las habitaciones
   */
  async showStatus(propertyId?: number): Promise<void> {
    console.log('\n📊 Estado actual de habitaciones:\n');

    try {
      if (propertyId) {
        const property = await Property.findByPk(propertyId);
        if (!property) {
          console.log(`❌ Propiedad ${propertyId} no encontrada`);
          return;
        }

        console.log(`📍 Propiedad: ${property.name} (ID: ${propertyId})`);
        console.log(`🔌 PMS: ${property.pms_provider || 'none'}`);
        
        const rooms = await Room.findAll({ 
          where: { propertyId },
          order: [['id', 'ASC']]
        });

        const marketplaceEnabled = rooms.filter(r => r.isMarketplaceEnabled).length;
        console.log(`🏠 Habitaciones totales: ${rooms.length}`);
        console.log(`✅ Habilitadas en marketplace: ${marketplaceEnabled}`);
        console.log(`❌ Deshabilitadas: ${rooms.length - marketplaceEnabled}\n`);

        if (rooms.length > 0) {
          console.log('Detalles:');
          rooms.forEach(room => {
            const status = room.isMarketplaceEnabled ? '✓ Enabled' : '✗ Disabled';
            const lastSync = room.pmsLastSync 
              ? new Date(room.pmsLastSync).toLocaleString() 
              : 'Never';
            console.log(`  • ID: ${room.id} | PMS: ${room.pmsResourceId} | ${status} | Last sync: ${lastSync}`);
          });
        }

      } else {
        const properties = await Property.findAll();
        
        for (const property of properties) {
          const rooms = await Room.findAll({ where: { propertyId: property.id } });
          const marketplaceEnabled = rooms.filter(r => r.isMarketplaceEnabled).length;
          
          console.log(`\n📍 ${property.name} (ID: ${property.id})`);
          console.log(`   PMS: ${property.pms_provider || 'none'}`);
          console.log(`   Habitaciones: ${rooms.length} (${marketplaceEnabled} en marketplace)`);
        }
      }

    } catch (error: any) {
      console.error('❌ Error al obtener estado:', error.message);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   🧹 Limpieza y Resincronización de Habitaciones  ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida\n');

    const cleaner = new DataCleaner();

    // Parse arguments
    const options: CleanOptions = {
      cleanBookings: args.includes('--clean-bookings'),
      resync: !args.includes('--no-resync'),
    };

    let command = 'status';
    let propertyId: number | undefined;

    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }

    if (args.includes('clean')) {
      command = 'clean';
      const propertyArg = args.find(arg => !arg.startsWith('--') && arg !== 'clean');
      if (propertyArg && propertyArg !== 'all') {
        propertyId = parseInt(propertyArg);
        if (isNaN(propertyId)) {
          console.error('❌ ID de propiedad inválido');
          process.exit(1);
        }
      }
    } else if (args.includes('status')) {
      command = 'status';
      const propertyArg = args.find(arg => !arg.startsWith('--') && arg !== 'status');
      if (propertyArg) {
        propertyId = parseInt(propertyArg);
      }
    } else if (args.length > 0 && !args[0].startsWith('--')) {
      command = 'clean';
      propertyId = parseInt(args[0]);
      if (isNaN(propertyId)) {
        command = 'status';
        propertyId = undefined;
      }
    }

    // Ejecutar comando
    if (command === 'status') {
      await cleaner.showStatus(propertyId);
    } else if (command === 'clean') {
      // Mostrar estado actual
      await cleaner.showStatus(propertyId);

      // Confirmar acción
      console.log('\n⚠️  ADVERTENCIA: Esta acción eliminará datos de la base de datos');
      if (!args.includes('--yes') && !args.includes('-y')) {
        console.log('💡 Usa --yes o -y para confirmar\n');
        process.exit(0);
      }

      // Limpiar
      await cleaner.cleanRooms({ propertyId, cleanBookings: options.cleanBookings });

      // Resincronizar si se especificó una propiedad
      if (options.resync && propertyId) {
        await cleaner.resyncRooms(propertyId);
      } else if (options.resync && !propertyId) {
        console.log('\n💡 Para resincronizar, especifica un propertyId');
        console.log('   Ejemplo: npm run clean-resync -- clean 1 --yes\n');
      }

      // Mostrar estado final
      console.log('\n' + '═'.repeat(55));
      await cleaner.showStatus(propertyId);
    }

    console.log('\n✨ Operación completada');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
📖 Uso:
  
  npm run clean-resync                          Ver estado actual
  npm run clean-resync -- status [propertyId]   Ver estado de una propiedad
  npm run clean-resync -- clean --yes           Limpiar todas las habitaciones
  npm run clean-resync -- clean 1 --yes         Limpiar y resincronizar propiedad 1
  npm run clean-resync -- clean --clean-bookings --yes  También limpiar bookings

🎯 Comandos:
  status [propertyId]    Muestra el estado actual (sin cambios)
  clean [propertyId]     Limpia habitaciones y resincroniza

🔧 Opciones:
  --yes, -y              Confirma la operación sin preguntar
  --clean-bookings       También elimina bookings asociados
  --no-resync           No resincronizar después de limpiar
  --help, -h            Muestra esta ayuda

📝 Ejemplos:
  # Ver estado de todas las propiedades
  npm run clean-resync
  
  # Ver estado de propiedad específica
  npm run clean-resync -- status 1
  
  # Limpiar y resincronizar propiedad 1
  npm run clean-resync -- clean 1 --yes
  
  # Limpiar todo incluyendo bookings
  npm run clean-resync -- clean --clean-bookings --yes
  
  # Solo limpiar sin resincronizar
  npm run clean-resync -- clean 1 --no-resync --yes
  `);
}

// Run main function
if (require.main === module) {
  main();
}

export { DataCleaner };
