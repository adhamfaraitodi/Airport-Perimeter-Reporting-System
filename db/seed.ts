import { auth, nipToEmail } from "@/lib/auth";
import { db, schema, pool } from "@/db";
import { eq } from "drizzle-orm";

const DEFAULT_USERS = [
  {
    nip: "1234567",
    name: "Operator Admin",
    role: "OPERATOR" as const,
    unit: "Unit Pengamanan Bandara",
    phone: "081234567800",
    password: "password123",
  },
];

const DEFAULT_PARTS = [
  { id: "pondasi", name: "Pondasi", sortOrder: 1 },
  { id: "tiang-pagar", name: "Tiang Pagar", sortOrder: 2 },
  { id: "kawat-duri", name: "Kawat Duri", sortOrder: 3 },
  { id: "mesh-panel", name: "Mesh Panel / Pagar Kawat", sortOrder: 4 },
  { id: "pintu-gerbang", name: "Pintu Gerbang Perimeter", sortOrder: 5 },
  { id: "cctv-sensor", name: "CCTV / Sensor Perimeter", sortOrder: 6 },
  { id: "rambu-peringatan", name: "Rambu Peringatan", sortOrder: 7 },
];

async function seed() {
  console.log("🌱 [Seed] Memulai seeding database...");

  // 1. Seed Perimeter Parts
  for (const part of DEFAULT_PARTS) {
    const existing = await db
      .select({ id: schema.perimeterParts.id })
      .from(schema.perimeterParts)
      .where(eq(schema.perimeterParts.id, part.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.perimeterParts).values({
        id: part.id,
        name: part.name,
        sortOrder: part.sortOrder,
        isActive: true,
      });
      console.log(`  + Perimeter Part: ${part.name}`);
    }
  }

  // 2. Seed Default Users using Better-Auth signUpEmail
  for (const item of DEFAULT_USERS) {
    const existing = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.nip, item.nip))
      .limit(1);

    if (existing.length === 0) {
      const email = nipToEmail(item.nip);
      const res = await auth.api.signUpEmail({
        body: {
          email,
          password: item.password,
          name: item.name,
          nip: item.nip,
          role: item.role,
          unit: item.unit,
          phone: item.phone,
          status: "ACTIVE",
        },
      });

      if (res?.user?.id) {
        // Sync username column for username plugin login
        await db
          .update(schema.user)
          .set({
            username: item.nip,
            displayUsername: item.name,
          })
          .where(eq(schema.user.id, res.user.id));

        console.log(
          `  + User: ${item.name} [${item.role}] (NIP: ${item.nip}, UUID: ${res.user.id})`
        );
      }
    } else {
      console.log(`  = User NIP ${item.nip} sudah ada (lewati).`);
    }
  }

  console.log("✅ [Seed] Seeding database selesai!");
}

seed()
  .catch((err) => {
    console.error("❌ [Seed] Gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
