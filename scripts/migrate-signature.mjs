import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();
  console.log('Connected to DB');
  await client.query('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "signature_url" text;');
  console.log('Column signature_url added or already exists');
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
