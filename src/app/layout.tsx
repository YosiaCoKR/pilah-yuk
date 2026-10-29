import type { Metadata, Viewport } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/* Body: designed for Jakarta's city identity — holds up at 14px on Android. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

/* Display: width axis gives the dates and times a public-signage weight. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pilah Yuk — angkut sampah RT/RW",
  description:
    "Pesan jemput sampah dari rumah, atur jadwal rutin, dan pilah dengan benar bersama channel RT/RW.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2122" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">{children}</body>
    </html>
  );
}
