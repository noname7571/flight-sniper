import { Router, Request, Response } from 'express';
import { getAllUsers, getUserById, getAllRoutes, getAlertCount, getPriceHistory } from '../db';

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const role = req.session.userRole;
  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const users = await getAllUsers();
  res.json(users);
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const user = await getUserById(id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, created_at: user.created_at });
});

// GET /api/admin/stats
router.get('/stats', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const users = await getAllUsers();
  const routes = await getAllRoutes();
  const alertCount = await getAlertCount();
  res.json({
    totalUsers: users.length,
    totalRoutes: routes.length,
    totalAlerts: alertCount,
  });
});

export default router;
