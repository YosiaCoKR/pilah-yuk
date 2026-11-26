/** Rangka selagi data warga dimuat — menahan tinggi supaya tidak melompat. */
export function Memuat() {
  return (
    <div
      aria-busy
      aria-label="Memuat"
      className="mx-auto max-w-screen-sm space-y-4 px-4 pt-6"
    >
      <div className="h-8 w-1/2 animate-pulse rounded-kartu bg-line" />
      <div className="h-40 animate-pulse rounded-kartu bg-line" />
      <div className="h-24 animate-pulse rounded-kartu bg-line" />
    </div>
  );
}
