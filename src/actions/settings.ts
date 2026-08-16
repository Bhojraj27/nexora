"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/context";
import { UserModel } from "@/models/User";
import { connectDB } from "@/lib/db/mongoose";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AuthError, ValidationError } from "@/lib/errors";
import { runAction, type ActionResult } from "@/actions/helpers";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  name: z.string().min(2).max(100),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  onboardingPurpose: z.string().max(100).optional(),
  onboardingCompleted: z.boolean().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must be different",
    path: ["newPassword"],
  });

export async function actionUpdateProfile(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = profileSchema.parse(input);
    const user = await requireUser();
    await connectDB();

    const update: Record<string, unknown> = { name: parsed.name };
    if (parsed.avatarUrl !== undefined) update.avatarUrl = parsed.avatarUrl || null;
    if (parsed.onboardingPurpose !== undefined) update.onboardingPurpose = parsed.onboardingPurpose;
    if (parsed.onboardingCompleted !== undefined) update.onboardingCompleted = parsed.onboardingCompleted;

    await UserModel.updateOne({ _id: user._id }, { $set: update });
    revalidatePath("/app/settings");
  });
}

export async function actionChangePassword(
  input: z.infer<typeof passwordSchema>,
): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = passwordSchema.parse(input);
    const user = await requireUser();
    await connectDB();

    const fresh = await UserModel.findById(user._id).lean();
    if (!fresh || !(await verifyPassword(parsed.currentPassword, fresh.passwordHash))) {
      throw new AuthError("Current password is incorrect");
    }
    if (parsed.newPassword.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    await UserModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(parsed.newPassword) } },
    );
  });
}
