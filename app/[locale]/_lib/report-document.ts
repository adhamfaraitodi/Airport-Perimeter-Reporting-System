import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "@/components/ui/sonner";
import type { ReportRecord } from "./client-api";
import { dateText, labels } from "./draft-store";

/**
 * Loads an image from URL and converts it to a PNG Data URL via HTML5 canvas.
 */
async function loadImageDataUrl(url: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Fetches user's private wet signature from internal API if available.
 */
async function tryFetchSignature(userId?: string): Promise<string | null> {
  if (!userId || typeof window === "undefined") return null;
  try {
    const res = await fetch(`/api/profile/signature/${userId}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

    const logoDataUrl = await loadImageDataUrl(logoUrl);

    if (logoDataUrl) {
      // Draw Logo on left
      doc.addImage(logoDataUrl, "PNG", margin, currentY - 2, 38, 12);
    }

    // Right Header Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.text("PT ANGKASA PURA INDONESIA", pageWidth - margin, currentY + 1, {
      align: "right",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // #475569
    doc.text(
      "Bandar Udara Internasional Yogyakarta (YIA)",
      pageWidth - margin,
      currentY + 5.5,
      { align: "right" }
    );
    doc.text(
      "Airport Perimeter Reporting System (APRS)",
      pageWidth - margin,
      currentY + 9.5,
      { align: "right" }
    );

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
        .map((d) => (typeof d === "string" ? d : d.name))
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
    const technicianId = technicianEntry?.actorId;

    const [reporterSign, technicianSign] = await Promise.all([
      tryFetchSignature(report.reporterId),
      tryFetchSignature(technicianId),
    ]);

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
    const signImages = [reporterSign, technicianSign, null];

    for (let i = 0; i < 3; i++) {
      const boxX = margin + i * boxWidth;
      const centerX = boxX + boxWidth / 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(signTitles[i], centerX, currentY + 3, { align: "center" });

      // Embed signature if available
      const signImg = signImages[i];
      if (signImg) {
        try {
          const signW = 32;
          const signH = 15;
          doc.addImage(
            signImg,
            "PNG",
            centerX - signW / 2,
            currentY + 5.5,
            signW,
            signH
          );
        } catch {
          // ignore
        }
      }

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
        "Dokumen resmi diterbitkan otomatis oleh Airport Perimeter Reporting System (APRS) YIA.",
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
