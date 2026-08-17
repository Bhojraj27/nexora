import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NEXORA — AI Knowledge Workspace",
    template: "%s · NEXORA",
  },
  description:
    "Upload documents, ask questions, and get grounded answers from your knowledge base with NEXORA.",
  keywords: ["knowledge base", "RAG", "AI workspace", "document Q&A", "NEXORA"],
  applicationName: "NEXORA",
  metadataBase: new URL("https://nexora.app"),
  openGraph: {
    type: "website",
    title: "NEXORA — AI Knowledge Workspace",
    description: "Your documents, your AI. Ask anything about your knowledge base.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider defaultTheme="system">
          <Providers>
            {children}
            <Toaster richColors position="top-right" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
