"use client";

import { useState } from "react";
import { WASTE_CATEGORIES, WASTE_COLOR, categoryByKey } from "@/lib/mock";
import type { WasteKey } from "@/lib/types";
import { IkonCentang } from "../ikon";
import { Label } from "../primitif";

export function SeksiJenis({
  terpilih,
  onUbah,
}: {
  terpilih: WasteKey[];
  onUbah: (next: WasteKey[]) => void;
}) {
  const [lihatTips, setLihatTips] = useState<WasteKey | null>(null);

  function toggle(key: WasteKey) {
    /* "Campuran" means not yet sorted, so it cannot be combined with a
       specific category — picking it clears the rest, and vice versa. */
    if (key === "campuran") {
      onUbah(terpilih.includes("campuran") ? [] : ["campuran"]);
      return;
    }
    const tanpaCampuran = terpilih.filter((k) => k !== "campuran");
    onUbah(
      tanpaCampuran.includes(key)
        ? tanpaCampuran.filter((k) => k !== key)
        : [...tanpaCampuran, key],
    );
  }

  return (
    <section className="space-y-3">
      <Label>Jenis sampah</Label>
      <p className="-mt-1 text-[13px] leading-snug text-ink-2">
        Pilih yang akan dijemput. Boleh lebih dari satu.
      </p>

      <ul className="grid grid-cols-2 gap-2">
        {WASTE_CATEGORIES.map((c) => {
          const aktif = terpilih.includes(c.key);
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => toggle(c.key)}
                onPointerEnter={() => setLihatTips(c.key)}
                onFocus={() => setLihatTips(c.key)}
                aria-pressed={aktif}
                className={`flex h-full min-h-[92px] w-full flex-col items-start gap-1 rounded-kartu border p-3 text-left ${
                  aktif
                    ? "border-hijau bg-hijau-tipis"
                    : "border-line bg-card hover:border-line-kuat"
                }`}
              >
                <span className="flex w-full items-center justify-between">
                  <span
                    aria-hidden
                    className="size-3.5 rounded-full"
                    style={{ background: WASTE_COLOR[c.key] }}
                  />
                  {aktif && <IkonCentang className="size-4 text-hijau" />}
                </span>
                <span className="text-[15px] font-semibold">{c.name}</span>
                <span className="text-[12px] leading-snug text-ink-2">
                  {c.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* The sorting tip is the "membantu pilah" promise, surfaced right where
          the choice is made rather than buried in a separate guide. */}
      {lihatTips && (
        <p
          aria-live="polite"
          className="flex gap-2 rounded-kartu border border-line bg-card p-3 text-[13px] leading-snug text-ink-2"
        >
          <span
            aria-hidden
            className="mt-1 size-2.5 shrink-0 rounded-full"
            style={{ background: WASTE_COLOR[lihatTips] }}
          />
          <span>
            <span className="font-semibold text-ink">
              {categoryByKey(lihatTips).name}:
            </span>{" "}
            {categoryByKey(lihatTips).handlingTip}
          </span>
        </p>
      )}

      {terpilih.includes("campuran") && (
        <p className="rounded-kartu border border-plastik/40 bg-plastik/8 p-3 text-[13px] leading-snug text-ink-2">
          Sampah campuran tetap dijemput, tapi petugas butuh waktu lebih lama
          memilah. Kalau sempat, pisahkan organiknya dulu.
        </p>
      )}
    </section>
  );
}
