import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import { getSession } from "@/lib/auth/session";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your NEXORA account",
};

export default async function SignupPage() {
  const session = await getSession();
  if (session?.sub) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-xl font-bold tracking-tight">NEXORA</span>
      </div>
      {config.enableSignups ? (
        <SignupForm />
      ) : (
        <p className="text-sm text-muted-foreground">Signups are currently disabled.</p>
      )}
      <Link href="/" className="mt-8 text-xs text-muted-foreground hover:text-foreground">
        Back to home
      </Link>
    </div>
  );
}
