/**
 * CHESHIRE MEMORY SYSTEM - Thalamus Core
 * 
 * Consciousness checkpoint system that:
 * - Filters duplicate ingestion via idempotency hashing
 * - Uses Redis for hot cache and Postgres for cold storage
 * - Manages packet lifecycle state transitions
 */

import { getRedis } from '../db/redis';
import { sql } from '../db/postgres';
import { createHash } from 'node:crypto';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireThalamus');

interface IngestionPacketMetadata {
  user?: { uuid: string };
  channel: string;
  group?: { id_group: string };
  timestamp: string;
}

interface ProcessingResult {
  accepted: boolean;
  hash: string;
  reason?: string;
  packetId?: string;
}

export class ThalamusCore {

  private static generatePacketHash(content: string, timestamp: string, metadata: IngestionPacketMetadata): string {
    const timeWindow = new Date(timestamp).setMilliseconds(0);
    const context = `${metadata.user?.uuid}|${metadata.channel}|${metadata.group?.id_group || 'private'}`;
    const payload = `${content}::${timeWindow}::${context}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  public static async processIngestion(packet: { semantic_text: string; metadata: IngestionPacketMetadata }): Promise<ProcessingResult> {
    const hash = this.generatePacketHash(packet.semantic_text, packet.metadata.timestamp, packet.metadata);

    // Get Redis client (lazy init)
    const redis = await getRedis();

    // Hot cache check
    const isCached = await redis.get(`thalamus:hash:${hash}`);
    if (isCached) {
      return { accepted: false, hash, reason: 'IDEMPOTENT_REJECTION_HOT' };
    }

    // Cold storage check
    const existing = await sql`
          SELECT packet_hash FROM ingestion_logs WHERE packet_hash = ${hash} LIMIT 1
        `;

    if (existing.length > 0) {
      await redis.set(`thalamus:hash:${hash}`, '1', { EX: 3600 });
      return { accepted: false, hash, reason: 'IDEMPOTENT_REJECTION_COLD' };
    }

    const packetId = crypto.randomUUID();
    try {
      await sql`
                INSERT INTO ingestion_logs (
                    packet_hash, packet_id, status, semantic_summary, origin_channel, entropy_delta
                ) VALUES (
                    ${hash}, ${packetId}, 'PENDING', 
                    ${packet.semantic_text.substring(0, 100)}, 
                    ${packet.metadata.channel}, 0.0
                )
            `;

      await redis.set(`thalamus:hash:${hash}`, '1', { EX: 3600 });

      logger.debug('🧠 THALAMUS :: PACKET_ACCEPTED', { hash: hash.substring(0, 12), packetId });
      return { accepted: true, hash, packetId };

    } catch (error) {
      logger.error('THALAMUS :: PERSISTENCE_ERROR', { error });
      throw new Error('Failed to persist ingestion log');
    }
  }

  public static async completeProcessing(hash: string, status: 'PROCESSED' | 'FAILED'): Promise<void> {
    await sql`
          UPDATE ingestion_logs SET status = ${status} WHERE packet_hash = ${hash}
        `;
    logger.debug('🧠 THALAMUS :: PROCESSING_COMPLETE', { hash: hash.substring(0, 12), status });
  }
}
