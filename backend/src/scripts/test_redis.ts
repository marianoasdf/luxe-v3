#!/usr/bin/env node
// test_redis.ts
// Test de conexión y operaciones básicas de Redis

import dotenv from 'dotenv';
import { getRedisClient } from '../config/redisClient.js';

dotenv.config();

async function main(): Promise<void> {
  try {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.error('[test-redis] Falta REDIS_URL en .env');
      process.exit(1);
    }

    const client = getRedisClient();
    if (!client) {
      console.error('[test-redis] No se pudo crear cliente Redis');
      process.exit(1);
    }

    // PING
    const pong = await client.ping();
    console.log('[test-redis] PING ->', pong);

    // SET/GET
    const key = 'luxe:test:' + Date.now();
    const value = 'ok';
    await client.set(key, value, { EX: 10 });
    const got = await client.get(key);
    console.log('[test-redis] GET ->', got);

    if (got !== value) {
      console.error('[test-redis] Valor inesperado');
      process.exit(1);
    }

    console.log('[test-redis] Éxito ✅');
    await client.quit();
    process.exit(0);
  } catch (err: unknown) {
    console.error('[test-redis] Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
