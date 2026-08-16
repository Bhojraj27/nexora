"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, CreditCard, X } from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  actionGetSubscription,
  actionSubscribe,
  actionCancelSubscription,
} from "@/actions/billing";
import { cn, formatDate } from "@/lib/utils";

interface Subscription {
  plan: "free" | "pro" | "team";
  status: string | null;
  currentPeriodEnd: string | Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    tagline: "For personal knowledge",
    features: [
      "5 documents",
      "100 AI questions / month",
      "500 MB storage",
      "Up to 3 members",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    tagline: "For serious researchers",
    features: [
      "100 documents",
      "5,000 AI questions / month",
      "20 GB storage",
      "Up to 10 members",
      "Priority processing",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$29",
    tagline: "For collaborative teams",
    features: [
      "10,000 documents",
      "25,000 AI questions / month",
      "100 GB storage",
      "Up to 100 members",
      "Shared workspaces",
    ],
  },
];

export function BillingClient() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["subscription", workspaceId],
    queryFn: () =>
      actionGetSubscription(workspaceId).then((r) => {
        if (!r.ok) throw new Error(r.error);
        return r.data as Subscription;
      }),
    enabled: Boolean(workspaceId),
  });

  const subscribeMutation = useMutation({
    mutationFn: (plan: string) => actionSubscribe(workspaceId, { plan: plan as "free" | "pro" | "team" }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Plan updated");
        queryClient.invalidateQueries({ queryKey: ["subscription", workspaceId] });
      } else {
        toast.error(r.error);
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => actionCancelSubscription(workspaceId),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Subscription will cancel at period end");
        queryClient.invalidateQueries({ queryKey: ["subscription", workspaceId] });
      } else {
        toast.error(r.error);
      }
    },
  });

  const currentPlan = subscription?.plan ?? "free";
  const canManage = workspace.role === "OWNER" || workspace.role === "ADMIN";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace plan and limits.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <>
          {subscription && subscription.plan !== "free" && (
            <Card className="border-accent/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Current subscription
                </CardTitle>
                <CardDescription>
                  You&apos;re on the{" "}
                  <span className="font-medium capitalize text-foreground">
                    {subscription.plan}
                  </span>{" "}
                  plan
                  {subscription.cancelAtPeriodEnd && (
                    <Badge variant="warning" className="ml-2">
                      Canceling at period end
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {subscription.currentPeriodEnd && (
                  <p className="text-muted-foreground">
                    Current period ends{" "}
                    {formatDate(subscription.currentPeriodEnd)}
                  </p>
                )}
                {canManage && subscription.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => subscribeMutation.mutate(subscription.plan)}
                    disabled={subscribeMutation.isPending}
                  >
                    Resume subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const active = plan.id === currentPlan;
              return (
                <Card
                  key={plan.id}
                  className={cn(
                    "flex flex-col transition-colors",
                    active && "border-primary ring-1 ring-primary",
                  )}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {active && <Badge>Current</Badge>}
                    </div>
                    <p className="text-3xl font-bold">
                      {plan.price}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <CardDescription>{plan.tagline}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="flex-1 space-y-2 text-sm">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      {canManage ? (
                        active ? (
                          plan.id === currentPlan && currentPlan !== "free" && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => cancelMutation.mutate()}
                              disabled={cancelMutation.isPending}
                            >
                              <X className="h-4 w-4" /> Cancel plan
                            </Button>
                          )
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => subscribeMutation.mutate(plan.id)}
                            disabled={subscribeMutation.isPending}
                          >
                            {subscribeMutation.isPending && <Loader2 className="animate-spin" />}
                            {plan.id === "free" ? "Downgrade to Free" : `Upgrade to ${plan.name}`}
                          </Button>
                        )
                      ) : (
                        <p className="text-center text-xs text-muted-foreground">
                          Only workspace admins can change the plan.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Demo mode: billing is simulated. No real charges are made.
          </p>
        </>
      )}
    </div>
  );
}
