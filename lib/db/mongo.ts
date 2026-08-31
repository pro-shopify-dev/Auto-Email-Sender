import { MongoClient, type Db } from "mongodb";
import { env } from "@/lib/env";

/**
 * Cached MongoClient. In development, Next.js clears the module cache on HMR, which would
 * otherwise open a new connection pool on every change and exhaust the server. We stash the
 * client promise on `globalThis` to reuse it across reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(env.mongoUri, {
    maxPoolSize: 10,
    retryWrites: true,
  });
  return client.connect();
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!global.__mongoClientPromise) {
      global.__mongoClientPromise = createClientPromise();
    }
    return global.__mongoClientPromise;
  }
  // In production a module-scoped singleton is sufficient.
  if (!prodClientPromise) {
    prodClientPromise = createClientPromise();
  }
  return prodClientPromise;
}

let prodClientPromise: Promise<MongoClient> | undefined;

export async function getClient(): Promise<MongoClient> {
  return getClientPromise();
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(env.mongoDb);
}
