import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import GlobalLoaderProvider from "@/app/components/GlobalLoaderProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinPlanner",
  description: "Personal finance planning app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="min-h-full bg-app-bg text-app-text">
          <GlobalLoaderProvider>{children}</GlobalLoaderProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
