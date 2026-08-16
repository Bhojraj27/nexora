import "server-only";
import type { PlanType } from "@/models/Workspace";

export interface PlanLimits {
  documents: number;
  aiRequestsPerMonth: number;
  storageBytes: number;
  workspaces: number;
  members: number;
  aiContextChars: number;
}

export interface Plan {
  id: PlanType;
  name: string;
  tagline: string;
  monthlyPriceUsd: number;
  limits: PlanLimits;
}

export const PLANS: Record<PlanType, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "For personal knowledge",
    monthlyPriceUsd: 0,
    limits: {
      documents: 5,
      aiRequestsPerMonth: 100,
      storageBytes: 500 * 1024 * 1024,
      workspaces: 1,
      members: 3,
      aiContextChars: 30000,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For serious researchers",
    monthlyPriceUsd: 12,
    limits: {
      documents: 100,
      aiRequestsPerMonth: 5000,
      storageBytes: 20 * 1024 * 1024 * 1024,
      workspaces: 5,
      members: 10,
      aiContextChars: 50000,
    },
  },
  team: {
    id: "team",
    name: "Team",
    tagline: "For collaborative teams",
    monthlyPriceUsd: 29,
    limits: {
      documents: 10000,
      aiRequestsPerMonth: 25000,
      storageBytes: 100 * 1024 * 1024 * 1024,
      workspaces: 20,
      members: 100,
      aiContextChars: 80000,
    },
  },
};

export function getPlan(plan: PlanType): Plan {
  return PLANS[plan];
}
