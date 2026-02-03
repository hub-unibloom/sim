
import postgres from 'postgres';
import { env } from '../config/env';

class CascataDB {
    private static instance: postgres.Sql;

    private constructor() { }

    public static getInstance(): postgres.Sql {
        if (!CascataDB.instance) {
            CascataDB.instance = postgres(env.DATABASE_URL, {
                max: 20, // Max connection pool size
                idle_timeout: 30, // Close idle connections after 30s
                connect_timeout: 10,
            });
            console.log("🔌 CASCATA_DB :: CONNECTION_POOL_INITIALIZED");
        }
        return CascataDB.instance;
    }
}

export const sql = CascataDB.getInstance();
