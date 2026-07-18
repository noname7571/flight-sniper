const { runAllChecks } = require('../backend/dist/scheduler');

module.exports = async function handler(req, res) {
  console.log('[Cron] Triggered price check');
  try {
    await runAllChecks();
    res.json({ status: 'ok', checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[Cron] Failed:', error);
    res.status(500).json({ error: 'Price check failed' });
  }
};
