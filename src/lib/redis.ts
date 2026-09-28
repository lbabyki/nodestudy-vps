import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

if (!globalForRedis.redis) {
  globalForRedis.redis = new Redis({
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
  });

  globalForRedis.redis.on("error", (error) => {
    console.error("[Redis] Connection error:", error.message);
  });
}

export const redis = globalForRedis.redis;
