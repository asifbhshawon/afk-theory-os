import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "../fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

const notoBengali = localFont({
  src: [
    {
      path: "../fonts/NotoSansBengali-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/NotoSansBengali-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/NotoSansBengali-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-noto-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AFK THEORY — Partner Portal",
  description: "Executive Business Position, Shared Calendar & Venture Performance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} font-sans bg-afk-black text-afk-offwhite antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
