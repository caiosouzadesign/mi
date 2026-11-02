import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminTopbar } from "@/components/AdminTopbar";
import { Icon } from "@/components/Icon";
import { SegmentedNav } from "@/components/TabBar";
import { requireAdmin } from "@/lib/auth";
import { adminPropertyTabs } from "@/lib/nav";

export default async function PropertyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, id));
  if (!property) notFound();

  return (
    <>
      <AdminTopbar />
      <main className="page">
        <section className="intro" style={{ gap: 10 }}>
          <Link href="/admin" className="eyebrow row" style={{ gap: 4 }}>
            <Icon name="back" size={16} />
            Seus imóveis
          </Link>
          <h1>{property.name}</h1>
          <p className="muted">
            {property.tenantName ?? "Sem inquilino"}
            {property.address ? ` · ${property.address}` : ""}
          </p>
          <div>
            <SegmentedNav items={adminPropertyTabs(id)} inline />
          </div>
        </section>
        {children}
      </main>
    </>
  );
}
