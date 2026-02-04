/**
 * Script para generar week_allocations faltantes
 * 
 * Este script busca ownerships de tipo FIXED_WEEK que no tienen
 * week_allocations para el año actual y las genera.
 */

const { Ownership } = require('./src/models/v2/Ownership');
const { WeekAllocation } = require('./src/models/v2/WeekAllocation');
const { sequelize } = require('./src/models');

async function generateMissingAllocations() {
  try {
    console.log('🔍 Buscando ownerships sin allocations...\n');
    
    const currentYear = new Date().getFullYear();
    
    // Buscar todos los ownerships FIXED_WEEK activos
    const ownerships = await Ownership.findAll({
      where: {
        type: 'FIXED_WEEK',
        status: 'ACTIVE'
      },
      include: [{
        model: WeekAllocation,
        as: 'allocations',
        where: { year: currentYear },
        required: false // LEFT JOIN para incluir los que no tienen allocations
      }]
    });

    console.log(`📊 Total ownerships FIXED_WEEK activos: ${ownerships.length}`);
    
    let created = 0;
    let skipped = 0;

    for (const ownership of ownerships) {
      // Si ya tiene allocation para este año, skip
      if (ownership.allocations && ownership.allocations.length > 0) {
        console.log(`⏭️  Ownership ${ownership.id}: Ya tiene allocation para ${currentYear}`);
        skipped++;
        continue;
      }

      // Si no tiene fixed_week_number, error
      if (!ownership.fixed_week_number) {
        console.log(`⚠️  Ownership ${ownership.id}: No tiene fixed_week_number definido`);
        continue;
      }

      // Calcular fechas de la semana
      const { start_date, end_date } = calculateWeekDates(currentYear, ownership.fixed_week_number);

      // Crear week_allocation
      const allocation = await WeekAllocation.create({
        ownership_id: ownership.id,
        year: currentYear,
        week_number: ownership.fixed_week_number,
        start_date,
        end_date,
        status: 'ASSIGNED'
      });

      console.log(`✅ Ownership ${ownership.id}: Creada allocation para semana ${ownership.fixed_week_number} (${start_date} - ${end_date})`);
      created++;
    }

    console.log('\n📈 Resumen:');
    console.log(`   ✅ Allocations creadas: ${created}`);
    console.log(`   ⏭️  Ownerships con allocation: ${skipped}`);
    console.log(`   📊 Total procesados: ${ownerships.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

/**
 * Calcular fechas de inicio y fin de una semana
 */
function calculateWeekDates(year, weekNumber) {
  // Enero 1 del año
  const jan1 = new Date(year, 0, 1);
  
  // Encontrar el primer lunes del año (ISO week date standard)
  const dayOfWeek = jan1.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calcular días hasta el próximo lunes
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek); // Si es domingo, +1; sino, días hasta lunes
  
  // Primer lunes del año
  const firstMonday = new Date(year, 0, 1 + daysUntilMonday);
  
  // Semana 1 comienza en el primer lunes
  // Para semana N, agregamos (N-1) * 7 días
  const start_date = new Date(firstMonday);
  start_date.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  // Fin de semana es 6 días después (lunes a domingo)
  const end_date = new Date(start_date);
  end_date.setDate(start_date.getDate() + 6);
  
  return { start_date, end_date };
}

// Ejecutar
generateMissingAllocations();
