import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileSearch, MessagesSquare, Search, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NexoraLogo } from "@/components/nexora-logo";
import { ColorPalette } from "@/components/color-palette";
import { ScrollReveal } from "@/components/scroll-reveal";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Intelligent ingestion",
    description:
      "Upload PDFs, DOCX, TXT, Markdown, and CSV. NEXORA extracts, chunks, and embeds everything automatically.",
    image: "/images/feature-ingestion.jpg",
  },
  {
    icon: MessagesSquare,
    title: "Chat with your knowledge",
    description:
      "Ask questions in plain English and get cited, source-grounded answers with references you can verify.",
    image: "/images/feature-chat.jpg",
  },
  {
    icon: Search,
    title: "Semantic search",
    description:
      "Find meaning, not just keywords. Search across every document in your workspace in milliseconds.",
    image: "/images/feature-search.jpg",
  },
  {
    icon: ShieldCheck,
    title: "Workspace isolation",
    description:
      "Role-based permissions and per-workspace data isolation keep every team's knowledge private.",
    image: "/images/feature-workspace.jpg",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <NexoraLogo size={32} />
            <span className="truncate text-lg font-bold tracking-tight">NEXORA</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">
                <span className="hidden sm:inline">Get started</span>
                <span className="sm:hidden">Start</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── HERO ─── */}
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-12 text-center sm:pt-24">
          <div className="landing-fade-in mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            Your AI-powered knowledge workspace
          </div>
          <h1 className="landing-fade-in-delay-1 mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Ask questions.
            <br />
            Get answers from{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              your documents.
            </span>
          </h1>
          <p className="landing-fade-in-delay-2 mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:mt-6 sm:text-lg">
            NEXORA turns your files into a searchable, queryable knowledge base. Upload, chat, and
            discover — no prompt engineering required.
          </p>
          <div className="landing-fade-in-delay-3 mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/login">Try the demo</Link>
            </Button>
          </div>
          <p className="landing-fade-in-delay-4 mt-4 text-xs text-muted-foreground">
            Demo account: demo@nexora.app / DemoPass123!
          </p>
        </section>

        {/* ─── HERO IMAGE ─── */}
        <section className="hero-image-section mx-auto max-w-5xl px-4 pb-16 sm:pb-20">
          <div className="hero-image-wrapper mx-auto overflow-hidden rounded-2xl border border-border shadow-2xl">
            <div className="hero-image-float">
              <Image
                src="/images/hero-illustration.jpg"
                alt="NEXORA AI Knowledge Workspace — dashboard showing documents, search, and AI chat connected through neural networks"
                width={1400}
                height={788}
                className="block h-auto w-full"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1120px"
              />
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section className="border-y border-border bg-surface/50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <ScrollReveal className="mb-10 text-center sm:mb-12">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Everything you need to unlock your knowledge
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                Powerful features designed to make your documents work for you.
              </p>
            </ScrollReveal>
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
              {FEATURES.map(({ icon: Icon, title, description, image }, index) => (
                <ScrollReveal key={title} delay={index * 80}>
                  <div className="feature-card group h-full overflow-hidden rounded-xl border border-border bg-surface">
                    <div className="relative h-44 overflow-hidden bg-surface-secondary sm:h-48">
                      <Image
                        src={image}
                        alt={title}
                        fill
                        className="feature-card-image object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
                    </div>
                    <div className="space-y-3 p-5 sm:p-6">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="text-lg font-semibold">{title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── COLOR PALETTE ─── */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <ColorPalette />
        </section>

        {/* ─── CTA ─── */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <ScrollReveal>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center sm:p-12">
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
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <NexoraLogo size={24} />
            <span className="font-semibold text-foreground">NEXORA</span>
          </div>
          <p>© {new Date().getFullYear()} NEXORA. Demo project.</p>
        </div>
      </footer>
    </div>
  );
}
