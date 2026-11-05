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
  {
    nip: "1122334",
    name: "Budi Santoso",
    role: "REPORTER" as const,
    unit: "Aviation Security (AVSEC)",
    phone: "081234567801",
    password: "password123",
  },
  {
    nip: "5566778",
    name: "Joko Waluyo",
    role: "TECHNICIAN" as const,
    unit: "Fasilitas & Pemeliharaan",
    phone: "081234567802",
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
            displayUsername: item.name,
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

  // 3. Seed Sample Reports if none exist
  const existingReports = await db.select({ id: schema.reports.id }).from(schema.reports).limit(1);
  if (existingReports.length === 0 && reporterUserId) {
    console.log("  + Menambahkan data contoh laporan perimeter...");

    const sampleReports = [
      {
        id: crypto.randomUUID(),
        reporterId: reporterUserId,
        status: "OPEN" as const,
        side: "Selatan",
        segmentCode: "SEG-S04",
        latitude: -7.904075,
        longitude: 110.04916,
        locationSource: "GPS" as const,
        findings: [
          {
            partId: "tiang-pagar",
            partName: "Tiang Pagar",
            damages: [{ id: "miring", name: "Miring" }],
          },
          {
            partId: "kawat-duri",
            partName: "Kawat Duri",
            damages: [{ id: "terlepas", name: "Terlepas" }],
          },
        ],
        gpsMetadata: {
          latitude: -7.904075,
          longitude: 110.04916,
          accuracy: 4.2,
        },
        narrative:
          "Tiang pagar perimeter segmen S04 condong miring ke arah luar bandara akibat tanah amblas dan kawat duri bagian atas terlepas.",
      },
      {
        id: crypto.randomUUID(),
        reporterId: reporterUserId,
        status: "IN_PROGRESS" as const,
        side: "Barat Daya",
        segmentCode: "SEG-BD02",
        latitude: -7.898498,
        longitude: 110.033862,
        locationSource: "GPS" as const,
        findings: [
          {
            partId: "mesh-panel",
            partName: "Mesh Panel / Pagar Kawat",
            damages: [{ id: "berlubang", name: "Berlubang" }],
          },
        ],
        gpsMetadata: {
          latitude: -7.898498,
          longitude: 110.033862,
          accuracy: 5.0,
        },
        narrative:
          "Kawat mesh panel berlubang diameter sekitar 25cm. Regu teknisi sedang melakukan pengelasan patch plat pengaman.",
      },
      {
        id: crypto.randomUUID(),
        reporterId: reporterUserId,
        status: "RESOLVED" as const,
        side: "Tenggara",
        segmentCode: "SEG-TG08",
        latitude: -7.910696,
        longitude: 110.067309,
        locationSource: "MANUAL" as const,
        findings: [
          {
            partId: "pondasi",
            partName: "Pondasi",
            damages: [{ id: "bercelah", name: "Bercelah" }],
          },
        ],
        gpsMetadata: null,
        narrative:
          "Pondasi beton cor perimeter mengalami retakan struktural sepanjang 1 meter. Telah selesai diinjeksi grouting semen.",
      },
    ];

    for (const r of sampleReports) {
      await db.insert(schema.reports).values(r);

      // Add status history
      if (r.status === "IN_PROGRESS" && operatorUserId) {
        await db.insert(schema.reportStatusHistory).values({
          id: crypto.randomUUID(),
          reportId: r.id,
          actorId: operatorUserId,
          previousStatus: "OPEN",
          newStatus: "IN_PROGRESS",
          narrative: "Tindak lanjut perbaikan telah ditugaskan dan regu teknisi sedang menuju lokasi.",
        });
      } else if (r.status === "RESOLVED" && operatorUserId) {
        await db.insert(schema.reportStatusHistory).values({
          id: crypto.randomUUID(),
          reportId: r.id,
          actorId: operatorUserId,
          previousStatus: "IN_PROGRESS",
          newStatus: "RESOLVED",
          narrative: "Pekerjaan grouting telah selesai dan diverifikasi oleh tim fasilitas.",
        });
      }
    }
    console.log(`  + Berhasil membuat ${sampleReports.length} laporan contoh.`);
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
