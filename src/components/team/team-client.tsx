"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Mail, UserPlus, Loader2, Shield, MoreHorizontal, Trash2, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  actionListMembers,
  actionInviteMember,
  actionChangeMemberRole,
  actionRemoveMember,
  actionRevokeInvitation,
  actionResendInvitation,
} from "@/actions/team";
import { ROLES, type Role } from "@/lib/permissions";
import { initials, timeAgo } from "@/lib/utils";

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  OWNER: "default",
  ADMIN: "secondary",
  EDITOR: "secondary",
  VIEWER: "outline",
};

export function TeamClient() {
  const { workspace, user } = useWorkspace();
  const workspaceId = workspace.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");

  const { data, isLoading } = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () =>
      actionListMembers(workspaceId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId),
  });

  const members = data?.members ?? [];
  const invites = data?.pendingInvites ?? [];
  const canManage = workspace.role === "OWNER" || workspace.role === "ADMIN";

  const inviteMutation = useMutation({
    mutationFn: () => actionInviteMember(workspaceId, { email, role }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(`Invitation sent to ${email}`);
        setOpen(false);
        setEmail("");
        queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      } else {
        toast.error(r.error);
      }
    },
  });

  async function changeRole(targetUserId: string, newRole: Role) {
    const res = await actionChangeMemberRole(workspaceId, { targetUserId, role: newRole });
    if (res.ok) toast.success("Role updated");
    else toast.error(res.error);
    queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
  }

  async function removeMember(targetUserId: string, targetName: string) {
    const res = await actionRemoveMember(workspaceId, targetUserId);
    if (res.ok) toast.success(`${targetName} removed from workspace`);
    else toast.error(res.error);
    queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
  }

  async function revokeInvite(inviteId: string) {
    const res = await actionRevokeInvitation(workspaceId, inviteId);
    if (res.ok) toast.success("Invitation revoked");
    else toast.error(res.error);
    queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
  }

  async function resendInvite(inviteId: string) {
    const res = await actionResendInvitation(workspaceId, inviteId);
    if (res.ok) toast.success("Invitation resent");
    else toast.error(res.error);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage members and roles for {workspace.name}.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> Invite member
          </Button>
        )}
      </div>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Pending invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map((invite) => (
              <div key={invite._id.toString()} className="flex items-center gap-3 rounded-md p-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs bg-muted">?</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited {timeAgo(invite.createdAt)} · {invite.role}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => resendInvite(invite._id.toString())}>
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => revokeInvite(invite._id.toString())}
                      aria-label="Revoke invitation"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Members
          </CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? "" : "s"} in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}

          {members.map((member) => {
            const memberUser = member.userId as unknown as {
              _id: { toString: () => string };
              name: string;
              email: string;
              avatarUrl?: string | null;
              lastActiveAt?: Date | null;
            };
            const isSelf = memberUser._id.toString() === user.id;
            const canEdit = canManage && !isSelf && workspace.role === "OWNER";
            return (
              <div
                key={member._id.toString()}
                className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={memberUser.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">{initials(memberUser.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {memberUser.name} {isSelf && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{memberUser.email}</p>
                </div>
                <Badge variant={ROLE_BADGE[member.role] ?? "outline"}>{member.role}</Badge>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ROLES.map((r) => (
                        <DropdownMenuItem key={r} onClick={() => changeRole(memberUser._id.toString(), r)}>
                          {r}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => removeMember(memberUser._id.toString(), memberUser.name)}
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { role: "OWNER", desc: "Full access, billing, and member management" },
            { role: "ADMIN", desc: "Manage content and invite members" },
            { role: "EDITOR", desc: "Upload and edit documents" },
            { role: "VIEWER", desc: "Read-only access" },
          ].map((r) => (
            <div key={r.role} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium">{r.role}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!email || inviteMutation.isPending}
            >
              {inviteMutation.isPending && <Loader2 className="animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
