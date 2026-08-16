"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  setSessionCookie,
  clearSessionCookie,
  getSession,
  updateSessionWorkspace,
} from "@/lib/auth/session";
import { UserModel } from "@/models/User";
import { WorkspaceModel } from "@/models/Workspace";
import { WorkspaceMemberModel } from "@/models/WorkspaceMember";
import { AuthError, ValidationError } from "@/lib/errors";
import { config } from "@/lib/config";
import { logAudit } from "@/services/auditService";
import { getEmailProvider } from "@/services/emailService";
import { runAction, type ActionResult } from "@/actions/helpers";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function login(input: z.infer<typeof loginSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const parsed = loginSchema.parse(input);
    await connectDB();

    const user = await UserModel.findOne({ email: parsed.email.toLowerCase() }).lean();
    if (!user || !(await verifyPassword(parsed.password, user.passwordHash))) {
      throw new AuthError("Invalid email or password");
    }

    const membership = await WorkspaceMemberModel.findOne({ userId: user._id })
      .sort({ createdAt: 1 })
      .lean();
    await setSessionCookie({ sub: user._id.toString(), ws: membership?.workspaceId.toString() });
    await UserModel.updateOne({ _id: user._id }, { lastActiveAt: new Date() });

    return { redirectTo: "/app" };
  });
}

export async function signup(input: z.infer<typeof signupSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    if (!config.enableSignups) throw new ValidationError("Signups are currently disabled");
    const parsed = signupSchema.parse(input);
    await connectDB();

    const existing = await UserModel.findOne({ email: parsed.email.toLowerCase() }).lean();
    if (existing) throw new ValidationError("An account with this email already exists");

    const user = await UserModel.create({
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      passwordHash: await hashPassword(parsed.password),
      emailVerified: !config.isProduction,
      onboardingCompleted: false,
    });

    const workspace = await WorkspaceModel.create({
      name: `${parsed.name.split(" ")[0] ?? "My"}'s Workspace`,
      slug: `${(parsed.name.split(" ")[0] ?? "my").toLowerCase().replace(/[^a-z0-9]/g, "")}-${user._id.toString().slice(0, 6)}`,
      ownerId: user._id,
    });
    await WorkspaceMemberModel.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: "OWNER",
    });

    await setSessionCookie({ sub: user._id.toString(), ws: workspace._id.toString() });
    await logAudit({
      workspaceId: workspace._id.toString(),
      actorId: user._id.toString(),
      actorName: user.name,
      action: "auth.signup",
      entityType: "user",
    });

    const emailProvider = getEmailProvider();
    await emailProvider.send({
      to: user.email,
      subject: "Welcome to NEXORA",
      text: `Welcome to NEXORA, ${user.name}!`,
      html: `<p>Welcome to NEXORA, ${user.name}!</p>`,
    });

    return { redirectTo: "/app" };
  });
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function getSessionUser(): Promise<ActionResult<{
  name: string;
  email: string;
  emailVerified: boolean;
} | null>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session?.sub) return null;
    await connectDB();
    const user = await UserModel.findById(session.sub).lean();
    if (!user) return null;
    return { name: user.name, email: user.email, emailVerified: user.emailVerified };
  });
}

export async function switchWorkspace(workspaceId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    await updateSessionWorkspace(workspaceId);
    return { redirectTo: "/app" };
  });
}
