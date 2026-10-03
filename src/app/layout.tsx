import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sora, Inter, Baloo_2 } from "next/font/google";
import { APP_NAME, APP_NAME_HI, INDEPENDENCE_DISCLAIMER } from "@/lib/constants";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const baloo = Baloo_2({ subsets: ["devanagari", "latin"], variable: "--font-baloo", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Ward 12, 13, 14 Civic Grievance Portal`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME_HI}: an independent citizen-run grievance portal for Ward 12, Ward 13 and Ward 14. Register civic complaints with photo and map location, and track them transparently. ${INDEPENDENCE_DISCLAIMER}`,
  keywords: ["civic complaints", "ward 12", "ward 13", "ward 14", "grievance portal", "jan samasya"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${baloo.variable}`}>
      <body className="bg-paper bg-grain text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
