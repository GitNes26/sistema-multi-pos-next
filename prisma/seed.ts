import { prisma } from "../src/lib/db/client";
import { seedProduction } from "./seeders/production";
import { seedDemo, isDemoSeedingEnabled } from "./seeders/demo";

// Punto de entrada del seeder.
// - `npm run db:seed` → solo base de producción (roles, permisos, menús…).
// - `SEED_DEMO=true npm run db:seed` → base + organizaciones de demo (dev).
// La demo es opt-in doble: requiere SEED_DEMO=true y NODE_ENV distinto de
// "production", así un seed de producción jamás crea organizaciones de demo
// (ver isDemoSeedingEnabled en seeders/demo.ts).
async function main() {
  await seedProduction();
  console.log("✅ Seed de producción completado");

  if (isDemoSeedingEnabled()) {
    await seedDemo();
    console.log("✅ Seed de demo completado");
  } else {
    console.log("ℹ️  Seed de demo omitido (requiere SEED_DEMO=true y NODE_ENV != production)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
