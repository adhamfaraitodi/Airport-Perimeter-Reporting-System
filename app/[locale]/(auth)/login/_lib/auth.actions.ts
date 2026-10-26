"use server";

import { loginSchema, type LoginInput } from "./auth.schema";
import { authenticateWithNip } from "./auth.service";

export async function loginAction(input: LoginInput) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  return authenticateWithNip(parsed.data);
}
