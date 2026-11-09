import { auth, nipToEmail } from "@/lib/auth";
import { db, schema, pool } from "@/db";
import { and, eq } from "drizzle-orm";

const DEFAULT_USERS = [
  {
    nip: "1234567",
    name: "Operator Admin",
    role: "OPERATOR" as const,
    position: "Supervisor",
    unit: "Aviation Security (AVSEC)",
    phone: "081234567800",
    password: "password123",
  },
  {
    nip: "1122334",
    name: "Adham",
    role: "REPORTER" as const,
    position: "Officer",
    unit: "Aviation Security (AVSEC)",
    phone: "081234567801",
    password: "password123",
  },
  {
    nip: "5566778",
    name: "AF",
    role: "TECHNICIAN" as const,
    position: "Officer",
    unit: "Facility Operation",
    phone: "081234567802",
    password: "password123",
  },
];

const DEFAULT_PARTS: Array<{
  id: string;
  name: string;
  sortOrder: number;
  damages: Array<{ id: string; name: string; exclusiveGroup?: string }>;
}> = [
  {
    id: "pondasi",
    name: "Pondasi",
    sortOrder: 1,
    damages: [
      { id: "bercelah", name: "Bercelah" },
      { id: "miring", name: "Miring" },
      { id: "runtuh", name: "Runtuh" },
      { id: "lainnya", name: "Lainnya" },
    ],
  },
  {
    id: "tiang-pagar",
    name: "Tiang Pagar",
    sortOrder: 2,
    damages: [
      { id: "berkarat-berat", name: "Berkarat berat", exclusiveGroup: "korosi" },
      { id: "berkarat-sedang", name: "Berkarat sedang", exclusiveGroup: "korosi" },
      { id: "miring", name: "Miring" },
      { id: "penyok", name: "Penyok" },
      { id: "lainnya", name: "Lainnya" },
    ],
  },
  {
    id: "pagar-harmonika-brc",
    name: "Pagar Harmonika /BRC",
    sortOrder: 3,
    damages: [
      { id: "berkarat-berat", name: "Berkarat berat", exclusiveGroup: "korosi" },
      { id: "berkarat-sedang", name: "Berkarat sedang", exclusiveGroup: "korosi" },
      { id: "berlubang", name: "Berlubang" },
      { id: "klem-terlepas", name: "Klem terlepas" },
      { id: "lainnya", name: "Lainnya" },
    ],
  },
  {
    id: "kawat-duri-razor",
    name: "Kawat Duri /Razor",
    sortOrder: 4,
    damages: [
      { id: "berkarat-berat", name: "Berkarat berat", exclusiveGroup: "korosi" },
      { id: "berkarat-sedang", name: "Berkarat sedang", exclusiveGroup: "korosi" },
      { id: "terlepas", name: "Terlepas" },
      { id: "tumpul", name: "Tumpul" },
      { id: "lainnya", name: "Lainnya" },
    ],
  },
  {
    id: "tiang-penyangga-kawat-duri",
    name: "Tiang Penyangga Kawat Duri",
    sortOrder: 5,
    damages: [
      { id: "patah", name: "Patah" },
      { id: "terlepas", name: "Terlepas" },
      { id: "lainnya", name: "Lainnya" },
    ],
  },
];

async function seed() {
  console.log("🌱 [Seed] Memulai seeding database...");

  // 1. Seed Perimeter Parts & Damage Types
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

    for (const d of part.damages) {
      const existingDamage = await db
        .select({ id: schema.damageTypes.id })
        .from(schema.damageTypes)
        .where(
          and(
            eq(schema.damageTypes.partId, part.id),
            eq(schema.damageTypes.id, d.id)
          )
        )
        .limit(1);

      if (existingDamage.length === 0) {
        await db.insert(schema.damageTypes).values({
          id: d.id,
          partId: part.id,
          name: d.name,
          exclusiveGroup: d.exclusiveGroup ?? null,
          isActive: true,
        });
      }
    }
  }

  // 2. Seed Default Users using Better-Auth signUpEmail
  let reporterUserId: string | null = null;
  let operatorUserId: string | null = null;

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
          position: item.position || "Officer",
          unit: item.unit,
          phone: item.phone,
          status: "ACTIVE",
        },
      });

      if (res?.user?.id) {
        await db
          .update(schema.user)
          .set({
            username: item.nip,
            position: item.position || "Officer",
          })
          .where(eq(schema.user.id, res.user.id));

        console.log(
          `  + User: ${item.name} [${item.role}] (NIP: ${item.nip}, UUID: ${res.user.id})`
        );
        if (item.role === "REPORTER") reporterUserId = res.user.id;
        if (item.role === "OPERATOR") operatorUserId = res.user.id;
      }
    } else {
      console.log(`  = User NIP ${item.nip} sudah ada (lewati).`);
      if (item.role === "REPORTER") reporterUserId = existing[0].id;
      if (item.role === "OPERATOR") operatorUserId = existing[0].id;
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
