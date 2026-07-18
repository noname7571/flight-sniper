// Vercel serverless entry point
// This re-exports the Express app as a Vercel serverless function

// NOTE: On Vercel, the scheduler (cron) does NOT run automatically.
// Instead, use Vercel Cron Jobs (configured in vercel.json) to trigger
// the /api/cron endpoint periodically.

import { app } from '../backend/src/app';

export default app;
