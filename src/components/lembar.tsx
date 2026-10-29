"use client";

import { useEffect, useRef } from "react";
import { IkonTutup } from "./ikon";

/**
 * Bottom sheet built on <dialog>, so focus trapping, Esc, and the top layer
 * come from the platform instead of from a modal library.
 */
export function Lembar({
  buka,
  onTutup,
  judul,
  children,
}: {
  buka: boolean;
  onTutup: () => void;
  judul: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (buka && !d.open) d.showModal();
    if (!buka && d.open) d.close();
  }, [buka]);

  return (
    <dialog
      ref={ref}
      onClose={onTutup}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) dismisses.
        if (e.target === ref.current) onTutup();
      }}
      className="m-0 mt-auto w-full max-w-screen-sm place-self-end rounded-t-xl border border-line bg-card p-0 text-ink backdrop:bg-ink/40 sm:mx-auto sm:mb-0"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-[16px] font-bold">{judul}</h2>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup"
          className="grid size-10 place-items-center rounded-kartu text-ink-2 hover:bg-paper"
        >
          <IkonTutup className="size-5" />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </dialog>
  );
}
