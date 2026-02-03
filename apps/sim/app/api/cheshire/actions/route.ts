
import { sql } from '@/lib/memory/db/postgres';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        const actions = await sql`
            SELECT id, action_type, status, trigger_content, created_at, project_id, payload
            FROM cheshire_actions
            WHERE user_uuid = ${session.user.id}::uuid
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        return NextResponse.json({ actions });
    } catch (error) {
        console.error("Cheshire Actions GET Error:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
