/**
 * KAIROS DISPATCH CRON JOB
 * 
 * This API route scans for pending KAIROS_TRIGGER memories and executes
 * the appropriate actions (workflows, webhooks, notifications).
 * 
 * TRIGGER OPTIONS:
 * 1. External CRON service (Vercel Cron, cron-job.org, etc.)
 *    - GET /api/cron/kairos-dispatch
 * 
 * 2. Internal setInterval (less reliable in serverless)
 * 
 * 3. Triggered by external scheduler (n8n, Temporal, etc.)
 * 
 * SECURITY:
 * Requires CRON_SECRET header to prevent unauthorized execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runKairosDispatch } from '@/lib/memory/services/action-dispatcher';
import { env } from '@/lib/core/config/env';
import { createLogger } from '@sim/logger';

const logger = createLogger('KairosCron');

export async function GET(request: NextRequest) {
    // Verify CRON secret to prevent unauthorized execution
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || env.INTERNAL_API_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Unauthorized CRON attempt', {
            ip: request.headers.get('x-forwarded-for') || 'unknown'
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const startTime = Date.now();
        const results = await runKairosDispatch();
        const duration = Date.now() - startTime;

        const summary = {
            total: results.length,
            success: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success && r.action !== 'SKIPPED').length,
            skipped: results.filter(r => r.action === 'SKIPPED').length,
            duration_ms: duration,
        };

        logger.info('CRON :: Kairos dispatch completed', summary);

        return NextResponse.json({
            success: true,
            summary,
            results,
        });

    } catch (error) {
        logger.error('CRON :: Kairos dispatch failed', { error });

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

// POST method for webhook-triggered execution
export async function POST(request: NextRequest) {
    return GET(request);
}

// Vercel Cron config (if using Vercel)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution
