import type { ComponentProps, ReactNode } from "react";
import { WASTE_COLOR, categoryByKey } from "@/lib/mock";
import type { WasteKey } from "@/lib/types";

/**
 * Receipt-style field label: small, sentence case, with a rule running to the
 * edge. Reads as document structure the way a struk does — deliberately not a
 * tracked-out all-caps eyebrow.
 */
export function Label({
  children,
  aksi,
}: {
  children: ReactNode;
  aksi?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] font-semibold text-ink-2">{children}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {aksi}
    </div>
  );
}

/**
 * A printed card. Flat with a 1px border — no shadow, no blur: it renders
 * identically on a cheap Android screen and costs nothing to paint.
 */
export function Kartu({
  children,
  className = "",
  as: As = "div",
  id,
}: {
  children?: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section";
  /** Sasaran lompatan dalam halaman, mis. dari hasil pencarian. */
  id?: string;
}) {
  return (
    <As
      id={id}
      className={`rounded-kartu border border-line bg-card ${className}`}
    >
      {children}
    </As>
  );
}

/**
 * The perforation. Separates "when" from "what" on a ticket, the way a
 * tear-off stub does. The notches are cut in the page colour, so the card
 * reads as physically punched rather than drawn.
 */
export function Perforasi({ warna = "bg-paper" }: { warna?: string }) {
  return (
    <div className="relative h-0" aria-hidden>
      <span
        className={`absolute -left-[9px] top-1/2 size-4 -translate-y-1/2 rounded-full border border-line ${warna}`}
      />
      <span
        className={`absolute -right-[9px] top-1/2 size-4 -translate-y-1/2 rounded-full border border-line ${warna}`}
      />
      <span
        className="absolute inset-x-3 top-1/2 block h-px -translate-y-1/2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, var(--color-line-kuat) 0 5px, transparent 5px 10px)",
        }}
      />
    </div>
  );
}

/**
 * Waste category chip. The dot carries the bin colour — the only place these
 * colours are allowed to appear, because here the colour *is* the data.
 */
export function ChipSampah({
  jenis,
  ukuran = "md",
}: {
  jenis: WasteKey;
  ukuran?: "sm" | "md";
}) {
  const kategori = categoryByKey(jenis);
  const kecil = ukuran === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-kartu border border-line bg-paper font-medium text-ink ${
        kecil ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[13px]"
      }`}
    >
      <span
        aria-hidden
        className={kecil ? "size-2 rounded-full" : "size-2.5 rounded-full"}
        style={{ background: WASTE_COLOR[jenis] }}
      />
      {kategori.name}
    </span>
  );
}

/**
 * Labelled form field with help text and an error line. Help text is always
 * present, not a tooltip — warga reading on a cheap phone should never have
 * to hover to learn what a field wants.
 */
export function Isian({
  id,
  label,
  bantuan,
  value,
  onChange,
  placeholder,
  baris,
  opsional,
  galat,
  ...sisa
}: {
  id: string;
  label: string;
  bantuan: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  baris?: number;
  opsional?: boolean;
  galat?: string;
} & Omit<
  ComponentProps<"input">,
  "id" | "value" | "onChange" | "placeholder" | "className"
>) {
  const kelas = `w-full rounded-kartu border bg-paper p-3 text-[15px] placeholder:text-ink-3 ${
    galat ? "border-alarm" : "border-line"
  }`;
  const bantuanId = `${id}-bantuan`;
  const galatId = `${id}-galat`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[14px] font-semibold">
        {label}
        {opsional && (
          <span className="ml-1.5 font-normal text-ink-3">(boleh kosong)</span>
        )}
      </label>
      <p id={bantuanId} className="text-[13px] leading-snug text-ink-2">
        {bantuan}
      </p>
      {baris ? (
        <textarea
          id={id}
          rows={baris}
          value={value}
          aria-invalid={!!galat}
          aria-describedby={galat ? `${bantuanId} ${galatId}` : bantuanId}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${kelas} resize-none`}
        />
      ) : (
        <input
          id={id}
          value={value}
          aria-invalid={!!galat}
          aria-describedby={galat ? `${bantuanId} ${galatId}` : bantuanId}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${kelas} min-h-12`}
          {...sisa}
        />
      )}
      {galat && (
        <p id={galatId} className="text-[13px] font-medium text-alarm">
          {galat}
        </p>
      )}
    </div>
  );
}
