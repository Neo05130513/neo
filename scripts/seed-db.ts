import { seedDatabaseFromJson } from '../lib/db';

async function main() {
  await seedDatabaseFromJson(true);
  console.log('Database seeded from JSON data.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
