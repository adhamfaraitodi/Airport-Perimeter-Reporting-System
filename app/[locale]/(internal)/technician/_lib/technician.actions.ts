"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, type UserRole } from "@/lib/auth";
import type { ReportRecord, SessionUser } from "../../../_lib/client-api";
import {
  type TechnicianTaskSummary,
  type UpdateTechnicianStatusInput,
  updateTechnicianStatusSchema,
} from "./technician.schema";
import { getTechnicianReports } from "./technician.loader";
import { executeTechnicianStatusUpdate } from "./technician.service";

/**
 * Validates session for technician actions.
 * Allows TECHNICIAN role, as well as OPERATOR (for oversight/support).
 */
async function verifyTechnicianSession(): Promise<SessionUser> {
  const reqHeaders = await headers();
  const session = await auth.api
    .getSession({ headers: reqHeaders })
    .catch(() => null);

  if (!session?.user?.id) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }

  const role = (session.user as Record<string, unknown>).role as
    | UserRole
    | undefined;

  if (role !== "TECHNICIAN" && role !== "OPERATOR") {
    throw new Error(
      "Akses ditolak. Hanya Teknisi atau Operator yang berwenang mengakses modul ini."
    );
  }

  return {
    id: session.user.id,
    name: session.user.name || "Petugas",
    email: session.user.email || "",
    role: role,
    nip: (session.user as Record<string, unknown>).nip as string | undefined,
    phone: (session.user as Record<string, unknown>).phone as string | undefined,
    unit: (session.user as Record<string, unknown>).unit as string | undefined,
    image: (session.user as Record<string, unknown>).image as string | undefined,
    signatureUrl: (session.user as Record<string, unknown>).signatureUrl as
      | string
      | undefined,
  };
}

/**
 * Server action to fetch fresh dashboard data for the technician:
 * aggregated task counters and all active perimeter damage reports.
 */
export async function getTechnicianDashboardDataAction(): Promise<{
  success: boolean;
  user?: SessionUser;
  summary?: TechnicianTaskSummary;
  reports?: ReportRecord[];
  errorMessage?: string;
}> {
  try {
    const user = await verifyTechnicianSession();
    const { summary, reports } = await getTechnicianReports();

    return {
      success: true,
      user,
      summary,
      reports,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Gagal memuat data dashboard teknisi.";
    return {
      success: false,
      errorMessage: msg,
    };
  }
}

/**
 * Server action to update the repair status of a report.
 * Requires narrative and repair proof photos.
 */
export async function updateTechnicianStatusAction(
  input: UpdateTechnicianStatusInput
): Promise<{
  success: boolean;
  report?: ReportRecord;
  errorMessage?: string;
  fieldErrors?: Record<string, string[]>;
}> {
  try {
    const user = await verifyTechnicianSession();

    const parsed = updateTechnicianStatusSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        fieldErrors: parsed.error.flatten().fieldErrors,
        errorMessage: "Validasi data penanganan gagal. Periksa kembali form.",
      };
    }

    const updated = await executeTechnicianStatusUpdate(user, parsed.data);

    try {
      revalidatePath("/[locale]/technician", "page");
      revalidatePath("/[locale]/operator", "page");
      revalidatePath("/[locale]/reports", "page");
    } catch {
      // safe in non-request contexts
    }

    return {
      success: true,
      report: updated,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Gagal menyimpan pembaruan status perbaikan.";
    return {
      success: false,
      errorMessage: msg,
    };
  }
}
