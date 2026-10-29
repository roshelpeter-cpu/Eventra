import path from 'node:path';
import { loadEnv, paths, resolveDatabasePath } from './env.js';
import { openDatabase } from './db.js';
import { initializeDatabase } from './seed.js';
import { createApp } from './app.js';

loadEnv();

const filename = resolveDatabasePath();
const db = openDatabase(filename);
initializeDatabase(db);

const app = createApp(db, { clientDist: path.join(paths.repoRoot, 'client', 'dist') });
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`Eventra API listening on http://localhost:${port}`);
  console.log(`Database: ${filename}`);
});
