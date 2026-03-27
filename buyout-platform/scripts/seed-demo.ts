import { seedMockBuyoutsToDb } from "@/lib/repositories/buyouts";

async function main() {
  await seedMockBuyoutsToDb();
  console.log("Demo buyout records seeded.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
