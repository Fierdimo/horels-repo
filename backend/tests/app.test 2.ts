import request from 'supertest';
import app from '../src/app';

describe('App', () => {
  it('should return welcome message on GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'SW2 Backend API' });
  });
});