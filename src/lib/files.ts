export function billFilename(bill: { provider: string | null; referenceMonth: string | null }) {
  return `conta-${bill.provider ?? "consumo"}-${bill.referenceMonth ?? "sem-data"}.pdf`;
}

export function fileResponse(bytes: Uint8Array, mime: string, filename: string, download: boolean) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}

export function pdfResponse(bytes: Uint8Array, filename: string, download: boolean) {
  return fileResponse(bytes, "application/pdf", filename, download);
}
