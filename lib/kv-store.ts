/**
 * KV store abstraction.
 * - Uses Upstash Redis when UPSTASH_REDIS_REST_URL is configured (Vercel production).
 * - Falls back to in-memory Map for local development.
 */

import { Redis } from "@upstash/redis";

interface KVStore {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

function createUpstashStore(): KVStore {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return {
    async get<T = string>(key: string): Promise<T | null> {
      return redis.get<T>(key);
    },
    async set(key: string, value: unknown, ttlSeconds?: number) {
      if (ttlSeconds) {
        await redis.set(key, value, { ex: ttlSeconds });
      } else {
        await redis.set(key, value);
      }
    },
    async del(key: string) {
      await redis.del(key);
    },
  };
}

const memoryStore = new Map<string, { value: unknown; expiry?: number }>();

function createMemoryStore(): KVStore {
  return {
    async get<T = string>(key: string): Promise<T | null> {
      const entry = memoryStore.get(key);
      if (!entry) return null;
      if (entry.expiry && Date.now() > entry.expiry) {
        memoryStore.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set(key: string, value: unknown, ttlSeconds?: number) {
      memoryStore.set(key, {
        value,
        expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      });
    },
    async del(key: string) {
      memoryStore.delete(key);
    },
  };
}

const useUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

export const kv: KVStore = useUpstash
  ? createUpstashStore()
  : createMemoryStore();

export const isRemoteKV = useUpstash;
