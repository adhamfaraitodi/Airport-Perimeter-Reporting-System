import type { LoginInput } from "./auth.schema";

export async function authenticateWithNip(_input: LoginInput) {
  // TODO: Integrasi Better-Auth login dengan NIP & password
  return { success: true };
}
