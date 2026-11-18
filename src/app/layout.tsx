import type { Metadata } from "next";
import { Geist, Geist_Mono, Josefin_Sans } from "next/font/google";
import { NavigationPendingProvider } from "@/components/navigation/navigation-pending";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Heading font from the mocks; exposed as the `font-heading` utility. */
const josefinSans = Josefin_Sans({
  variable: "--font-josefin-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Out of Pills",
  description:
    "Know when each medication runs out: enter the stock once and Out of Pills calculates the run-out date for you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${josefinSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavigationPendingProvider>{children}</NavigationPendingProvider>
        <Toaster />
      </body>
    </html>
  );
}
