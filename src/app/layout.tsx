import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui/toast";
import { MotionProvider } from "@/components/ui/motion";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "KM Media Training Institute — Management Platform",
  description:
    "Learn. Create. Lead. Academic, administrative, financial, and learning management platform for KM Media Training Institute.",
  icons: {
    icon: "/images/logo.jpeg",
    apple: "/images/logo.jpeg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0994C4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh antialiased selection:bg-brand-100 selection:text-brand-900">
        <MotionProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
