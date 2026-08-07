const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:database.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function run() {
  console.log("Starting migration...");
  try {
    await db.execute("ALTER TABLE users ADD COLUMN last_seen DATETIME");
    console.log("Column last_seen added successfully!");
  } catch (err) {
    console.error("Migration failed:", err.message);
  }
}

run();
