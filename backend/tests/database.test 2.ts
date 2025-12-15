import sequelize from '../src/config/database';

describe('Database Connection', () => {
  it('should connect to the database successfully', async () => {
    try {
      await sequelize.authenticate();
      expect(true).toBe(true); // If no error, test passes
    } catch (error) {
      throw new Error('Database connection failed: ' + error.message);
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });
});