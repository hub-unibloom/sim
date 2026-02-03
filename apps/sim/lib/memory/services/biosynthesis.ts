/**
 * CHESHIRE MEMORY SYSTEM - BioSynthesis Service
 * 
 * Autonomous persona synthesis system that:
 * - Tracks accumulated entropy from interactions
 * - Generates evolving user biographies via LLM
 * - Updates psychological profiles periodically
 */

import { sql } from '../db/postgres';
import OpenAI from 'openai';
import { env } from '@/lib/core/config/env';
import { createLogger } from '@sim/logger';

const logger = createLogger('CheshireBioSynthesis');

const METABOLIC_THRESHOLD = 5.0;

export class BioSynthesisService {
  private static ai: OpenAI | null = null;

  private static getAI(): OpenAI {
    if (!BioSynthesisService.ai) {
      BioSynthesisService.ai = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
    }
    return BioSynthesisService.ai;
  }

  public static async synthesizePersona(projectId: string, userUuid: string): Promise<void> {
    const userResult = await sql`
          SELECT 
            plano, 
            username,
            preferences->>'accumulated_entropy' as entropy_acc,
            preferences->>'last_synthesis_checkpoint' as checkpoint,
            interaction_rhythm_ms,
            (SELECT count(*) FROM memories WHERE user_uuid = ${userUuid} AND project_id = ${projectId}) as msg_count
          FROM cheshire_users 
          WHERE uuid = ${userUuid}
        `;

    if (userResult.length === 0) return;
    const user = userResult[0];

    // TODO: Adapt 'plano' check
    // if (user.plano !== 'premium') return;
    if (parseInt(user.msg_count) < 20) return;

    const currentEntropy = parseFloat(user.entropy_acc || '0');
    if (currentEntropy < METABOLIC_THRESHOLD) {
      return;
    }

    logger.info(`🧬 BIOSYNTHESIS :: ACTIVATED`, { projectId, userUuid, entropy: currentEntropy });

    const checkpointDate = user.checkpoint ? new Date(user.checkpoint) : new Date(0);

    const memories = await sql`
          SELECT id, semantic_text, timestamp, type, entropy
          FROM memories 
          WHERE user_uuid = ${userUuid} 
          AND project_id = ${projectId}
          AND timestamp > ${checkpointDate}
          ORDER BY timestamp ASC 
          LIMIT 50
        `;

    if (memories.length === 0) return;

    const rhythmMinutes = (user.interaction_rhythm_ms || 0) / (1000 * 60);
    let rhythmDescription = 'Indefinido';
    if (rhythmMinutes < 1) rhythmDescription = 'Frenético (Instantâneo)';
    else if (rhythmMinutes < 10) rhythmDescription = 'Ágil (Conversa Fluida)';
    else if (rhythmMinutes < 60) rhythmDescription = 'Pausado (Reflexivo)';
    else rhythmDescription = 'Esporádico (Assíncrono)';

    const narrativeStream = memories.map((m: any) =>
      `[${new Date(m.timestamp).toISOString()}] (${m.type}) ${m.semantic_text}`
    ).join('\n');

    const prompt = `
      ATUAR COMO: Biógrafo Cognitivo Sênior.
      ALVO: ${user.username || 'Usuário'}.
      
      OBJETIVO: Atualizar o 'User Persona' integrando os novos eventos à biografia existente.
      
      METADADOS PSICOLÓGICOS:
      - Ritmo Cognitivo Médio: ${rhythmDescription} (${Math.round(rhythmMinutes)} min/msg).
      
      DIRETRIZES:
      1. Integre os novos fatos à narrativa anterior (se houver).
      2. Destaque mudanças de humor ou interesse.
      3. Mantenha tom de terceira pessoa, clínico mas empático.
      
      NOVAS MEMÓRIAS (CRONOLÓGICAS):
      ${narrativeStream}
    `;

    try {
      const model = env.CHESHIRE_LLM_MODEL || 'gpt-4-turbo';
      const completion = await this.getAI().chat.completions.create({
        model,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      });

      const bio = completion.choices[0].message.content;
      const newCheckpoint = memories[memories.length - 1].timestamp;

      await sql`
                UPDATE users 
                SET 
                  preferences = jsonb_set(
                    jsonb_set(
                        jsonb_set(preferences, '{auto_biography}', ${JSON.stringify(bio)}),
                        '{accumulated_entropy}', '0'
                    ),
                    '{last_synthesis_checkpoint}', ${JSON.stringify(newCheckpoint)}
                  )
                WHERE uuid = ${userUuid}
            `;

      logger.info(`🦋 BIOSYNTHESIS :: EVOLUTION_COMPLETE`, { userUuid });

    } catch (error) {
      logger.error('BIOSYNTHESIS :: FAIL', { userUuid, error });
    }
  }
}
