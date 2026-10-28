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

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

async function main() {
  const db = await getDb();
  const homes = [
    { name: "Apto Vila Mariana", address: "Rua Exemplo, 123 — ap. 41", tenantName: "Ana Souza", tenantPhone: "11912345678", enelInstallation: "11223344", sabespCode: "0123456789-0" },
    { name: "Casa Butantã", address: "Rua Modelo, 45", tenantName: "Bruno Lima", tenantPhone: "11987654321", enelInstallation: "55667788", sabespCode: "9876543210-1" },
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
