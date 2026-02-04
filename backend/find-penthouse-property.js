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

async function find() {
  try {
    console.log('🔍 Finding property for unit_id 29 (with feb 9-15 reservations)...\n');
    
    const unit = await sequelize.query(
      `SELECT tu.*, tp.name as property_name, tp.city, tp.country
       FROM timeshare_units tu
       JOIN timeshare_properties tp ON tu.property_id = tp.id
       WHERE tu.id = 29`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('Unit 29 belongs to:', unit[0]);
    
    console.log('\n🔍 Checking all PENTHOUSE units across properties...\n');
    const allPenthouses = await sequelize.query(
      `SELECT tu.id as unit_id, tu.category, tu.property_id, 
              tp.name as property_name, tp.city
       FROM timeshare_units tu
       JOIN timeshare_properties tp ON tu.property_id = tp.id
       WHERE tu.category = 'PENTHOUSE'
       ORDER BY tp.id, tu.id`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('All PENTHOUSE units:', allPenthouses);
    
    console.log('\n🔍 Properties with week_allocations for Feb 9-15...\n');
    const propertiesWithWeeks = await sequelize.query(
      `SELECT DISTINCT tp.id, tp.name, tp.city, COUNT(wa.id) as weeks_count
       FROM timeshare_properties tp
       JOIN timeshare_units tu ON tu.property_id = tp.id
       JOIN ownerships o ON o.unit_id = tu.id
       JOIN week_allocations wa ON wa.ownership_id = o.id
       WHERE wa.start_date >= '2026-02-09' AND wa.start_date < '2026-02-16'
       GROUP BY tp.id, tp.name, tp.city
       ORDER BY weeks_count DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('Properties with allocations for Feb 9-15:', propertiesWithWeeks);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

find();
