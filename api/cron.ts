// Vercel Cron Job handler
// This is invoked by Vercel Cron Jobs to trigger price checks

import { VercelRequest, VercelResponse } from '@vercel/node';
import { runAllChecks } from '../backend/src/scheduler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify the cron secret to prevent unauthorized invocations
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Triggered price check via Vercel Cron Job');
  try {
    await runAllChecks();
    res.json({ status: 'ok', checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Cron] Price check failed:', error);
    res.status(500).json({ error: 'Price check failed', message: String(error) });
  }
}
