import { sql } from '../db/postgres';
import { createLogger } from '@sim/logger';
import { CheshireProject } from '../types';

const logger = createLogger('CheshireActionDispatch');

export interface ActionTrigger {
    type: string;        // e.g., 'BANK_TRANSFER', 'SCHEDULE_REMINDER'
    confidence: number;  // 0.0 to 1.0
    parameters: any;     // Extracted entities (amount, date, recipient)
    rationale: string;   // Why this action was triggered
}

export interface PendingAction {
    id: string;
    project_id: string;
    user_uuid: string;
    type: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
    payload: any;
    priority: number;
    created_at: Date;
    expires_at?: Date;
}

export class ActionDispatcher {

    /**
     * Analyzes a new memory to detect if it triggers any latent actions.
     * Use regex heuristics for speed, or LLM for complex intent.
     */
    public static async detectAndDispatch(
        projectId: string,
        userUuid: string,
        memoryContent: string
    ): Promise<PendingAction[]> {

        const triggers: ActionTrigger[] = [];

        // 1. Heuristic Detection (Fast Layer)
        // Example: "Transfer 50 to John"
        if (memoryContent.match(/transfer|pix|pagar/i) && memoryContent.match(/\d+/)) {
            triggers.push({
                type: 'FINANCIAL_OPERATION',
                confidence: 0.85,
                parameters: { raw_text: memoryContent },
                rationale: 'Keywords detected: financial verbs + digits'
            });
        }

        // Example: "Lembre-me de..."
        if (memoryContent.match(/lembre|agende|reunião/i)) {
            triggers.push({
                type: 'SCHEDULING',
                confidence: 0.9,
                parameters: { raw_text: memoryContent },
                rationale: 'Keywords detected: scheduling verbs'
            });
        }

        if (triggers.length === 0) return [];

        // 2. Persist Actions
        const createdActions: PendingAction[] = [];

        for (const trigger of triggers) {
            const newId = crypto.randomUUID();
            const actionEntry = {
                id: newId,
                project_id: projectId,
                user_uuid: userUuid,
                type: trigger.type,
                status: 'PENDING',
                payload: trigger.parameters,
                priority: trigger.confidence > 0.9 ? 10 : 5,
                created_at: new Date() // handled by DB default usually, but explicit here
            };

            // Assuming 'cheshire_actions' table exists (Action plan: Create migration for this)
            try {
                await sql`
                    INSERT INTO cheshire_actions 
                    (id, project_id, user_uuid, type, status, payload, priority, created_at)
                    VALUES 
                    (${newId}, ${projectId}, ${userUuid}, ${trigger.type}, 'PENDING', ${trigger.parameters}, ${actionEntry.priority}, NOW())
                `;

                logger.info(`⚡ ACTION_DISPATCH :: Registered ${trigger.type}`, { projectId, actionId: newId });

                createdActions.push(actionEntry as any);
            } catch (e) {
                logger.error(`ACTION_DISPATCH :: Failed to persist action`, { error: e });
            }
        }

        return createdActions;
    }

    /**
     * Retrieve pending actions for the UI/API to consume.
     */
    public static async getPendingActions(projectId: string, userUuid: string): Promise<PendingAction[]> {
        try {
            return await sql`
                SELECT * FROM cheshire_actions
                WHERE project_id = ${projectId}
                AND user_uuid = ${userUuid}
                AND status = 'PENDING'
                ORDER BY priority DESC, created_at ASC
            ` as unknown as PendingAction[];
        } catch (e) {
            return [];
        }
    }
}
