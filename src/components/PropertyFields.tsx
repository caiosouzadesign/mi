import type { Property } from "@/db/schema";

export function PropertyFields({ values }: { values?: Partial<Property> }) {
  return (
    <div className="form-grid">
      <label>
        Nome do imóvel
        <input name="name" required defaultValue={values?.name ?? ""} placeholder="Ex.: Apto Vila Mariana" />
      </label>
      <label>
        Endereço
        <input name="address" defaultValue={values?.address ?? ""} />
      </label>
      <label>
        Nome do inquilino
        <input name="tenantName" defaultValue={values?.tenantName ?? ""} />
      </label>
      <label>
        WhatsApp do inquilino
        <input name="tenantPhone" type="tel" defaultValue={values?.tenantPhone ?? ""} placeholder="(11) 91234-5678" />
      </label>
      <label>
        E-mail do inquilino
        <input name="tenantEmail" type="email" defaultValue={values?.tenantEmail ?? ""} />
      </label>
      <label>
        Nº da instalação Enel
        <input name="enelInstallation" inputMode="numeric" defaultValue={values?.enelInstallation ?? ""} />
      </label>
      <label>
        RGI / fornecimento Sabesp
        <input name="sabespCode" inputMode="numeric" defaultValue={values?.sabespCode ?? ""} />
      </label>
    </div>
  );
}
