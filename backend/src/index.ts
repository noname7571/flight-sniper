import { app } from './app';
import { startScheduler } from './scheduler';

const PORT = process.env.PORT || 3001;

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Flight Sniper running on http://localhost:${PORT}`);
  console.log(`[Server] API available at http://localhost:${PORT}/api`);

  // Start the price monitoring scheduler
  startScheduler();
});
