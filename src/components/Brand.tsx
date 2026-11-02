import Link from "next/link";
import { Icon } from "./Icon";

export function Brand({ href, subtitle }: { href?: string; subtitle?: string }) {
  const content = (
    <>
      <span className="brand-mark">
        <Icon name="receipt" size={18} />
      </span>
      <span>
        Contas do imóvel
        {subtitle && <small>{subtitle}</small>}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="brand">
      {content}
    </Link>
  ) : (
    <span className="brand">{content}</span>
  );
}
