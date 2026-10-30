"use server";

import { loginSchema, type LoginInput } from "./auth.schema";
import {
  authenticateWithNip,
  signOutWithBetterAuth,
  type AuthenticateResult,
} from "./auth.service";

export async function loginAction(
  input: LoginInput
): Promise<AuthenticateResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors).flat()[0] ||
      "Data login tidak valid.";
    return {
      success: false,
      errorMessage: firstError,
    };
  }

  return authenticateWithNip(parsed.data);
}

export async function logoutAction() {
  return signOutWithBetterAuth();
}
