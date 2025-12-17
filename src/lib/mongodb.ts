import { MongoClient } from "mongodb";
import { getServerEnv } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  if (!global.__mongoClientPromise) {
    const env = getServerEnv();
    const client = new MongoClient(env.MONGODB_URI);
    global.__mongoClientPromise = client.connect();
  }
  return global.__mongoClientPromise;
}

export async function getDb() {
  const env = getServerEnv();
  const client = await getClientPromise();
  return client.db(env.MONGODB_DB);
}
