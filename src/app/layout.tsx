import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";
import { getCurrentUser } from "@/lib/auth";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "AFK THEORY Business OS",
  description: "Internal Business Management & Double-Entry Accounting System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const user = await getCurrentUser();

  // Bare pages that must render standalone without application chrome
  const isBareLayout =
    pathname.startsWith("/login") ||
    pathname.startsWith("/setup") ||
    pathname.startsWith("/print");

  return (
    <html lang="en" className="dark">
      <body className="bg-afk-black text-afk-offwhite min-h-screen flex selection:bg-afk-olive selection:text-afk-offwhite antialiased">
        {!isBareLayout ? (
          <>
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
              <Header />
              <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
                {children}
              </main>
            </div>
            <MobileNav />
          </>
        ) : (
          <main className="min-h-screen w-full flex-1">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
