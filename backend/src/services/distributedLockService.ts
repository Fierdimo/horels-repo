/**
 * Distributed Lock Service
 * 
 * Usa Redis para coordinar acceso a recursos compartidos
 * Evita el "cache stampede" problema cuando múltiples requests
 * intentan obtener datos del PMS simultáneamente
 */

import Redis from 'ioredis';

// Parse REDIS_URL or use individual host/port
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: false,
  enableOfflineQueue: false
});

redis.on('error', (err) => {
  console.error('[DistributedLock] Redis error:', err);
});

redis.on('connect', () => {
  console.log('[DistributedLock] Connected to Redis');
});

export class DistributedLockService {
  /**
   * Ejecutar una función con lock distribuido
   * Solo una ejecución simultánea por key, las demás esperan
   */
  static async executeWithLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options: {
      lockTTL?: number; // Time to live del lock en ms (default: 30s)
      waitTimeout?: number; // Tiempo máximo para esperar el lock en ms (default: 60s)
      pollInterval?: number; // Intervalo de polling en ms (default: 100ms)
    } = {}
  ): Promise<T> {
    const {
      lockTTL = 30000, // 30 segundos
      waitTimeout = 60000, // 60 segundos
      pollInterval = 100 // 100ms
    } = options;

    const lockId = `${lockKey}:${Date.now()}:${Math.random()}`;
    const redisLockKey = `lock:${lockKey}`;
    const redisDataKey = `data:${lockKey}`;

    try {
      // Intentar adquirir el lock
      const acquired = await redis.set(
        redisLockKey,
        lockId,
        'PX', // Expiración en milisegundos
        lockTTL,
        'NX' // Solo si NO existe
      );

      if (acquired === 'OK') {
        // Lock adquirido, ejecutar función
        console.log(`[DistributedLock] Lock acquired for ${lockKey}`);
        
        try {
          const result = await fn();
          
          // Guardar resultado en Redis para que otros lo usen
          await redis.setex(
            redisDataKey,
            Math.floor(lockTTL / 1000),
            JSON.stringify(result)
          );
          
          console.log(`[DistributedLock] Lock released for ${lockKey}`);
          return result;
        } finally {
          // Liberar el lock (solo si seguimos siendo dueños)
          const currentLockId = await redis.get(redisLockKey);
          if (currentLockId === lockId) {
            await redis.del(redisLockKey);
          }
        }
      } else {
        // Lock no adquirido, esperar a que otro complete
        console.log(`[DistributedLock] Waiting for lock ${lockKey}`);
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < waitTimeout) {
          // Verificar si los datos están disponibles
          const cachedData = await redis.get(redisDataKey);
          if (cachedData) {
            console.log(`[DistributedLock] Using data from lock waiter for ${lockKey}`);
            return JSON.parse(cachedData);
          }

          // El lock todavía existe, esperar
          const lockExists = await redis.exists(redisLockKey);
          if (!lockExists) {
            // El lock fue liberado pero aún no hay datos (puede ser error)
            // Esperar un poco más
            await this.delay(pollInterval);
            const cachedData = await redis.get(redisDataKey);
            if (cachedData) {
              return JSON.parse(cachedData);
            }
            // Si no hay datos después de esperar, intentar de nuevo el lock
            break;
          }

          // Esperar antes de re-chequear
          await this.delay(pollInterval);
        }

        // Timeout esperando el lock, intentar ejecutar localmente
        console.log(`[DistributedLock] Timeout waiting for ${lockKey}, executing locally`);
        return await fn();
      }
    } catch (error: any) {
      console.error(`[DistributedLock] Error with lock ${lockKey}:`, error);
      // En caso de error con Redis, ejecutar localmente
      return await fn();
    }
  }

  /**
   * Invalidar caché manualmente
   */
  static async invalidateCache(lockKey: string): Promise<void> {
    try {
      const redisDataKey = `data:${lockKey}`;
      await redis.del(redisDataKey);
      console.log(`[DistributedLock] Cache invalidated for ${lockKey}`);
    } catch (error: any) {
      console.error(`[DistributedLock] Error invalidating cache ${lockKey}:`, error);
    }
  }

  /**
   * Helper para delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtener estado del Redis
   */
  static async getStatus(): Promise<{ connected: boolean; error?: string }> {
    try {
      const pong = await redis.ping();
      return { connected: pong === 'PONG' };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }
}

export default DistributedLockService;
