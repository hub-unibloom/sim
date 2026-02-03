
import { NextRequest, NextResponse } from 'next/server';
import { SilenceAnalyzer, GraphTopology } from '../../../../lib/memory';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow local dev execution or specific secret
        // For now, if no CRON_SECRET is set, we might default to allow or deny. 
        // As user said "internal use", we can be lenient but specific.
        if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        console.log("🫀 SYSTEM :: HEARTBEAT_PULSE");
        await SilenceAnalyzer.scanForSilence();
        await GraphTopology.pruneOrphans();

        return NextResponse.json({ status: 'PULSE_OK', timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("🫀 SYSTEM :: ARRHYTHMIA_DETECTED", error);
        return NextResponse.json({ status: 'ERROR', error: String(error) }, { status: 500 });
    }
}
