import { sql } from '../db/postgres';
import { env } from '../config/env';

interface AttentionBid {
    priority: number;
    strategy: 'REENGAGEMENT_GENTLE' | 'KEEP_ALIVE_CRITICAL' | 'KAIROS_EVENT';
    suggestion: string;
}

export class SilenceAnalyzer {

    public static async scanForSilence() {
        if (!env.N8N_WEBHOOK_URL) {
            return;
        }

        // Adapt cursor usage for different driver if needed, but postgres.js supports .cursor
        await sql`
      SELECT uuid, interaction_rhythm_ms, last_interaction, preferences, username,
             (preferences->>'last_proactive_attempt')::timestamp as last_attempt
      FROM users
      WHERE COALESCE((preferences->>'allow_proactive')::boolean, TRUE) IS TRUE
    `.cursor(100, async (rows: any[]) => {

            const now = new Date();

            for (const user of rows) {
                const lastSeen = new Date(user.last_interaction);
                const lastAttempt = user.last_attempt ? new Date(user.last_attempt) : new Date(0);

                const msSinceLastUserMsg = now.getTime() - lastSeen.getTime();
                const hoursSinceLastUserMsg = msSinceLastUserMsg / (1000 * 60 * 60);
                const hoursSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60 * 60);

                if (hoursSinceLastAttempt < 20 && hoursSinceLastUserMsg < 23) continue;

                let winningBid: AttentionBid | null = null;

                if (hoursSinceLastUserMsg >= 23.5 && hoursSinceLastUserMsg < 24.5) {
                    if (hoursSinceLastAttempt < 1) continue;
                    winningBid = {
                        priority: 10,
                        strategy: 'KEEP_ALIVE_CRITICAL',
                        suggestion: 'URGENT: Session closing. Send context-relevant reaction.'
                    };
                }
                else if (hoursSinceLastUserMsg >= 14 && hoursSinceLastUserMsg < 20) {
                    if (hoursSinceLastAttempt < 24) continue;
                    winningBid = {
                        priority: 5,
                        strategy: 'REENGAGEMENT_GENTLE',
                        suggestion: 'User silent. Check open threads casually.'
                    };
                }

                if (winningBid) {
                    await SilenceAnalyzer.executeProactiveContact(user.uuid, winningBid, hoursSinceLastUserMsg);
                }
            }
        });
    }

    private static async executeProactiveContact(userUuid: string, bid: AttentionBid, hoursSilent: number) {
        console.log(`📣 KAIROS :: WINNING_BID [${userUuid}] -> ${bid.strategy}`);

        await sql`
      UPDATE users 
      SET preferences = jsonb_set(preferences, '{last_proactive_attempt}', to_jsonb(NOW()))
      WHERE uuid = ${userUuid}
    `;

        try {
            await sql`
            INSERT INTO memories (
                user_uuid, semantic_text, type, timestamp, raw_content, entropy
            ) VALUES (
                ${userUuid}, 
                ${`KAIROS_TRIGGER: System initiated ${bid.strategy} protocol due to ${Math.floor(hoursSilent)}h silence.`},
                'SEMANTIC',
                NOW(),
                ${JSON.stringify({
                type: 'KAIROS_TRIGGER',
                status: 'PENDING',
                strategy: bid.strategy,
                urgency: bid.priority,
                suggestion: bid.suggestion
            })},
                0.1
            )
        `;
        } catch (err) {
            console.error("KAIROS :: MEMORY_INSERT_FAILED", err);
        }

        try {
            await fetch(env.N8N_WEBHOOK_URL!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'PROACTIVE_TRIGGER',
                    user_uuid: userUuid,
                    strategy: bid.strategy,
                    urgency: bid.priority,
                    context: {
                        hours_silent: hoursSilent,
                        suggestion: bid.suggestion
                    },
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error("KAIROS :: WEBHOOK_FAILED", error);
        }
    }
}
