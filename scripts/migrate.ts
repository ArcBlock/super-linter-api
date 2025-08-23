#!/usr/bin/env tsx

import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DB_PATH = join(__dirname, '..', 'data', 'super-linter-api.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

async function migrate(): Promise<void> {
  console.log('🚀 Starting database migration...');
  
  try {
    // Ensure data directory exists
    const dataDir = join(__dirname, '..', 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    console.log(`📁 Database: ${DB_PATH}`);
    console.log(`📝 Schema: ${SCHEMA_PATH}`);

    // Use sqlite3 command line tool (more reliable than native bindings)
    execSync(`sqlite3 "${DB_PATH}" < "${SCHEMA_PATH}"`, {
      stdio: 'inherit'
    });

    // Verify tables were created
    const tables = execSync(`sqlite3 "${DB_PATH}" ".tables"`, { 
      encoding: 'utf-8' 
    }).trim().split(/\s+/);

    console.log('✅ Created tables:', tables);

    console.log('✨ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate().catch(console.error);
}

export { migrate };