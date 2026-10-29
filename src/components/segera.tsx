import { Kartu } from "./primitif";

/** Placeholder for a screen whose own task has not landed yet. */
export function Segera({ judul }: { judul: string }) {
  return (
    <Kartu className="p-6 text-center">
      <p className="text-[15px] font-semibold">{judul}</p>
      <p className="mt-1 text-[13px] text-ink-2">Layar ini sedang dibangun.</p>
    </Kartu>
  );
}
