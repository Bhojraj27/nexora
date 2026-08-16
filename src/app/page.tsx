import Link from "next/link";
import { ArrowRight, Sparkles, FileSearch, MessagesSquare, Search, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Intelligent ingestion",
    description:
      "Upload PDFs, DOCX, TXT, Markdown, and CSV. NEXORA extracts, chunks, and embeds everything automatically.",
  },
  {
    icon: MessagesSquare,
    title: "Chat with your knowledge",
    description:
      "Ask questions in plain English and get cited, source-grounded answers with references you can verify.",
  },
  {
    icon: Search,
    title: "Semantic search",
    description:
      "Find meaning, not just keywords. Search across every document in your workspace in milliseconds.",
  },
  {
    icon: ShieldCheck,
    title: "Workspace isolation",
    description:
      "Role-based permissions and per-workspace data isolation keep every team's knowledge private.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight">NEXORA</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:pt-24">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            Your AI-powered knowledge workspace
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Ask questions.
            <br />
            Get answers from{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              your documents.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            NEXORA turns your files into a searchable, queryable knowledge base. Upload, chat, and
            discover — no prompt engineering required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Try the demo</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Demo account: demo@nexora.app / DemoPass123!
          </p>
        </section>

        <section className="border-y border-border bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="space-y-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Start building your knowledge base today
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Free plan includes 5 documents, 100 AI questions per month, and 500 MB of storage.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/signup">
                Create your workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="font-semibold text-foreground">NEXORA</span>
          </div>
          <p>© {new Date().getFullYear()} NEXORA. Demo project.</p>
        </div>
      </footer>
    </div>
  );
}
