"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderKanban, Plus, Loader2, Trash2, MoreHorizontal } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { actionListProjects, actionCreateProject, actionDeleteProject } from "@/actions/project";

const COLORS = [
  { value: "indigo", class: "bg-indigo-500" },
  { value: "emerald", class: "bg-emerald-500" },
  { value: "amber", class: "bg-amber-500" },
  { value: "rose", class: "bg-rose-500" },
  { value: "sky", class: "bg-sky-500" },
  { value: "violet", class: "bg-violet-500" },
];

const COLOR_TO_CLASS: Record<string, string> = Object.fromEntries(
  COLORS.map((c) => [c.value, c.class]),
);

export function ProjectsClient() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("indigo");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () =>
      actionListProjects(workspaceId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data;
      }),
    enabled: Boolean(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: () => actionCreateProject(workspaceId, { name, description, color }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Project created");
        setOpen(false);
        setName("");
        setDescription("");
        queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      } else {
        toast.error(r.error);
      }
    },
  });

  async function removeProject(id: string) {
    const res = await actionDeleteProject(workspaceId, id);
    if (res.ok) toast.success("Project deleted");
    else toast.error(res.error);
    queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Organize documents and conversations into logical groups.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New project
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (projects ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderKanban className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium">No projects yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first project to organize your workspace.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((project) => (
            <Card key={project._id.toString()} className="group transition-colors hover:border-border-strong">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/app/projects/${project._id.toString()}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${COLOR_TO_CLASS[project.color] ?? "bg-indigo-500"} text-white`}
                    >
                      <FolderKanban className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {project.description || "No description"}
                      </p>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => removeProject(project._id.toString())}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q3 Product Research"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.value}
                    onClick={() => setColor(c.value)}
                    className={`h-7 w-7 rounded-full ${c.class} ${color === c.value ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
