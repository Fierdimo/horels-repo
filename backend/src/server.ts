import * as dotenv from 'dotenv';
dotenv.config();
import app from './app';
import { initCreditExpirationWorker } from './workers/creditExpirationWorker';

const PORT: string | number = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize credit expiration worker (runs daily at 2 AM UTC)
  initCreditExpirationWorker();
  console.log('Credit expiration worker initialized');
});