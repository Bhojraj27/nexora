"use client";

import { createContext, useContext } from "react";

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "team";
  logoUrl: string | null;
  role: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

const WorkspaceContext = createContext<{
  workspace: WorkspaceInfo;
  user: SessionUser;
  workspaces: Array<{ workspace: WorkspaceInfo; role: string }>;
} | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: { workspace: WorkspaceInfo; user: SessionUser; workspaces: Array<{ workspace: WorkspaceInfo; role: string }> };
  children: React.ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
