import { requireAuthRedirect, getUserWorkspaces } from "@/lib/auth/context";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuthRedirect();
  const session = await getSession();
  const memberships = await getUserWorkspaces(user._id);

  const activeWorkspaceId = session?.ws ?? memberships[0]?.workspace._id.toString();
  const active = memberships.find((m) => m.workspace._id.toString() === activeWorkspaceId) ?? memberships[0];

  if (!active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">No workspaces yet</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create a workspace to start uploading documents and asking questions.
        </p>
      </div>
    );
  }

  return (
    <WorkspaceProvider
      value={{
        workspace: {
          id: active.workspace._id.toString(),
          name: active.workspace.name,
          slug: active.workspace.slug,
          plan: active.workspace.plan,
          logoUrl: active.workspace.logoUrl ?? null,
          role: active.role,
        },
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
          emailVerified: user.emailVerified,
        },
        workspaces: memberships.map((m) => ({
          workspace: {
            id: m.workspace._id.toString(),
            name: m.workspace.name,
            slug: m.workspace.slug,
            plan: m.workspace.plan,
            logoUrl: m.workspace.logoUrl ?? null,
            role: m.role,
          },
          role: m.role,
        })),
      }}
    >
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
