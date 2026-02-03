
// Wrapper for redis. Currently a stub or using a basic redis client if available in sim.
// Sim doesn't seem to have a redis client in `db` package based on previous list.
// Creating a placeholder to satisfy Thalamus.
import { createClient } from 'redis'; // User will need to install if not present, or we mock.

const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.log('Redis Client Error', err));

if (!client.isOpen) {
    client.connect().catch(console.error);
}

export const redis = client;
