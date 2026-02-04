const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

async function fixStaffProperty() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    const queryInterface = sequelize.getQueryInterface();

    // Find staff users
    const staffUsers = await sequelize.models.User?.findAll({
      where: { role: 'staff' },
      raw: true
    }) || [];

    // If no User model, query directly
    if (staffUsers.length === 0) {
      const [users] = await sequelize.query(`SELECT * FROM users WHERE role = 'staff'`, {
        type: sequelize.QueryTypes.SELECT
      });
      staffUsers.push(...(Array.isArray(users) ? users : [users]));
    }

    console.log(`📋 Found ${staffUsers.length} staff user(s)\n`);
    
    if (staffUsers.length === 0) {
      console.log('No staff users found in database');
      return;
    }

    // Show current state
    staffUsers.forEach(user => {
      const status = user.property_id ? `✅ Has property_id: ${user.property_id}` : '❌ NO property_id';
      console.log(`  ${user.email} - ${status}`);
    });

    const staffWithoutProperty = staffUsers.filter(u => !u.property_id);

    if (staffWithoutProperty.length === 0) {
      console.log('\n✅ All staff users already have property_id assigned');
      return;
    }

    console.log(`\n🔧 Need to fix: ${staffWithoutProperty.length} user(s)`);

    // Find first timeshare property  
    const property = await sequelize.query(
      `SELECT id, name, city FROM timeshare_properties LIMIT 1`,
      { type: sequelize.QueryTypes.SELECT }
    ).then(rows => rows[0]);

    if (!property) {
      console.error('\n❌ No timeshare properties found in database!');
      console.log('\n💡 Create a property first using admin panel or SQL');
      return;
    }

    console.log(`\n➡️  Will assign property: ${property.name} (${property.city}) - ID: ${property.id}`);

    // Update staff users
    for (const user of staffWithoutProperty) {
      await sequelize.query(
        `UPDATE users SET property_id = ${property.id} WHERE id = ${user.id}`
      );
      console.log(`   ✅ Updated: ${user.email}`);
    }

    console.log('\n✅ All staff users now have property_id assigned!');
    console.log('\n💡 IMPORTANT: Log out and log in again for changes to take effect');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

fixStaffProperty();
