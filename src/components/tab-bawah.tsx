"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IkonBeranda,
  IkonChannel,
  IkonJadwal,
  IkonPanduan,
  IkonProfil,
} from "./ikon";

const TAB = [
  { href: "/", label: "Beranda", Ikon: IkonBeranda },
  { href: "/jadwal", label: "Jadwal", Ikon: IkonJadwal },
  { href: "/channel", label: "Channel", Ikon: IkonChannel },
  { href: "/panduan", label: "Panduan", Ikon: IkonPanduan },
  { href: "/profil", label: "Profil", Ikon: IkonProfil },
];

function Rangka({ path }: { path: string | null }) {
  return (
    <nav
      aria-label="Menu utama"
      className="sticky bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {TAB.map(({ href, label, Ikon }) => {
          const aktif =
            path === null
              ? false
              : href === "/"
                ? path === "/"
                : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  aktif ? "text-hijau" : "text-ink-3"
                }`}
              >
                <Ikon className="size-[22px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Menandai tab aktif butuh `usePathname`, dan pada route dinamis nilainya
 * baru ada saat runtime — itu memblokir prerender. Rangka tanpa penanda
 * dipakai sebagai fallback Suspense: bentuknya identik, jadi tidak ada yang
 * bergeser saat penandanya menyusul.
 */
export function TabBawahRangka() {
  return <Rangka path={null} />;
}

export function TabBawah() {
  return <Rangka path={usePathname()} />;
}
