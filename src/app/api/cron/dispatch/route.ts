// LEGACY cron: dispatches groups based on the schedule_hours field on dispatch_groups.
// The new automation system (automation_rules table) uses /api/cron/automation instead.
// Keep this route for backward compatibility — do NOT delete or modify existing behavior.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatchGroup } from '@/lib/dispatch';

// Vercel cron secret to prevent unauthorized calls
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret — fail-secure: if CRON_SECRET is not set, deny all
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentHour = new Date().getHours(); // 0-23 in UTC
  const brtHour = (currentHour - 3 + 24) % 24; // Convert UTC to BRT

  // Find all active groups scheduled for this hour
  const { data: groups } = await supabaseAdmin
    .from('dispatch_groups')
    .select('*')
    .eq('is_active', true)
    .contains('schedule_hours', [brtHour]);

  if (!groups || groups.length === 0) {
    return NextResponse.json({ ok: true, message: `No groups scheduled for ${brtHour}h BRT` });
  }

  const results = [];
  for (const group of groups) {
    // Get destinations for this group
    const { data: destinations } = await supabaseAdmin
      .from('group_destinations')
      .select('*')
      .eq('group_id', group.id);

    if (!destinations || destinations.length === 0) continue;

    try {
      const result = await dispatchGroup(group, destinations);
      results.push(result);
    } catch (err) {
      results.push({
        groupId: group.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, hour: brtHour, results });
}
