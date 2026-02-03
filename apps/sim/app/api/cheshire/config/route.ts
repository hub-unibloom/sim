
import { sql } from '@/lib/memory/db/postgres';
import { getSession } from '@/lib/auth'; // Adjust import based on your auth setup
import { NextResponse } from 'next/server';
import { z } from 'zod';

const configSchema = z.object({
    interaction_rhythm_ms: z.number().min(1000).max(86400000 * 7), // Min 1s, Max 7 days
    preferences: z.object({
        allow_proactive: z.boolean().optional(),
    }).optional()
});

export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

        const [userConfig] = await sql`
            SELECT interaction_rhythm_ms, preferences 
            FROM cheshire_users 
            WHERE uuid = ${session.user.id}::uuid
        `;

        if (!userConfig) {
            // Return defaults if not found (or create on fly logic if preferred)
            return NextResponse.json({
                interaction_rhythm_ms: 86400000,
                preferences: { allow_proactive: true }
            });
        }

        return NextResponse.json(userConfig);
    } catch (error) {
        console.error("Cheshire Config GET Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

        const body = await req.json();
        const { interaction_rhythm_ms, preferences } = configSchema.parse(body);

        // Dynamic update building
        if (interaction_rhythm_ms) {
            await sql`
                UPDATE cheshire_users 
                SET interaction_rhythm_ms = ${interaction_rhythm_ms}
                WHERE uuid = ${session.user.id}::uuid
            `;
        }

        if (preferences) {
            // Merging JSONB is tricky safely in raw SQL string interpolation depending on driver, 
            // but here we replace specific keys or the whole object if simple.
            // Using our helper function for clean merge if desired, or simple raw updates.
            // For now, let's assume we update the specific keys inside.

            // Simple approach: update the whole preferences object merging in memory or using jsonb_set
            // Utilizing the previously defined helper: jsonb_merge if available, else standard postgres

            await sql`
                UPDATE cheshire_users 
                SET preferences = preferences || ${JSON.stringify(preferences)}::jsonb
                WHERE uuid = ${session.user.id}::uuid
             `;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Cheshire Config PATCH Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
