// Vercel serverless entry for Flight Sniper
// Imports the compiled Express app from backend build output
const path = require('path');

// On Vercel, the function runs from a temp directory.
// backend/dist/app.js is built during the build step and bundled by Vercel.
const backendApp = path.resolve(__dirname, 'backend', 'dist', 'app');
const { app } = require(backendApp);
module.exports = app;
