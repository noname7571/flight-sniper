import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  getPriceHistory,
  MonitoredRoute,
} from '../db';

const router = Router();

// Validation helpers
const IATA_REGEX = /^[A-Z]{3}$/;
const DISCORD_WEBHOOK_REGEX = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+$/;
const ALLOWED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CZK', 'HUF', 'PLN'];

function validateIATA(value: string): boolean {
  return IATA_REGEX.test(value);
}

// Validation middleware for creating/updating routes
const routeValidation = [
  body('origin')
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('origin must be a 3-letter IATA code')
    .isAlpha().withMessage('origin must contain only letters')
    .custom((value: string) => validateIATA(value.toUpperCase())).withMessage('origin must be a valid IATA code'),
  body('destination')
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('destination must be a 3-letter IATA code')
    .isAlpha().withMessage('destination must contain only letters')
    .custom((value: string) => validateIATA(value.toUpperCase())).withMessage('destination must be a valid IATA code')
    .custom((value: string, { req }) => {
      if (value.toUpperCase() === (req.body.origin || '').toUpperCase()) {
        throw new Error('origin and destination cannot be the same');
      }
      return true;
    }),
  body('max_price')
    .isFloat({ min: 1, max: 99999 }).withMessage('max_price must be between 1 and 99999'),
  body('currency')
    .optional()
    .isIn(ALLOWED_CURRENCIES).withMessage(`currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`),
  body('email')
    .optional({ values: 'null' })
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail(),
  body('discord_webhook')
    .optional({ values: 'null' })
    .matches(DISCORD_WEBHOOK_REGEX).withMessage('discord_webhook must be a valid Discord webhook URL'),
  body('check_interval_minutes')
    .optional()
    .isIn([15, 30, 60, 120, 360, 720, 1440]).withMessage('check_interval_minutes must be 15, 30, 60, 120, 360, 720, or 1440'),
  body('include_destinations')
    .optional({ values: 'null' })
    .isString().withMessage('include_destinations must be a string')
    .customSanitizer((value: string) => value ? value.split(',').map((s: string) => s.trim().toUpperCase()).filter((s: string) => IATA_REGEX.test(s)).join(',') : null),
  body('exclude_destinations')
    .optional({ values: 'null' })
    .isString().withMessage('exclude_destinations must be a string')
    .customSanitizer((value: string) => value ? value.split(',').map((s: string) => s.trim().toUpperCase()).filter((s: string) => IATA_REGEX.test(s)).join(',') : null),
  body('return_ticket')
    .optional()
    .isBoolean().withMessage('return_ticket must be a boolean'),
];

function handleValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

// GET /api/routes - list all monitored routes
router.get('/', async (_req: Request, res: Response) => {
  const routes = await getAllRoutes();
  res.json(routes);
});

// GET /api/routes/:id - get route details
router.get('/:id',
  param('id').isInt().withMessage('Route ID must be an integer'),
  async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const id = parseInt(req.params.id);
    const route = await getRouteById(id);
    if (!route) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    res.json(route);
  }
);

// POST /api/routes - create a new monitored route
router.post('/', routeValidation, async (req: Request, res: Response) => {
  if (!handleValidationErrors(req, res)) return;

  const { origin, destination, max_price, currency, email, discord_webhook, check_interval_minutes, include_destinations, exclude_destinations, return_ticket } = req.body;

  // Security: Sanitize sensitive data - never log webhook URLs or emails
  const route = await createRoute({
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    max_price: parseFloat(max_price),
    currency: currency || 'EUR',
    email: email || null,
    discord_webhook: discord_webhook || null,
    active: 1,
    check_interval_minutes: check_interval_minutes || 60,
    include_destinations: include_destinations || null,
    exclude_destinations: exclude_destinations || null,
    return_ticket: return_ticket === true ? 1 : 0,
  });

  // Security: Never return the full webhook URL in response
  const safeRoute = { ...route, discord_webhook: route.discord_webhook ? 'configured' : null, email: route.email ? 'configured' : null };
  res.status(201).json(safeRoute);
});

// PUT /api/routes/:id - update a route
router.put('/:id',
  param('id').isInt().withMessage('Route ID must be an integer'),
  async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const id = parseInt(req.params.id);
    const existing = await getRouteById(id);
    if (!existing) {
      res.status(404).json({ error: 'Route not found' });
      return;
    }

    const updates: Partial<MonitoredRoute> = {};
    const { origin, destination, max_price, currency, email, discord_webhook, active, check_interval_minutes, include_destinations, exclude_destinations, return_ticket } = req.body;

    if (origin) updates.origin = origin.toUpperCase();
    if (destination) updates.destination = destination.toUpperCase();
    if (max_price !== undefined) updates.max_price = parseFloat(max_price);
    if (currency) updates.currency = currency;
    if (email !== undefined) updates.email = email || null;
    if (discord_webhook !== undefined) updates.discord_webhook = discord_webhook || null;
    if (active !== undefined) updates.active = active ? 1 : 0;
    if (check_interval_minutes) updates.check_interval_minutes = check_interval_minutes;
    if (include_destinations !== undefined) updates.include_destinations = include_destinations || null;
    if (exclude_destinations !== undefined) updates.exclude_destinations = exclude_destinations || null;
    if (return_ticket !== undefined) updates.return_ticket = return_ticket ? 1 : 0;

    const updated = await updateRoute(id, updates);
    const safeRoute = updated ? { ...updated, discord_webhook: updated.discord_webhook ? 'configured' : null, email: updated.email ? 'configured' : null } : updated;
    res.json(safeRoute);
  }
);

// DELETE /api/routes/:id - delete a route
router.delete('/:id',
  param('id').isInt().withMessage('Route ID must be an integer'),
  async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const id = parseInt(req.params.id);
    await deleteRoute(id);
    res.status(204).send();
  }
);

// GET /api/routes/:id/history - get price history for a route
router.get('/:id/history',
  param('id').isInt().withMessage('Route ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit must be between 1 and 1000'),
  async (req: Request, res: Response) => {
    if (!handleValidationErrors(req, res)) return;

    const id = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await getPriceHistory(id, limit);
    res.json(history);
  }
);

export default router;
