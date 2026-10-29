/* Hand-drawn 24px stroke icons. Inline SVG keeps them free on a slow
   connection — no icon-font or sprite request. */

type P = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IkonBeranda = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

/* The gerobak — the handcart warga actually see collecting their waste. */
export const IkonJemput = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 5h2.3l1.2 9.5h11" />
    <path d="M6.5 8h13l-1.4 6.5" />
    <circle cx="9.5" cy="18.5" r="1.8" />
    <circle cx="16.5" cy="18.5" r="1.8" />
  </svg>
);

export const IkonJadwal = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
    <path d="M3.5 10h17M8 3.5V7M16 3.5V7" />
    <path d="M7.5 14h3M13.5 14h3M7.5 17h3" />
  </svg>
);

export const IkonRiwayat = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4.5V9H8" />
    <path d="M12 8v4.3l3 1.8" />
  </svg>
);

export const IkonChannel = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 10a2.6 2.6 0 1 0 0-5.2A2.6 2.6 0 0 0 9 10Z" />
    <path d="M16.5 10.2a2.2 2.2 0 1 0 0-4.4" />
    <path d="M3.5 19v-1.4A4.1 4.1 0 0 1 7.6 13.5h2.8a4.1 4.1 0 0 1 4.1 4.1V19" />
    <path d="M17 13.6h.6a3.4 3.4 0 0 1 3.4 3.4V18" />
  </svg>
);

export const IkonPanduan = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 7.5c0-1.9-1.8-3.2-4.5-3.2H4v13h4.2c2 0 3.8.9 3.8 2.2" />
    <path d="M12 7.5c0-1.9 1.8-3.2 4.5-3.2H20v13h-4.2c-2 0-3.8.9-3.8 2.2" />
    <path d="M12 7.5v13.2" />
  </svg>
);

export const IkonLangganan = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="6" width="18" height="12" rx="1.6" />
    <path d="M3 10.2h18" />
    <path d="M6.5 14h4" />
  </svg>
);

export const IkonProfil = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8.5" r="3.4" />
    <path d="M4.8 20v-1a4.6 4.6 0 0 1 4.6-4.6h5.2a4.6 4.6 0 0 1 4.6 4.6v1" />
  </svg>
);

export const IkonPeta = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21Z" />
    <circle cx="12" cy="10.3" r="2.3" />
  </svg>
);

export const IkonJam = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3.2 1.9" />
  </svg>
);

export const IkonKembali = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);

export const IkonLanjut = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);

export const IkonCentang = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12.5 9.5 17 19 7.5" />
  </svg>
);

export const IkonTambah = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const IkonCari = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

export const IkonUnduh = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4.5 19h15" />
  </svg>
);

export const IkonLonceng = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.3 5.4 1.3 5.4H5.2S6.5 14 6.5 10Z" />
    <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);

export const IkonTutup = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
