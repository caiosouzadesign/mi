import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { SegmentedNav, TabBar } from "@/components/TabBar";
import { tenantTabs } from "@/lib/nav";
import { getPropertyByToken } from "@/lib/queries";

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const property = await getPropertyByToken(token);
  if (!property) notFound();
  const tabs = tenantTabs(token);

  return (
    <>
      <header className="topbar">
        <Brand subtitle={property.name} />
        <SegmentedNav items={tabs} />
        {property.tenantName ? (
          <span className="tile sm" title={property.tenantName} aria-label={property.tenantName}>
            <span style={{ fontWeight: 650, fontSize: "0.85rem", color: "var(--text)" }}>{property.tenantName.charAt(0).toUpperCase()}</span>
          </span>
        ) : (
          <span />
        )}
      </header>
      {children}
      <TabBar items={tabs} />
    </>
  );
}
