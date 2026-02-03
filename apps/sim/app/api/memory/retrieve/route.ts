
import { NextRequest, NextResponse } from 'next/server';
import { OracleCore } from '@/lib/memory/oracle';
import { z } from 'zod';
// import { auth } from '@/auth'; // Assuming better-auth setup, but OracleCore needs userUuid directly for now.

const retrieveSchema = z.object({
    query: z.string(),
    userUuid: z.string(), // In real auth, this comes from session
    projectId: z.string(),
    affect: z.object({
        joy: z.number().default(0),
        trust: z.number().default(0),
        fear: z.number().default(0),
        surprise: z.number().default(0),
        sadness: z.number().default(0),
        disgust: z.number().default(0),
        anger: z.number().default(0),
        anticipation: z.number().default(0),
        arousal: z.number().default(0.5)
    }).optional()
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { query, userUuid, projectId, affect } = retrieveSchema.parse(body);

        const defaultAffect = {
            joy: 0, trust: 0, fear: 0,
            surprise: 0, sadness: 0, disgust: 0,
            anger: 0, anticipation: 0, arousal: 0.5
        };

        const result = await OracleCore.retrieveContext(
            projectId,
            userUuid,
            query,
            affect || defaultAffect
        );

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Memory Retrieval Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
