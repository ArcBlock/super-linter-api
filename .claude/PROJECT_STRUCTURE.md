# Project Structure Guidelines

## Scripts Organization

All test scripts and utility scripts are located in the `scripts/` folder, not in the root directory.

### Test Scripts
- `test-*.js` - All test endpoint scripts
- `verify-*.js` - Verification scripts

### Utility Scripts  
- `migrate.ts` - Database migration script
- `schema.sql` - Database schema

## Directory Structure
```
scripts/
├── migrate.ts           # Database migration utility
├── schema.sql          # Database schema definition
├── test-all-endpoints.js    # Test all API endpoints
├── test-fixed-endpoints.js  # Test fixed endpoints
├── test-get-endpoint.js     # Test GET endpoints
├── test-post-endpoint.js    # Test POST endpoints
├── test-routes.js           # Test route configurations
├── test-simple-route.js     # Test simple routes
└── verify-phase3.js         # Phase 3 verification script
```

## Guidelines
- Never place test scripts in the root directory
- All scripts should be organized in the `scripts/` folder for better project structure
- Use descriptive names that indicate the script's purpose