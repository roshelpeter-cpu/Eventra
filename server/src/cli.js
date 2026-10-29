import { resolveDatabasePath } from './env.js';
import { loadEnv } from './env.js';
import { openDatabase, migrate } from './db.js';
import { initializeDatabase, resetDatabase } from './seed.js';

loadEnv();

const command = process.argv[2];
const filename = resolveDatabasePath();

if (command === 'init') {
  const db = openDatabase(filename);
  migrate(db);
  db.close();
  console.log(`Schema is ready at ${filename}`);
} else if (command === 'seed') {
  const db = openDatabase(filename);
  initializeDatabase(db);
  db.close();
  console.log(`Database is ready at ${filename}`);
} else if (command === 'reset') {
  console.log(`Replacing the database at ${filename}. Existing registrations will be deleted.`);
  resetDatabase(filename);
  console.log('Database reset and seeded.');
} else {
  console.error('Usage: node src/cli.js init|seed|reset');
  process.exit(1);
}
