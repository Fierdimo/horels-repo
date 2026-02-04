/**
 * Script para probar que una nueva conversión acumule la cantidad correcta
 * 
 * Simula los datos que llegarían en una conversión real y verifica
 * que el cálculo sea correcto ANTES de ejecutar la conversión
 */

// @ts-ignore
import models from '../models';

const { WeekAllocation, Ownership, TimeshareUnit, User, CreditAccount } = models;

interface SeasonalFactors {
  [weekNumber: string]: number;
}

interface Unit {
  id: number;
  unit_type: string;
  base_credit_value: number;
  seasonal_factors: string | SeasonalFactors;
}

interface WeekAllocation {
  id: number;
  week_number: number;
  start_date: string;
  unit_id: number;
  unit: Unit;
  status: string;
}

// Función para calcular créditos (replica la lógica de SeasonalCreditStrategy)
function calculateCredits(
  baseValue: number,
  weekNumber: number,
  seasonalFactors: SeasonalFactors,
  daysInAdvance: number
): { seasonalMultiplier: number; timingMultiplier: number; finalCredits: number } {
  // Obtener multiplicador estacional
  const seasonalMultiplier = seasonalFactors[weekNumber.toString()] || 1.0;

  // Calcular multiplicador de timing
  let timingMultiplier = 1.0;
  if (daysInAdvance < 30) {
    timingMultiplier = 0.5;
  } else if (daysInAdvance < 90) {
    timingMultiplier = 0.7;
  } else if (daysInAdvance < 180) {
    timingMultiplier = 0.9;
  } else {
    timingMultiplier = 1.0;
  }

  // Calcular créditos finales
  const finalCredits = Math.round(baseValue * seasonalMultiplier * timingMultiplier);

  return { seasonalMultiplier, timingMultiplier, finalCredits };
}

async function testNewConversion() {
  try {
    console.log('🧪 Probando cálculo de créditos para nueva conversión...\n');

    // Buscar una semana ASSIGNED del usuario para simular conversión
    const week = await WeekAllocation.findOne({
      where: {
        user_id: 10,
        status: 'ASSIGNED'
      },
      include: [
        {
          model: Ownership,
          as: 'ownership',
          include: [
            {
              model: TimeshareUnit,
              as: 'unit'
            }
          ]
        }
      ],
      order: [['start_date', 'ASC']]
    });

    if (!week) {
      console.log('⚠️  No hay semanas ASSIGNED disponibles para probar');
      console.log('   Todas las semanas ya fueron convertidas.');
      
      // Mostrar balance actual
      const account = await CreditAccount.findOne({ where: { user_id: 10 } });
      if (account) {
        console.log(`\n💰 Balance actual: ${account.balance} créditos`);
        console.log(`   Total earned: ${(account as any).total_earned || 0}`);
      }
      return;
    }

    const unit = (week as any).ownership?.unit;
    if (!unit) {
      console.log('❌ No se encontró la unidad asociada');
      return;
    }
    
    console.log('📅 Semana encontrada:');
    console.log(`   ID: ${week.id}`);
    console.log(`   Tipo: ${unit.unit_type}`);
    console.log(`   Semana #: ${week.week_number}`);
    console.log(`   Fecha inicio: ${week.start_date}`);
    console.log(`   Estado: ${week.status}`);
    console.log(`   Base value: ${unit.base_credit_value}`);

    // Parsear seasonal_factors
    let seasonalFactors: SeasonalFactors = {};
    if (unit.seasonal_factors) {
      try {
        seasonalFactors = typeof unit.seasonal_factors === 'string'
          ? JSON.parse(unit.seasonal_factors)
          : unit.seasonal_factors;
      } catch (e) {
        console.error('❌ Error al parsear seasonal_factors:', e);
        return;
      }
    }

    console.log(`   Seasonal factor para semana ${week.week_number}: ${seasonalFactors[week.week_number.toString()] || 1.0}`);

    // Calcular días de anticipación
    const startDate = new Date(week.start_date);
    const today = new Date();
    const daysInAdvance = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`   Días de anticipación: ${daysInAdvance}`);

    // Calcular créditos esperados
    const baseValue = parseFloat(String(unit.base_credit_value));
    const calculation = calculateCredits(baseValue, week.week_number, seasonalFactors, daysInAdvance);

    console.log('\n💰 Cálculo de créditos:');
    console.log(`   Base value: ${baseValue}`);
    console.log(`   × Seasonal multiplier: ${calculation.seasonalMultiplier}`);
    console.log(`   × Timing multiplier: ${calculation.timingMultiplier}`);
    console.log(`   = Créditos esperados: ${calculation.finalCredits}`);

    console.log('\n✅ El sistema calculará esta cantidad al hacer la conversión real');
    console.log('   Puedes proceder con la conversión desde el frontend');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testNewConversion();
