import { prisma } from "../src/lib/db/client";
import { seedProduction } from "./seeders/production";
import { seedDemo } from "./seeders/demo";

// Punto de entrada del seeder.
// - `npm run db:seed` → producción + demo (dev)
// - `SEED_DEMO=false npm run db:seed` → solo base de producción
async function main() {
  await seedProduction();
  console.log("✅ Seed de producción completado");

  const runDemo = process.env.SEED_DEMO !== "false";
  if (runDemo) {
    await seedDemo();
    console.log("✅ Seed de demo completado");
  } else {
    console.log("ℹ️  Seed de demo omitido (SEED_DEMO=false)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());