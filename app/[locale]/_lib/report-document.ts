import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { toast } from "@/components/ui/sonner";
import type { ReportRecord } from "./client-api";

const statusLabelMap: Record<string, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Sedang Ditangani",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
};

/**
 * Filter reports strictly within [startDate, endDate] inclusive (YYYY-MM-DD format).
 * Normalized to UTC boundary comparison to avoid timezone day shifts.
 */
export function filterReportsByDateRange(
  reports: readonly ReportRecord[],
  startDate?: string,
  endDate?: string
): ReportRecord[] {
  if (!startDate && !endDate) return [...reports];

  const startMs = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : null;
  const endMs = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : null;

  return reports.filter((r) => {
    const dMs = new Date(r.createdAt).getTime();
    if (Number.isNaN(dMs)) return false;
    if (startMs !== null && dMs < startMs) return false;
    if (endMs !== null && dMs > endMs) return false;
    return true;
  });
}

/**
 * Loads image from public path or URL and returns a Base64 string for PDF insertion.
 */
async function loadBase64Image(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Fetches user's private wet signature from internal API if available,
 * converts to Base64 data URL.
 */
async function fetchUserSignature(userId?: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const res = await fetch(`/api/profile/signature/${userId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Formats ISO date into formal Indonesian date string
 */
function formatFormalDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Generates and downloads an official individual PDF report for a perimeter damage record.
 */
export async function downloadReportPdf(report: ReportRecord): Promise<void> {
  try {
    toast.info("Menyiapkan dokumen PDF...");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // 1. Header (Logo / Title Bar)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margin, y, contentWidth, 24, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("AIRPORT PERIMETER REPORTING SYSTEM", margin + 8, y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text("YOGYAKARTA INTERNATIONAL AIRPORT (YIA)", margin + 8, y + 15);
    doc.text("LEMBAR RESMI LAPORAN KERUSAKAN PAGAR PERIMETER", margin + 8, y + 20);

    // Document ID Badge inside header
    const cleanId = String(report.id).replace(/-/g, "").slice(0, 8).toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`#${cleanId}`, pageWidth - margin - 8, y + 14, { align: "right" });

    y += 29;

    // 2. Info Summary Grid (Metadata Table)
    const findingsSummary =
      report.findings && report.findings.length > 0
        ? report.findings
            .map((f) => {
              const damages = Array.isArray(f.damages)
                ? f.damages.map((d) => (typeof d === "string" ? d : d.name)).join(", ")
                : "";
              return damages ? `${f.partName} (${damages})` : f.partName;
            })
            .join("; ")
        : "Tidak ditentukan";

    const effectiveStatus = report.deletedAt ? "CLOSED" : report.status;
    const statusText = statusLabelMap[effectiveStatus] || effectiveStatus;

    const metadataRows = [
      [
        { content: "ID Laporan", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        `#${cleanId}`,
        { content: "Waktu Lapor", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        `${formatFormalDate(report.createdAt)} WIB`,
      ],
      [
        { content: "Pelapor", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        `${report.reporterName || "Petugas Lapangan"}${report.reporterEmail ? ` (${report.reporterEmail})` : ""}`,
        { content: "Status Akhir", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        statusText,
      ],
      [
        { content: "Sisi Perimeter", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        report.side ? `Sisi ${report.side}` : "-",
        { content: "Kode Segmen / Grid", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        report.segmentCode ? `Grid ${report.segmentCode}` : "Belum dipetakan",
      ],
      [
        { content: "Koordinat GPS", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)} (${report.locationSource || "GPS"})`,
        { content: "Komponen & Kerusakan", styles: { fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] } },
        findingsSummary,
      ],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: metadataRows,
      theme: "grid",
      styles: {
        fontSize: 8.5,
        cellPadding: 2.8,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { cellWidth: 42 },
        3: { cellWidth: 49 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // 3. Deskripsi / Narasi Temuan
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Deskripsi / Catatan Lapangan:", margin, y);
    y += 4;

    const narrativeText = report.narrative?.trim() || "Tidak ada narasi tambahan yang dilampirkan.";
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: [[narrativeText]],
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [51, 65, 85],
        fillColor: [248, 250, 252],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // 4. Riwayat Penanganan (Handling History Timeline)
    if (report.history && report.history.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Riwayat Tindak Lanjut & Log Status:", margin, y);
      y += 4;

      const historyRows = report.history.map((log, index) => {
        const actor = log.actorName || "Petugas";
        const fromSt = log.previousStatus ? statusLabelMap[log.previousStatus] || log.previousStatus : "-";
        const toSt = statusLabelMap[log.status] || log.status;
        const time = formatFormalDate(log.createdAt);
        const notes = log.narrative || "Tanpa catatan tambahan.";

        return [
          String(index + 1),
          time,
          actor,
          `${fromSt} -> ${toSt}`,
          notes,
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["No", "Waktu", "Petugas", "Perubahan Status", "Catatan Penanganan"]],
        body: historyRows,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          cellPadding: 2.5,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 36 },
          2: { cellWidth: 32 },
          3: { cellWidth: 38 },
          4: { cellWidth: 68 },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }

    // 5. Bukti Foto Kerusakan (Images Section)
    const imagesToRender = (report.images || []).slice(0, 4); // Max 4 primary photos
    if (imagesToRender.length > 0) {
      // Check if page break is needed
      if (y > 200) {
        doc.addPage();
        y = margin;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Lampiran Bukti Foto Kerusakan Pagar:", margin, y);
      y += 4;

      const cols = 2;
      const gap = 4;
      const imgWidth = (contentWidth - gap) / cols;
      const imgHeight = 52;

      for (let i = 0; i < imagesToRender.length; i++) {
        const imgObj = imagesToRender[i];
        const col = i % cols;
        const row = Math.floor(i / cols);

        const imgX = margin + col * (imgWidth + gap);
        const imgY = y + row * (imgHeight + gap + 5);

        // Check page overflow for second row
        if (imgY + imgHeight > 275) {
          doc.addPage();
          y = margin;
        }

        try {
          const b64 = imgObj.url ? await loadBase64Image(imgObj.url) : null;
          if (b64) {
            doc.setFillColor(241, 245, 249);
            doc.rect(imgX, imgY, imgWidth, imgHeight, "F");
            doc.addImage(b64, "JPEG", imgX, imgY, imgWidth, imgHeight, undefined, "FAST");
            doc.setDrawColor(203, 213, 225);
            doc.rect(imgX, imgY, imgWidth, imgHeight, "S");
          } else {
            doc.setFillColor(248, 250, 252);
            doc.rect(imgX, imgY, imgWidth, imgHeight, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("[Foto tidak dapat dimuat]", imgX + imgWidth / 2, imgY + imgHeight / 2, { align: "center" });
          }
        } catch {
          // Skip on failed image
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Foto Bukti #${i + 1}`, imgX + 2, imgY + imgHeight + 3.5);
      }

      const totalRows = Math.ceil(imagesToRender.length / cols);
      y += totalRows * (imgHeight + gap + 5) + 4;
    }

    // 6. Signatures Block (Pengesahan Pelapor & Teknisi)
    // Check if new page is needed for signature block
    if (y > 230) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Pengesahan Laporan:", margin, y);
    y += 4;

    const signatureBlockWidth = (contentWidth - 10) / 2;
    const sigBoxHeight = 36;

    // Fetch reporter signature if available
    const reporterSigB64 = await fetchUserSignature(report.reporterId);

    // Left Box: Reporter
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, signatureBlockWidth, sigBoxHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Petugas Pelapor Lapangan:", margin + 4, y + 5);

    if (reporterSigB64) {
      // Embed signature preserving natural aspect ratio within max 34mm x 15mm box
      try {
        doc.addImage(
          reporterSigB64,
          "PNG",
          margin + signatureBlockWidth / 2 - 17,
          y + 8,
          34,
          15,
          undefined,
          "FAST"
        );
      } catch {}
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("(Tanda tangan basah digital terdaftar)", margin + signatureBlockWidth / 2, y + 17, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(report.reporterName || "Petugas Lapangan", margin + 4, y + sigBoxHeight - 4);

    // Right Box: Unit / Maintenance Lead
    const rightX = margin + signatureBlockWidth + 10;
    doc.roundedRect(rightX, y, signatureBlockWidth, sigBoxHeight, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Supervisor / Operator Perimeter:", rightX + 4, y + 5);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("(Pengesahan Sistem Elektronik)", rightX + signatureBlockWidth / 2, y + 17, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Airport Security / Maintenance YIA", rightX + 4, y + sigBoxHeight - 4);

    // 7. Footer on all pages
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      const footerY = doc.internal.pageSize.getHeight() - 7;
      doc.text(
        "Dokumen resmi diterbitkan otomatis oleh Airport Perimeter Reporting System (APRS).",
        margin,
        footerY
      );
      doc.text(
        `Halaman ${i} dari ${pageCount}`,
        pageWidth - margin,
        footerY,
        { align: "right" }
      );
    }

    // 8. Save PDF
    const filename = `Laporan_Perimeter_${cleanId}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);

    toast.success("Dokumen PDF berhasil diunduh", {
      description: `File ${filename} telah disimpan ke perangkat Anda.`,
    });
  } catch (err) {
    console.error("Gagal mengunduh dokumen PDF:", err);
    toast.error("Gagal mengunduh PDF", {
      description: "Terjadi kesalahan saat membuat dokumen PDF.",
    });
  }
}

/**
 * Backwards-compatible alias for ReportDetailSheet
 */
export const downloadReportDocument = downloadReportPdf;

export interface DownloadAllReportsOptions {
  startDate?: string;
  endDate?: string;
}

/**
 * Generates and downloads an official landscape PDF recap of all perimeter reports.
 * Includes all reports with all statuses for the selected date range.
 * Columns:
 * 1. No
 * 2. ID Laporan
 * 3. Lokasi / Grid (Kode grid, sisi, koordinat GPS)
 * 4. Bagian & Jenis Kerusakan
 * 5. Nama Pelapor
 * 6. Status
 * 7. Keterangan (Seluruh catatan: temuan awal, sedang diperbaiki, telah ditangani, ditutup)
 */
export async function downloadAllReportsPdf(
  reports: ReportRecord[],
  options?: DownloadAllReportsOptions
): Promise<void> {
  const targetReports = filterReportsByDateRange(
    reports,
    options?.startDate,
    options?.endDate
  );

  if (!targetReports || targetReports.length === 0) {
    toast.error("Tidak ada laporan", {
      description: "Tidak ada data laporan yang sesuai untuk diunduh.",
    });
    return;
  }

  try {
    toast.info("Menyiapkan dokumen rekap PDF...");

    // Create A4 Landscape PDF
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // 1. Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("REKAPITULASI LAPORAN KERUSAKAN PAGAR PERIMETER", margin + 8, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(
      "AIRPORT PERIMETER REPORTING SYSTEM (APRS) · YOGYAKARTA INTERNATIONAL AIRPORT (YIA)",
      margin + 8,
      y + 14
    );

    // Date range subtitle
    const dateRangeLabel =
      options?.startDate && options?.endDate
        ? `Periode: ${options.startDate} s.d. ${options.endDate} · Total: ${targetReports.length} Laporan`
        : `Total: ${targetReports.length} Laporan · Terunduh pada ${new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(dateRangeLabel, margin + 8, y + 19);

    // Export Timestamp badge right-aligned
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `DOKUMEN RESMI A4 LANDSCAPE`,
      pageWidth - margin - 8,
      y + 12,
      { align: "right" }
    );

    y += 26;

    // 2. Table Data Preparation
    // 7 Columns as requested:
    // No, ID Laporan, Lokasi / Grid, Bagian & Jenis Kerusakan, Nama Pelapor, Status, Keterangan
    const tableBody = targetReports.map((report, idx) => {
      // 1. No
      const no = String(idx + 1);

      // 2. ID Laporan
      const idClean = String(report.id).replace(/-/g, "").slice(0, 8).toUpperCase();
      const dateStr = report.createdAt
        ? new Date(report.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "-";
      const idCol = `#${idClean}\n(${dateStr})`;

      // 3. Lokasi / Grid (Kode grid, sisi, kode GPS)
      const gridCode = report.segmentCode ? `Grid ${report.segmentCode}` : "Belum dipetakan";
      const sideText = report.side ? `Sisi ${report.side}` : "-";
      const gpsCoord =
        typeof report.latitude === "number" && typeof report.longitude === "number"
          ? `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`
          : "-";
      const locationCol = `${gridCode}\n${sideText}\nGPS: ${gpsCoord}`;

      // 4. Bagian & Jenis Kerusakan
      let damageCol = "-";
      if (report.findings && report.findings.length > 0) {
        damageCol = report.findings
          .map((f) => {
            const dmgList = Array.isArray(f.damages)
              ? f.damages.map((d) => (typeof d === "string" ? d : d.name)).join(", ")
              : "";
            return dmgList ? `${f.partName}: ${dmgList}` : f.partName;
          })
          .join("\n");
      }

      // 5. Nama Pelapor
      const reporterCol = report.reporterName || "Petugas Lapangan";

      // 6. Status
      const effectiveStatus = report.deletedAt ? "CLOSED" : report.status;
      const statusCol = statusLabelMap[effectiveStatus] || effectiveStatus;

      // 7. Keterangan (Seluruh catatan: temuan awal, sedang diperbaiki, telah ditangani, ditutup)
      const notesLines: string[] = [];
      if (report.narrative && report.narrative.trim()) {
        notesLines.push(`Temuan: ${report.narrative.trim()}`);
      }
      if (report.history && report.history.length > 0) {
        // Collect logs in chronological order
        const sortedLogs = [...report.history].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        for (const log of sortedLogs) {
          if (log.narrative && log.narrative.trim()) {
            const roleName = log.actorName || "Petugas";
            const targetStatus = statusLabelMap[log.status] || log.status;
            notesLines.push(`[${targetStatus} oleh ${roleName}]: ${log.narrative.trim()}`);
          }
        }
      }
      if (report.deletionReason && report.deletionReason.trim()) {
        notesLines.push(`Penutupan: ${report.deletionReason.trim()}`);
      }
      const notesCol = notesLines.length > 0 ? notesLines.join("\n") : "-";

      return [no, idCol, locationCol, damageCol, reporterCol, statusCol, notesCol];
    });

    // 3. Render Table
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [
          "No",
          "ID Laporan",
          "Lokasi / Grid\n(Sisi & Koordinat GPS)",
          "Bagian & Jenis Kerusakan",
          "Nama Pelapor",
          "Status",
          "Keterangan & Catatan Tindak Lanjut\n(Temuan, Penanganan, Selesai, Ditutup)",
        ],
      ],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
        cellPadding: 2.5,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59], // slate-800
        lineColor: [203, 213, 225], // slate-300
        lineWidth: 0.15,
        overflow: "linebreak",
        valign: "top",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // slate-50
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" }, // No
        1: { cellWidth: 26, halign: "center" }, // ID Laporan
        2: { cellWidth: 46 }, // Lokasi / Grid
        3: { cellWidth: 54 }, // Bagian & Jenis Kerusakan
        4: { cellWidth: 32 }, // Nama Pelapor
        5: { cellWidth: 24, halign: "center", fontStyle: "bold" }, // Status
        6: { cellWidth: "auto" }, // Keterangan
      },
      didParseCell: (data) => {
        // Status column color styling
        if (data.section === "body" && data.column.index === 5) {
          const val = String(data.cell.raw || "");
          if (val === "Selesai") {
            data.cell.styles.textColor = [16, 149, 106]; // emerald-600
          } else if (val === "Sedang Ditangani") {
            data.cell.styles.textColor = [217, 119, 6]; // amber-600
          } else if (val === "Baru") {
            data.cell.styles.textColor = [225, 29, 72]; // rose-600
          } else if (val === "Ditutup") {
            data.cell.styles.textColor = [100, 116, 139]; // slate-500
          }
        }
      },
    });

    // 4. Page numbers and footer
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      const footerY = pageHeight - 6;
      doc.text(
        "Dokumen rekapitulasi resmi diterbitkan oleh Airport Perimeter Reporting System (APRS) — Yogyakarta International Airport.",
        margin,
        footerY
      );
      doc.text(
        `Halaman ${i} dari ${totalPages}`,
        pageWidth - margin,
        footerY,
        { align: "right" }
      );
    }

    // 5. Download file
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Rekap_Laporan_Perimeter_${dateStamp}.pdf`;
    doc.save(filename);

    toast.success("Dokumen rekap PDF berhasil diunduh", {
      description: `File ${filename} telah disimpan ke perangkat Anda.`,
    });
  } catch (err) {
    console.error("Gagal mengunduh dokumen rekap PDF:", err);
    toast.error("Gagal mengunduh rekap PDF", {
      description: "Terjadi kesalahan saat memproses dokumen PDF.",
    });
  }
}
