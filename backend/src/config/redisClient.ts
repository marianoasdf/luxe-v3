import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export function getRedisClient(): RedisClientType | null {
  if (client) return client;

  const url = process.env.REDIS_URL ?? null;
  if (!url) {
    console.warn('[redis] REDIS_URL no definido, modo fallback sin Redis');
    return null;
  }

  client = createClient({ url }) as RedisClientType;

  client.on('error', (err: Error) => console.error('[redis] Error', err));

  client
    .connect()
    .then(() => console.log('[redis] Conectado'))
    .catch((err: Error) => console.error('[redis] Falló conexión inicial', err));

  return client;
}
