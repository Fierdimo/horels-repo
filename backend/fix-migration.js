const { Sequelize } = require('sequelize');
const config = require('./config/config.json').development;

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  logging: false
});

async function runMigration() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');

    console.log('\n📊 Verificando tabla SequelizeMeta...');
    const metas = await sequelize.query(`
      SELECT * FROM SequelizeMeta 
      WHERE name = '20251224-fix-room-type-id-nullable.js'
    `, { type: Sequelize.QueryTypes.SELECT });

    if (metas.length > 0) {
      console.log('⚠️  Migración ya está registrada como ejecutada');
      console.log('Removiendo registro para poder ejecutarla...');
      await sequelize.query(`
        DELETE FROM SequelizeMeta 
        WHERE name = '20251224-fix-room-type-id-nullable.js'
      `, { type: Sequelize.QueryTypes.DELETE });
    }

    console.log('\n🔧 Ejecutando migración manualmente...');
    
    const transaction = await sequelize.transaction();
    
    try {
      // Verificar si room_type_id ya permite NULL
      const results = await sequelize.query(`
        SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'rooms' 
        AND COLUMN_NAME = 'room_type_id';
      `, { type: Sequelize.QueryTypes.SELECT, transaction });

      if (results.length > 0 && results[0].IS_NULLABLE === 'YES') {
        console.log('✅ La columna room_type_id ya permite NULL');
      } else {
        console.log('Modificando columna room_type_id...');
        
        // Obtener constraints
        const constraints = await sequelize.query(`
          SELECT CONSTRAINT_NAME 
          FROM information_schema.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'rooms' 
          AND COLUMN_NAME = 'room_type_id' 
          AND REFERENCED_TABLE_NAME IS NOT NULL;
        `, { type: Sequelize.QueryTypes.SELECT, transaction });

        // Drop FK si existe
        if (constraints && constraints.length > 0) {
          const constraintName = constraints[0].CONSTRAINT_NAME;
          console.log(`Eliminando constraint: ${constraintName}`);
          await sequelize.query(
            `ALTER TABLE rooms DROP FOREIGN KEY ${constraintName};`,
            { type: Sequelize.QueryTypes.RAW, transaction }
          );
        }

        // Modificar columna
        await sequelize.query(
          `ALTER TABLE rooms MODIFY COLUMN room_type_id INT NULL;`,
          { type: Sequelize.QueryTypes.RAW, transaction }
        );

        // Re-crear FK
        await sequelize.query(`
          ALTER TABLE rooms 
          ADD CONSTRAINT rooms_room_type_id_fk 
          FOREIGN KEY (room_type_id) 
          REFERENCES room_types(id) 
          ON UPDATE CASCADE 
          ON DELETE SET NULL;
        `, { type: Sequelize.QueryTypes.RAW, transaction });

        console.log('✅ Columna modificada correctamente');
      }

      // Registrar migración como ejecutada
      await sequelize.query(`
        INSERT INTO SequelizeMeta (name) 
        VALUES ('20251224-fix-room-type-id-nullable.js');
      `, { type: Sequelize.QueryTypes.INSERT, transaction });

      await transaction.commit();
      console.log('✅ Migración completada y registrada');
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    await sequelize.close();
    console.log('\n✅ Script finalizado exitosamente');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
