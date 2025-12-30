const { Sequelize } = require('sequelize');
const config = require('./config/config.json');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    dialect: dbConfig.dialect,
    logging: false
  }
);

async function checkTable() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('owner_invitations');
    
    console.log('\nColumnas de owner_invitations:');
    console.log('================================');
    
    Object.keys(tableInfo).forEach(column => {
      const info = tableInfo[column];
      console.log(`${column}: ${info.type} ${info.allowNull ? '(nullable)' : '(not null)'}`);
    });
    
    const hasWeeksData = 'weeks_data' in tableInfo;
    const hasRoomsData = 'rooms_data' in tableInfo;
    const hasAcceptanceType = 'acceptance_type' in tableInfo;
    const hasPropertyId = 'property_id' in tableInfo;
    
    console.log('\n================================');
    console.log('Estado:');
    console.log(`- weeks_data existe: ${hasWeeksData}`);
    console.log(`- rooms_data existe: ${hasRoomsData}`);
    console.log(`- property_id existe: ${hasPropertyId}`);
    console.log(`- acceptance_type existe: ${hasAcceptanceType}`);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkTable();
