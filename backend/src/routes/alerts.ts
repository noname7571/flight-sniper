import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { getAlerts, getAlertCount } from '../db';

const router = Router();

function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

// GET /api/alerts/count - get total alert count
router.get('/count', async (_req: Request, res: Response) => {
  const count = await getAlertCount();
  res.json({ count });
});

// GET /api/alerts - get alert history with pagination
router.get('/',
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be a non-negative integer'),
  async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const alerts = await getAlerts(limit, offset);
    res.json(alerts);
  }
);

export default router;
