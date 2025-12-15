#!/usr/bin/env node

/**
 * PMS Sync Worker
 * Ejecuta sincronizaciones periódicas con los sistemas PMS
 * 
 * Uso:
 *   npm run worker:sync
 *   npm run worker:sync -- --interval 60000 --force
 */

import { pmsSyncWorker } from '../workers/pmsSyncWorker';

// Parse argumentos
const args = process.argv.slice(2);
let interval = 30 * 60 * 1000; // 30 minutos por defecto
let forceSync = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--interval' && args[i + 1]) {
    interval = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--force') {
    forceSync = true;
  }
}

console.log('=================================');
console.log('   PMS Sync Worker Starting');
console.log('=================================');
console.log(`Interval: ${interval}ms (${interval / 1000 / 60} minutes)`);
console.log(`Force sync: ${forceSync}`);
console.log('=================================\n');

// Iniciar worker
pmsSyncWorker.start(interval);

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, stopping worker...');
  pmsSyncWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, stopping worker...');
  pmsSyncWorker.stop();
  process.exit(0);
});

// Mantener el proceso activo
process.stdin.resume();
