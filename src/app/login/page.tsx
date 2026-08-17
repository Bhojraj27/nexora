import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NexoraLogo } from "@/components/nexora-logo";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to NEXORA",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session?.sub) redirect("/app");

  return (
    <div className="auth-page-bg flex min-h-screen flex-col bg-background">
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <NexoraLogo size={32} />
          <span className="text-lg font-bold tracking-tight">NEXORA</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-md border-border/80 shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <LoginForm />
          </CardContent>
        </Card>
        <Link href="/" className="mt-6 text-xs text-muted-foreground transition-colors hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
