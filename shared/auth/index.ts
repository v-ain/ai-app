import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/shared/db";
import { redis } from "@/shared/redis";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:8080",
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  secondaryStorage: {
    get: async (key) => await redis.get(key),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, "EX", ttl);
      else await redis.set(key, value);
    },
    delete: async (key) => {
      await redis.del(key);
    },
    getAndDelete: async (key) => {
      return await redis.getdel(key);
    },
    increment: async (key, ttl) => {
      const val = await redis.incr(key);
      if (ttl && val === 1) {
        await redis.expire(key, ttl);
      }
      return val;
    },
  },
});
