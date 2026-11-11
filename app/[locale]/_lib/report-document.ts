import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "@/components/ui/sonner";
import type { ReportRecord } from "./client-api";
import { dateText, labels } from "./draft-store";
import { filterReportsByDateRange } from "@/lib/date-filter";

export { filterReportsByDateRange };

/**
 * Formats ISO date string into "Hari, DD Mon YYYY / HH:mm WIB"
 */
function formatHariTanggal(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "-";
    const dayName = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    }).format(d);
    const dateStr = new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
    const timeStr = new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(d);
    return `${dayName}, ${dateStr}\n${timeStr} WIB`;
  } catch {
    return "-";
  }
}

interface ImageAsset {
  dataUrl: string;
  format: "JPEG" | "PNG";
}

/**
 * Loads an image from URL, scales to optimal print width (360px), and renders as JPEG
 * on a white background. This avoids jsPDF decompressing raw alpha RGBA bitmaps into the PDF,
 * which caused the file size to inflate to 6.3MB instead of ~20KB.
 */
async function loadImageDataUrl(
  url: string,
  maxWidth = 360
): Promise<ImageAsset | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        const scale = Math.min(1, maxWidth / naturalW);
        const targetW = Math.round(naturalW * scale);
        const targetH = Math.round(naturalH * scale);

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        // Fill solid white background so logo glyphs render cleanly
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Native DCT-encoded JPEG stream keeps total PDF size ~20KB
        resolve({
          dataUrl: canvas.toDataURL("image/jpeg", 0.92),
          format: "JPEG",
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}


/**
 * Generates and downloads a clean, official InJourney Airports PDF report.
 */
export async function downloadReportPdf(report: ReportRecord): Promise<void> {
  const shortId = String(report.id).replace(/-/g, "").slice(0, 8).toUpperCase();
  const filename = `Laporan_Perimeter_YIA_${report.segmentCode || "APRS"}_${shortId}.pdf`;

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let currentY = margin;

    // 1. Header with InJourney Logo
    const logoUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/injourney-logo.webp`
        : "/injourney-logo.webp";

    const logoAsset = await loadImageDataUrl(logoUrl, 360);

    if (logoAsset) {
      // Draw Logo on left
      doc.addImage(logoAsset.dataUrl, logoAsset.format, margin, currentY - 2, 38, 12, undefined, "FAST");
    }

    currentY += 14;

    // Divider line
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 7;

    // 2. Document Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text("LEMBAR LAPORAN KERUSAKAN PERIMETER", pageWidth / 2, currentY, {
      align: "center",
    });

    currentY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const printedAt = dateText(new Date().toISOString());
    doc.text(
      `Nomor Registrasi: APRS-YIA-${shortId}  |  Dicetak: ${printedAt}`,
      pageWidth / 2,
      currentY,
      { align: "center" }
    );

    currentY += 6;

    // Status label
    const statusLabel = report.deletedAt
      ? "Ditutup"
      : labels[report.status] || report.status;

    // 3. Section 1: Informasi Umum Laporan (Table)
    const generalInfo = [
      ["ID Laporan", `#${shortId} (${report.id})`],
      ["Waktu Dilaporkan", dateText(report.createdAt)],
      ["Nama Pelapor", report.reporterName || "Petugas Lapangan"],
      ["Status Penanganan", statusLabel],
      [
        "Lokasi Perimeter",
        `Sisi ${report.side || "-"}  |  Grid: ${report.segmentCode ? `Grid ${report.segmentCode}` : "-"}`,
      ],
      [
        "Koordinat GPS",
        `${report.latitude}, ${report.longitude} (${report.locationSource || "GPS"}${
          report.gps?.accuracy != null
            ? ` | Akurasi ±${Math.round(report.gps.accuracy)} m`
            : ""
        })`,
      ],
    ];

    if (report.deletedAt) {
      generalInfo.push(["Waktu Ditutup", dateText(report.deletedAt)]);
      generalInfo.push([
        "Alasan Penutupan",
        report.deletionReason || "Ditutup oleh operator",
      ]);
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["INFORMASI UMUM LAPORAN", ""]],
      body: generalInfo,
      theme: "grid",
      headStyles: {
        fillColor: [2, 132, 199], // Brand Primary Teal/Blue
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [31, 41, 55],
        lineColor: [209, 213, 219],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 46, fillColor: [248, 250, 252] },
        1: { cellWidth: "auto" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // 4. Section 2: Temuan Bagian & Jenis Kerusakan
    const findingsData = (report.findings || []).map((f, idx) => [
      String(idx + 1),
      f.partName,
      (f.damages || [])
        .map((d) => (typeof d === "string" ? d : (d as any).name))
        .join(", ") || "-",
    ]);

    if (findingsData.length === 0) {
      findingsData.push(["-", "Tidak ada rincian bagian khusus", "-"]);
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["No", "Bagian Perimeter", "Rincian Kerusakan / Kondisi"]],
      body: findingsData,
      theme: "grid",
      headStyles: {
        fillColor: [2, 132, 199],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [31, 41, 55],
        lineColor: [209, 213, 219],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { fontStyle: "bold", cellWidth: 55 },
        2: { cellWidth: "auto" },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // 5. Section 3: Uraian / Narasi Laporan
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["URAIAN / CATATAN LAPORAN LAPANGAN"]],
      body: [[report.narrative || "Tidak ada catatan narasi khusus."]],
      theme: "grid",
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [51, 65, 85],
        fillColor: [248, 250, 252],
        lineColor: [209, 213, 219],
        lineWidth: 0.2,
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // 6. Section 4: Riwayat Penanganan (Audit Trail)
    if (report.history && report.history.length > 0) {
      const historyRows = [...report.history].reverse().map((h, idx) => {
        const hStatus =
          labels[h.status] ||
          (h.status === "DELETE" || h.status === "CLOSED"
            ? "Ditutup"
            : h.status);
        return [
          String(idx + 1),
          dateText(h.createdAt),
          h.actorName || "Petugas",
          hStatus,
          h.narrative || "-",
        ];
      });

      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [["No", "Waktu", "Petugas", "Status", "Catatan Tindakan"]],
        body: historyRows,
        theme: "grid",
        headStyles: {
          fillColor: [71, 85, 105],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [31, 41, 55],
          lineColor: [209, 213, 219],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 8 },
          1: { cellWidth: 36 },
          2: { fontStyle: "bold", cellWidth: 32 },
          3: { cellWidth: 26 },
          4: { cellWidth: "auto" },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // 7. Section 5: Lembar Pengesahan (Signatures)
    const signBoxY = currentY;
    const boxWidth = contentWidth / 3;

    // Check if new page is needed for signature block
    if (signBoxY + 35 > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      currentY = margin + 5;
    }

    const signTitles = [
      "Petugas Pelapor",
      "Teknisi Penanganan",
      "Operator Pengendali",
    ];

    // Find technician who handled this report
    const technicianEntry = report.history
      ?.slice()
      .reverse()
      .find((h) => h.status === "RESOLVED" || h.status === "IN_PROGRESS");
    const technicianName = technicianEntry?.actorName;

    const signNames = [
      report.reporterName || "Petugas Lapangan",
      technicianName || "( ........................................ )",
      "( ........................................ )",
    ];
    const signRoles = [
      "Pelapor Lapangan",
      "Unit Pemeliharaan Fasilitas",
      "Airport Operation Center",
    ];

    for (let i = 0; i < 3; i++) {
      const boxX = margin + i * boxWidth;
      const centerX = boxX + boxWidth / 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(signTitles[i], centerX, currentY + 3, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(17, 24, 39);
      doc.text(signNames[i], centerX, currentY + 23, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(signRoles[i], centerX, currentY + 27, { align: "center" });
    }

    // 8. Footer (Page numbers) on all pages
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

    // 9. Save PDF directly to user's device
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
  const targetReports = filterReportsByDateRange(reports, options?.startDate, options?.endDate);

  if (!targetReports || targetReports.length === 0) {
    toast.error("Tidak ada laporan", {
      description: "Tidak ada data laporan pada rentang tanggal yang dipilih.",
    });
    return;
  }

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `Rekapitulasi_Laporan_Perimeter_YIA_${dateStamp}.pdf`;

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 14;
    let currentY = margin;

    // 1. Header with InJourney Logo
    const logoUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/injourney-logo.webp`
        : "/injourney-logo.webp";

    const logoAsset = await loadImageDataUrl(logoUrl, 360);

    if (logoAsset) {
      doc.addImage(logoAsset.dataUrl, logoAsset.format, margin, currentY - 2, 36, 11, undefined, "FAST");
    }


    // Separator line
    currentY += 14;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    // Document Title
    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("REKAPITULASI LAPORAN PERIMETER", margin, currentY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const printedAt = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let subtitle = `Dicetak: ${printedAt} WIB  |  Total: ${targetReports.length} Laporan`;
    if (options?.startDate || options?.endDate) {
      const startLabel = options.startDate || "Awal";
      const endLabel = options.endDate || "Kini";
      subtitle = `Periode: ${startLabel} s/d ${endLabel}  |  ${subtitle}`;
    }
    doc.text(subtitle, margin, currentY + 5);

    currentY += 9;

    // Table rows with requested 7 columns
    const tableBody = targetReports.map((r, index) => {
      const shortId = String(r.id).replace(/-/g, "").slice(0, 8).toUpperCase();

      // Kolom: Lokasi / Grid (Kode grid, sisi, koordinat GPS)
      const gridText = r.segmentCode ? `Grid ${r.segmentCode}` : "Grid -";
      const sideText = r.side ? `Sisi ${r.side}` : "Sisi -";
      const gpsText =
        r.latitude != null && r.longitude != null
          ? `GPS: ${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`
          : "GPS: -";
      const lokasiGrid = `${gridText}\n${sideText}\n${gpsText}`;

      // Kolom: Bagian & Jenis Kerusakan
      const findingsList = (r.findings || []).map((f, i) => {
        const dmgList = (f.damages || []).map((d) =>
          typeof d === "string" ? d : (d as any).name
        );
        const dmg = dmgList.join(", ");
        const prefix = (r.findings || []).length > 1 ? `${i + 1}. ` : "";
        return dmg ? `${prefix}${f.partName} (${dmg})` : `${prefix}${f.partName}`;
      });
      const bagianKerusakan = findingsList.length > 0 ? findingsList.join("\n") : "-";

      // Kolom: Status
      const statusStr = r.deletedAt
        ? "Ditutup"
        : labels[r.status] || r.status;

      // Kolom: Keterangan (seluruh catatan dari temuan, sedang diperbaiki, telah ditangani)
      const noteLines: string[] = [];
      if (r.narrative && r.narrative.trim()) {
        noteLines.push(`• Temuan: ${r.narrative.trim()}`);
      }
      if (r.history && r.history.length > 0) {
        for (const h of r.history) {
          if (h.narrative && h.narrative.trim()) {
            const st = labels[h.status] || (h.status === "CLOSED" ? "Ditutup" : h.status);
            const actor = h.actorName ? ` (${h.actorName})` : "";
            noteLines.push(`• ${st}${actor}: ${h.narrative.trim()}`);
          }
        }
      }
      if (r.deletionReason && r.deletionReason.trim()) {
        const alreadyIncluded = noteLines.some((line) => line.includes(r.deletionReason!.trim()));
        if (!alreadyIncluded) {
          noteLines.push(`• Ditutup: ${r.deletionReason.trim()}`);
        }
      }
      const keterangan = noteLines.length > 0 ? noteLines.join("\n") : "-";

      // Kolom: Hari & Tanggal
      const hariTanggal = formatHariTanggal(r.createdAt);

      return [
        String(index + 1),
        shortId,
        hariTanggal,
        lokasiGrid,
        bagianKerusakan,
        r.reporterName || "Petugas Lapangan",
        statusStr,
        keterangan,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 15 },
      head: [
        [
          "No",
          "ID Laporan",
          "Hari & Tanggal",
          "Lokasi / Grid",
          "Bagian & Jenis Kerusakan",
          "Nama Pelapor",
          "Status",
          "Keterangan",
        ],
      ],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [10, 112, 119], // #0a7077
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 22, fontStyle: "bold", halign: "center" },
        2: { cellWidth: 32 },
        3: { cellWidth: 38 },
        4: { cellWidth: 46 },
        5: { cellWidth: 28 },
        6: { cellWidth: 24, halign: "center" },
        7: { cellWidth: "auto" },
      },
    });

    // Page numbers in footer
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      const footerY = pageHeight - 7;
      doc.text(
        "Dokumen rekapitulasi resmi diterbitkan otomatis oleh Airport Perimeter Reporting System (APRS).",
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

    doc.save(filename);

    toast.success("Dokumen PDF berhasil diunduh", {
      description: `File ${filename} telah disimpan ke perangkat Anda.`,
    });
  } catch (err) {
    console.error("Gagal mengunduh dokumen PDF rekapitulasi:", err);
    toast.error("Gagal mengunduh PDF", {
      description: "Terjadi kesalahan saat membuat dokumen PDF.",
    });
  }
}
