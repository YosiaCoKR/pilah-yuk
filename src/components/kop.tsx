import Link from "next/link";
import { IkonKembali } from "./ikon";

/** Page header for a full-screen flow: back affordance + title, no chrome. */
export function Kop({
  judul,
  keterangan,
  kembali = "/",
  kanan,
}: {
  judul: string;
  keterangan?: string;
  kembali?: string;
  kanan?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-screen-sm items-center gap-1 px-2 py-2">
        <Link
          href={kembali}
          aria-label="Kembali"
          className="grid size-11 shrink-0 place-items-center rounded-kartu text-ink-2 hover:bg-card"
        >
          <IkonKembali />
        </Link>
        <div className="min-w-0 flex-1 py-0.5">
          <h1 className="truncate text-[17px] font-bold leading-tight">
            {judul}
          </h1>
          {keterangan && (
            <p className="truncate text-[13px] text-ink-2">{keterangan}</p>
          )}
        </div>
        {kanan}
      </div>
    </header>
  );
}
