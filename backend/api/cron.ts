import { VercelRequest, VercelResponse } from '@vercel/node';
import { runAllChecks } from '../src/scheduler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Triggered price check');
  try {
    await runAllChecks();
    res.json({ status: 'ok', checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Cron] Failed:', error);
    res.status(500).json({ error: 'Price check failed' });
  }
}
