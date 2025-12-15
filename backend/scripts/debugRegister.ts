import request from 'supertest';
import app from '../src/app';

(async () => {
  try {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'debug-e2e@test.com',
        password: 'Password123!',
        roleName: 'guest'
      });

    console.log('Status:', res.status);
    console.log('Headers:', res.headers);
    console.log('Body:', JSON.stringify(res.body, null, 2));
  } catch (err) {
    console.error('Request error:', err);
  }
})();
