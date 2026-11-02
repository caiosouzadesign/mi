/**
 * Dados de demonstração: 2 imóveis com 6 meses de contas geradas em PDF.
 * Uso: npm run seed  (usa DATABASE_URL, padrão file:local.db)
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ingestBillPdf } from "@/lib/ingest";
import { newToken } from "@/lib/tokens";
import { makeFormattedDigitable, makePdf } from "../tests/helpers";

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function shiftDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Ilustração simples de um cômodo (só para a demonstração) */
function roomSvg(wall: string, floor: string) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="#f4f1ec"/></linearGradient>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${floor}"/><stop offset="1" stop-color="#8a6a4f"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc8f0"/><stop offset="1" stop-color="#e6f1fb"/></linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#w)"/>
  <rect y="860" width="1600" height="340" fill="url(#f)"/>
  <rect x="980" y="210" width="420" height="470" rx="18" fill="url(#sky)" stroke="#fff" stroke-width="22"/>
  <line x1="1190" y1="210" x2="1190" y2="680" stroke="#fff" stroke-width="14"/>
  <rect x="180" y="610" width="620" height="260" rx="40" fill="#cfc6ba"/>
  <rect x="210" y="540" width="560" height="140" rx="36" fill="#ddd5ca"/>
  <rect x="320" y="250" width="300" height="200" rx="10" fill="#e9e4dc" stroke="#cbbfae" stroke-width="10"/>
</svg>`);
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

async function main() {
  const db = await getDb();
  const homes = [
    {
      name: "Apto Vila Mariana", address: "Rua Exemplo, 123 — ap. 41", tenantName: "Ana Souza", tenantPhone: "11912345678", tenantEmail: "ana@example.com",
      enelInstallation: "11223344", sabespCode: "0123456789-0", contractStart: shiftDays(-640), contractEnd: shiftDays(80), rentCents: 285000,
    },
    {
      name: "Casa Butantã", address: "Rua Modelo, 45", tenantName: "Bruno Lima", tenantPhone: "11987654321",
      enelInstallation: "55667788", sabespCode: "9876543210-1", contractStart: shiftDays(-150), contractEnd: shiftDays(580), rentCents: 340000,
    },
  ];
  const now = new Date();
  for (const [h, home] of homes.entries()) {
    const [existing] = await db.select().from(schema.properties).where(eq(schema.properties.name, home.name));
    const property = existing ?? (await db.insert(schema.properties).values({ ...home, accessToken: newToken() }).returning())[0];
    const kwh = [180, 195, 170, 210, 205, h === 0 ? 290 : 200];
    const m3 = [12, 11, 13, 12, 14, h === 1 ? 24 : 13];
    for (let i = 0; i < 6; i++) {
      const ref = addMonths(now.getUTCFullYear(), now.getUTCMonth() + 1, i - 6);
      const due = addMonths(ref.y, ref.m, 1);
      const dueStr = `${i === 5 ? "28" : "10"}/${String(due.m).padStart(2, "0")}/${due.y}`;
      const enelCents = Math.round(kwh[i] * 0.92 * 100);
      const sabespCents = Math.round((40 + m3[i] * 6.5) * 100);
      const enel = await makePdf([
        "ENEL DISTRIBUICAO SAO PAULO",
        `No DA INSTALACAO ${home.enelInstallation}`,
        `REFERENCIA ${MONTHS[ref.m - 1]}/${ref.y}   VENCIMENTO ${dueStr}`,
        `Consumo kWh ${kwh[i]}`,
        i === 5 ? "Bandeira tarifaria amarela vigente neste mes." : "Bandeira tarifaria verde.",
        makeFormattedDigitable("3", "6", enelCents, `00${h}${i}48123456789012345678901`),
      ]);
      const sabesp = await makePdf([
        "SABESP - Companhia de Saneamento Basico do Estado de Sao Paulo",
        `RGI ${home.sabespCode}`,
        `Referencia: ${String(ref.m).padStart(2, "0")}/${ref.y}`,
        `Data de vencimento ${dueStr}`,
        `Consumo faturado ${m3[i]} m3`,
        makeFormattedDigitable("2", "6", sabespCents, `11${h}${i}48123456789012345678901`),
      ]);
      for (const pdf of [enel, sabesp]) {
        const r = await ingestBillPdf(pdf, { filename: "demo.pdf", source: "upload" });
        if (r.status === "created" && i < 5 - h) {
          await db.update(schema.bills).set({ status: "pago", paidAt: `${due.y}-${String(due.m).padStart(2, "0")}-08` }).where(eq(schema.bills.id, r.billId));
        }
      }
    }
    const contractPdf = await makePdf([
      "CONTRATO DE LOCACAO RESIDENCIAL (EXEMPLO)",
      `Imovel: ${home.address}`,
      `Locatario: ${home.tenantName}`,
      `Prazo: ${home.contractStart} a ${home.contractEnd}`,
      `Aluguel mensal: R$ ${(home.rentCents / 100).toFixed(2)}`,
    ]);
    await db.insert(schema.documents).values({
      propertyId: property.id, kind: "contrato", title: "Contrato de locação", file: Buffer.from(contractPdf), filename: "contrato.pdf",
      shareToken: newToken(), signatureStatus: "signed", signatureProvider: "manual", signedAt: home.contractStart,
    });
    if (h === 0) {
      const share = newToken();
      await db.insert(schema.documents).values({
        propertyId: property.id, kind: "aditivo", title: "Aditivo de renovação", file: Buffer.from(await makePdf(["ADITIVO DE RENOVACAO (EXEMPLO)"])),
        filename: "aditivo.pdf", shareToken: share, signatureStatus: "pending", signatureProvider: "demo", tenantSignUrl: `/d/${share}`,
      });
    }
    const rooms: [string, string, string][] = [["Sala", "#e9e2d6", "#b48a66"], ["Cozinha", "#dfe8e4", "#a98a70"], ["Quarto", "#e6e0ee", "#b9987a"], ["Banheiro", "#dde8ef", "#9fa6ad"], ["Área de serviço", "#ece6da", "#a7a19a"]];
    for (const [i, [label, wall, floor]] of rooms.entries()) {
      await db.insert(schema.photos).values({ propertyId: property.id, image: roomSvg(wall, floor), mime: "image/svg+xml", caption: label, width: 1600, height: 1200, position: i + 1 });
    }
    console.log(`${property.name}: http://localhost:3000/t/${property.accessToken}`);
  }
  await db.insert(schema.notices).values({
    propertyId: null,
    provider: "sabesp",
    title: "Manutenção programada na rede — possível falta de água",
    body: "A Sabesp informa manutenção na rede de distribuição no dia 05, das 8h às 17h.",
    source: "email",
  });
}

main();
