require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function check() {
  try {
    console.log('🔍 Checking week_allocations for February...\n');
    const weeks = await sequelize.query(
      `SELECT wa.id, wa.ownership_id, wa.start_date, wa.end_date, wa.status, 
              o.unit_id, tu.category
       FROM week_allocations wa
       JOIN ownerships o ON wa.ownership_id = o.id
       JOIN timeshare_units tu ON o.unit_id = tu.id
       WHERE wa.start_date >= '2026-02-01' AND wa.start_date < '2026-03-01'
       ORDER BY wa.start_date`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('Week Allocations for February:', weeks);
    console.log(`\nTotal: ${weeks.length} records\n`);

    console.log('🔍 Checking v2_bookings for February...\n');
    const bookings = await sequelize.query(
      `SELECT id, property_id, room_category, check_in, check_out, status, source
       FROM v2_bookings
       WHERE check_in >= '2026-02-01' AND check_in < '2026-03-01'
       ORDER BY check_in`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('V2 Bookings for February:', bookings);
    console.log(`\nTotal: ${bookings.length} records\n`);

    console.log('🔍 Checking ALL week_allocations (any date)...\n');
    const allWeeks = await sequelize.query(
      `SELECT COUNT(*) as total FROM week_allocations`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('Total week_allocations in DB:', allWeeks[0]);

    console.log('\n🔍 Checking if V1 bookings table exists...\n');
    const v1Bookings = await sequelize.query(
      `SELECT COUNT(*) as total FROM bookings WHERE check_in_date >= '2026-02-01'`,
      { type: sequelize.QueryTypes.SELECT }
    ).catch(e => ({ error: e.message }));
    console.log('V1 Bookings for February:', v1Bookings);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
