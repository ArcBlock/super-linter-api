const express = require('express');
const { createLinterRouter } = require('./dist/routes/linter');
const { DatabaseService } = require('./dist/services/database');
const { WorkspaceManager } = require('./dist/services/workspace');
const { LinterRunner } = require('./dist/services/linter');
const { CacheService } = require('./dist/services/cache');

const app = express();

// Initialize services
const db = new DatabaseService(':memory:');
const workspaceManager = new WorkspaceManager();
const linterRunner = new LinterRunner(workspaceManager);
const cacheService = new CacheService(db);

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = `test_${Date.now()}`;
  next();
});

// Create and mount the linter router
const linterRouter = createLinterRouter(workspaceManager, linterRunner, cacheService, db);
app.use('/', linterRouter);

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
  console.log('Routes available:');
  console.log('- GET /test');
  console.log('- GET /:linter/:format/:encoded');
});