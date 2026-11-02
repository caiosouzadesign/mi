import type { Property } from "@/db/schema";

export function PropertyFields({ values }: { values?: Partial<Property> }) {
  const field = (name: keyof Property, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      {label}
      <input name={name} defaultValue={(values?.[name] as string | null | undefined) ?? ""} {...props} />
    </label>
  );
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="form-grid">
        {field("name", "Nome do imóvel", { required: true, placeholder: "Ex.: Apto Vila Mariana" })}
        {field("address", "Endereço", { placeholder: "Rua, número, complemento" })}
      </div>
      <div className="form-grid">
        {field("tenantName", "Nome do inquilino")}
        {field("tenantPhone", "WhatsApp do inquilino", { type: "tel", placeholder: "(11) 91234-5678" })}
        {field("tenantEmail", "E-mail do inquilino", { type: "email" })}
      </div>
      <div className="form-grid">
        {field("enelInstallation", "Nº da instalação Enel", { inputMode: "numeric", placeholder: "Está na conta de luz" })}
        {field("sabespCode", "RGI / fornecimento Sabesp", { inputMode: "numeric", placeholder: "Está na conta de água" })}
      </div>
    </div>
  );
}
