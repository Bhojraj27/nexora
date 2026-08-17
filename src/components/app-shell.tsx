"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  FolderKanban,
  Search,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Menu,
  X,
} from "lucide-react";
import { NexoraLogo } from "@/components/nexora-logo";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { logout } from "@/actions/auth";
import { initials } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/chat", label: "Chat", icon: MessageSquare },
  { href: "/app/documents", label: "Documents", icon: FileText },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/search", label: "Search", icon: Search },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
];

const FOOTER_ITEMS = [
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
];

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { workspace, user } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    setMobileOpen(false);
    await logout();
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <Link
          href="/app"
          className="flex h-14 items-center gap-2 border-b border-border px-4"
        >
          <NexoraLogo size={32} />
          <span className="text-lg font-bold tracking-tight">NEXORA</span>
        </Link>

        <div className="border-b border-border px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="h-6 w-6 rounded-md">
                    <AvatarImage src={workspace.logoUrl ?? undefined} />
                    <AvatarFallback className="rounded-md bg-accent/15 text-[10px] text-accent">
                      {initials(workspace.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">{workspace.name}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspace && (
                <DropdownMenuItem className="pointer-events-none opacity-60">
                  {workspace.name}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/app/workspace/new")}>
                Create workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="flex-1">
          <nav className="space-y-1 p-3">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <nav className="space-y-1">
            {FOOTER_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="mt-3 w-full justify-start gap-3 px-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-left text-sm">
                  <span className="block truncate font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push("/app/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/app/billing")}>
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Link href="/app" className="flex min-w-0 items-center gap-2 lg:hidden">
            <NexoraLogo size={28} />
            <span className="truncate font-bold tracking-tight">NEXORA</span>
          </Link>

          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-sm font-medium text-muted-foreground">
              {workspace.name}
            </p>
          </div>

          <div className="flex-1 lg:hidden" />

          <ThemeToggle />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="mobile-nav-dialog fixed inset-y-0 left-0 top-0 flex h-full w-[min(100vw,300px)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-r p-0 shadow-xl">
          <DialogTitle className="sr-only">Navigation menu</DialogTitle>

          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Link href="/app" className="flex items-center gap-2" onClick={closeMobile}>
              <NexoraLogo size={28} />
              <span className="font-bold tracking-tight">NEXORA</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={closeMobile} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="border-b border-border px-3 py-3">
            <div className="flex items-center gap-2 rounded-md bg-secondary/60 px-3 py-2">
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarImage src={workspace.logoUrl ?? undefined} />
                <AvatarFallback className="rounded-md bg-accent/15 text-[10px] text-accent">
                  {initials(workspace.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{workspace.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <nav className="space-y-1 p-3">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  pathname={pathname}
                  onNavigate={closeMobile}
                />
              ))}
            </nav>
            <div className="border-t border-border p-3">
              <nav className="space-y-1">
                {FOOTER_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    pathname={pathname}
                    onNavigate={closeMobile}
                  />
                ))}
              </nav>
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3">
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              Log out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
