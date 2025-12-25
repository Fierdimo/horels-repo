const fs = require('fs');
const path = require('path');

const migrationsDir = './migrations';
const filesToFix = [
  '20251225000003-create-seasonal-calendar.js',
  '20251225000004-create-user-credit-wallets.js',
  '20251225000005-create-credit-transactions.js',
  '20251225000006-create-credit-booking-costs.js',
  '20251225000007-create-ancillary-services.js',
  '20251225000008-create-booking-ancillary-services.js',
  '20251225000009-create-week-claim-requests.js',
  '20251225000010-create-inter-property-settlements.js',
  '20251225000011-create-setting-change-log.js',
  '20251225000012-modify-properties-for-credits.js',
];

console.log('🔧 Corrigiendo tipos de datos en migraciones...\n');

filesToFix.forEach(file => {
  const filePath = path.join(migrationsDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changesMade = 0;
  
  // Cambiar INTEGER.UNSIGNED a INTEGER para foreign keys a tablas existentes
  const replacements = [
    // properties
    { from: /property_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'property_id: {\n        type: Sequelize.INTEGER,' },
    { from: /from_property_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'from_property_id: {\n        type: Sequelize.INTEGER,' },
    { from: /to_property_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'to_property_id: {\n        type: Sequelize.INTEGER,' },
    
    // users
    { from: /user_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'user_id: {\n        type: Sequelize.INTEGER,' },
    { from: /owner_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'owner_id: {\n        type: Sequelize.INTEGER,' },
    { from: /created_by:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'created_by: {\n        type: Sequelize.INTEGER,' },
    { from: /changed_by:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'changed_by: {\n        type: Sequelize.INTEGER,' },
    { from: /reviewed_by:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'reviewed_by: {\n        type: Sequelize.INTEGER,' },
    
    // weeks
    { from: /week_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'week_id: {\n        type: Sequelize.INTEGER,' },
    
    // bookings
    { from: /booking_id:\s*{\s*type:\s*Sequelize\.INTEGER\.UNSIGNED,/g, to: 'booking_id: {\n        type: Sequelize.INTEGER,' },
    
    // Mantener UNSIGNED solo para IDs de tablas nuevas y service_id
    // service_id debe mantenerse como está porque es de ancillary_services (tabla nueva)
  ];
  
  replacements.forEach(({ from, to }) => {
    const before = content;
    content = content.replace(from, to);
    if (before !== content) {
      changesMade++;
    }
  });
  
  if (changesMade > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}: ${changesMade} cambios`);
  } else {
    console.log(`⏭️  ${file}: sin cambios`);
  }
});

console.log('\n✅ Corrección completada!');
