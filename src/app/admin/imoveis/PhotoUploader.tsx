"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";

const MAX_SIDE = 1920;

/** Reduz a foto no próprio aparelho (máx. 1920 px, JPEG) antes de enviar */
async function compress(file: File): Promise<{ file: File; w: number; h: number }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { file, w: 0, h: 0 };
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob || blob.size >= file.size) return { file, w: bitmap.width, h: bitmap.height };
  return { file: new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }), w, h };
}

export function PhotoUploader({ action }: { action: (prev: string | null, fd: FormData) => Promise<string | null> }) {
  const [state, formAction] = useActionState(
    async (prev: { error: string | null; n: number }, fd: FormData) => ({ error: await action(null, fd), n: prev.n + 1 }),
    { error: null, n: 0 },
  );
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const photosInput = useRef<HTMLInputElement>(null);
  const dimsInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // depois de cada envio, limpa a seleção
  useEffect(() => {
    if (state.n === 0) return;
    setPreviews([]);
    formRef.current?.reset();
  }, [state.n]);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const prepared = await Promise.all(Array.from(files).map(compress));
    const dt = new DataTransfer();
    prepared.forEach((p) => dt.items.add(p.file));
    if (photosInput.current) photosInput.current.files = dt.files;
    if (dimsInput.current) dimsInput.current.value = JSON.stringify(prepared.map(({ w, h }) => ({ w, h })));
    setPreviews(prepared.map((p) => URL.createObjectURL(p.file)));
    setBusy(false);
  }

  return (
    <form ref={formRef} action={formAction} className="stack" style={{ gap: 16 }}>
      <label className="dropzone">
        <input type="file" accept="image/*" multiple onChange={(e) => onPick(e.target.files)} />
        <strong>{busy ? "Preparando fotos…" : "Adicionar fotos do imóvel"}</strong>
        <span className="orb">
          <Icon name="image" size={30} />
        </span>
        <span className="small faint">Tire na hora ou escolha da galeria. As fotos são reduzidas automaticamente.</span>
      </label>
      <input ref={photosInput} type="file" name="photos" multiple hidden />
      <input ref={dimsInput} type="hidden" name="dims" defaultValue="[]" />
      {previews.length > 0 && (
        <div className="photo-admin">
          {previews.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" />
          ))}
        </div>
      )}
      <label className="field">
        Legenda (opcional, vale para todas desta vez)
        <input name="caption" placeholder="Ex.: Sala, Cozinha, Banheiro social" />
      </label>
      <SubmitButton className="btn primary" pendingText="Enviando fotos…">
        <Icon name="upload" size={18} />
        Enviar {previews.length > 0 ? `${previews.length} foto${previews.length > 1 ? "s" : ""}` : "fotos"}
      </SubmitButton>
      {state.error && <p className="form-error">{state.error}</p>}
    </form>
  );
}
