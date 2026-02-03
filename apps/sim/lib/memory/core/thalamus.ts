import { redis } from '../db/redis';
import { sql } from '../db/postgres';

export class ThalamusCore {

  private static generatePacketHash(content: string, timestamp: string, metadata: any): string {
    const timeWindow = new Date(timestamp).setMilliseconds(0);
    const context = `${metadata.user?.uuid}|${metadata.channel}|${metadata.group?.id_group || 'private'}`;
    const payload = `${content}::${timeWindow}::${context}`;
    const { createHash } = require('node:crypto');
    return createHash('sha256').update(payload).digest('hex');
  }

  public static async processIngestion(packet: any): Promise<{ accepted: boolean, hash: string, reason?: string, packetId?: string }> {
    const hash = this.generatePacketHash(packet.semantic_text, packet.metadata.timestamp, packet.metadata);

    const isCached = await redis.get(`thalamus:hash:${hash}`);
    if (isCached) {
      return { accepted: false, hash, reason: 'IDEMPOTENT_REJECTION_HOT' };
    }

    const existing = await sql`
      SELECT packet_hash FROM ingestion_logs WHERE packet_hash = ${hash} LIMIT 1
    `;

    if (existing.length > 0) {
      await redis.set(`thalamus:hash:${hash}`, '1', 'EX', 3600);
      return { accepted: false, hash, reason: 'IDEMPOTENT_REJECTION_COLD' };
    }

    const packetId = crypto.randomUUID();
    try {
      // Note: Table ingestion_logs not yet in Schema. Need to add it.
      await sql`
        INSERT INTO ingestion_logs (
          packet_hash, packet_id, status, semantic_summary, origin_channel, entropy_delta
        ) VALUES (
          ${hash}, ${packetId}, 'PENDING', 
          ${packet.semantic_text.substring(0, 100)}, 
          ${packet.metadata.channel}, 0.0
        )
      `;

      await redis.set(`thalamus:hash:${hash}`, '1', 'EX', 3600);

      return { accepted: true, hash, packetId };

    } catch (error) {
      console.error("THALAMUS :: PERSISTENCE_ERROR", error);
      throw new Error("Failed to persist ingestion log");
    }
  }

  public static async completeProcessing(hash: string, status: 'PROCESSED' | 'FAILED') {
    await sql`
      UPDATE ingestion_logs SET status = ${status} WHERE packet_hash = ${hash}
    `;
  }
}
