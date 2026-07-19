// Vercel serverless entry for Flight Sniper
// IMPORTANT: Use static require() so Vercel's bundler can follow it
const { app } = require('../backend/dist/app');
module.exports = app;
