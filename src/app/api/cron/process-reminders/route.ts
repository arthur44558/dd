import { NextRequest, NextResponse } from 'next/server';
import { evaluateOverdueFollowUps, DEFAULT_HOSPITAL_TIMEZONE } from '@/features/reminders/overdue-engine';
import { processDueReminderJobs } from '@/features/reminders/processor';

export const dynamic = 'force-dynamic';

/**
 * Scheduled Cron Worker for Overdue Transitions and Reminder Job Processing.
 *
 * Auth:
 * Protected by CRON_SECRET via Bearer token, x-cron-secret header, or ?secret= query parameter.
 *
 * Core operations:
 * 1. Confirmed Overdue Engine: transitions follow-ups whose appointment has passed to OVERDUE,
 *    and generates exactly two overdue text tasks (+2 and +4 calendar days in Asia/Kolkata).
 * 2. Durable Queue Processor: Claims pending due jobs using FOR UPDATE SKIP LOCKED
 *    with a max 3-retry cap, materializing coordinator communication tasks.
 */
export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  // 1. Verify CRON_SECRET
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret) {
    const authHeader = request.headers.get('authorization');
    const headerSecret = request.headers.get('x-cron-secret');
    const querySecret = request.nextUrl.searchParams.get('secret');

    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : null;

    const providedSecret = bearerToken || headerSecret || querySecret;

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or missing cron secret' },
        { status: 401 }
      );
    }
  }

  try {
    // 2. Evaluate Overdue Follow-ups in Asia/Kolkata hospital timezone
    const overdueResult = await evaluateOverdueFollowUps(DEFAULT_HOSPITAL_TIMEZONE);

    // 3. Process Due Reminder Jobs with FOR UPDATE SKIP LOCKED and max 3-retry cap
    const jobResult = await processDueReminderJobs(50, 'cron-api-worker');

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        hospitalTimezone: DEFAULT_HOSPITAL_TIMEZONE,
        overdueEvaluation: overdueResult,
        jobProcessing: jobResult,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[CRON process-reminders] Execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal cron processing error',
      },
      { status: 500 }
    );
  }
}
