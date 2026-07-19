import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { getUserByEmail, createUser, getUserById } from '../db';

const router = Router();

function handleErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return false;
  }
  return true;
}

// POST /api/auth/register
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    if (!handleErrors(req, res)) return;

    const { email, password, name } = req.body;

    const existing = await getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await createUser({ email, password: hashed, name: name || email.split('@')[0], role: 'user' });

    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  }
);

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
  async (req: Request, res: Response) => {
    if (!handleErrors(req, res)) return;

    const { email, password } = req.body;
    const user = await getUserByEmail(email);

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  }
);

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(function(err) {
    if (err) console.error('[Auth] Session destroy error:', err);
    res.json({ status: 'ok' });
  });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = await getUserById(userId);
  if (!user) {
    req.session.destroy(function() {});
    res.status(401).json({ error: 'User not found' });
    return;
  }

  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

export default router;
