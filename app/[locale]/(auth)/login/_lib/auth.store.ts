"use client";

import { create } from "zustand";
import { loginSchema } from "./auth.schema";
import type { UserRole } from "@/lib/auth";

export interface AuthUserState {
  id: string;
  nip: string;
  name: string;
  role: UserRole;
}

export interface LoginFieldErrors {
  nip?: string;
  password?: string;
}

interface AuthStoreState {
  nip: string;
  password: string;
  rememberMe: boolean;
  showPassword: boolean;
  submitting: boolean;
  notice: string;
  fieldErrors: LoginFieldErrors;
  currentUser: AuthUserState | null;

  setNip: (nip: string) => void;
  setPassword: (password: string) => void;
  setRememberMe: (rememberMe: boolean) => void;
  toggleShowPassword: () => void;
  setSubmitting: (submitting: boolean) => void;
  setNotice: (notice: string) => void;
  setFieldErrors: (errors: LoginFieldErrors) => void;
  setCurrentUser: (user: AuthUserState | null) => void;
  validateForm: (locale?: string) =>
    | { valid: true; data: { nip: string; password: string; rememberMe: boolean; locale: string } }
    | { valid: false; errors: LoginFieldErrors; firstMessage: string };
  resetLoginForm: () => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  nip: "",
  password: "",
  rememberMe: true,
  showPassword: false,
  submitting: false,
  notice: "",
  fieldErrors: {},
  currentUser: null,

  setNip: (nip) =>
    set((state) => ({
      // Hanya izinkan karakter angka (0-9) dan maksimal 30 digit
      nip: nip.replace(/\D+/g, "").slice(0, 30),
      notice: "",
      fieldErrors: { ...state.fieldErrors, nip: undefined },
    })),

  setPassword: (password) =>
    set((state) => ({
      password,
      notice: "",
      fieldErrors: { ...state.fieldErrors, password: undefined },
    })),

  setRememberMe: (rememberMe) => set({ rememberMe }),

  toggleShowPassword: () =>
    set((state) => ({ showPassword: !state.showPassword })),

  setSubmitting: (submitting) => set({ submitting }),

  setNotice: (notice) => set({ notice }),

  setFieldErrors: (fieldErrors) => set({ fieldErrors }),

  setCurrentUser: (currentUser) => set({ currentUser }),

  validateForm: (locale = "id") => {
    const { nip, password, rememberMe } = get();
    const parsed = loginSchema.safeParse({
      nip,
      password,
      rememberMe,
      locale,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      const errors: LoginFieldErrors = {
        nip: flattened.nip?.[0],
        password: flattened.password?.[0],
      };
      const firstMessage =
        errors.nip || errors.password || "Data login tidak valid.";
      set({ fieldErrors: errors, notice: firstMessage });
      return { valid: false, errors, firstMessage };
    }

    set({ fieldErrors: {}, notice: "" });
    return { valid: true, data: parsed.data };
  },

  resetLoginForm: () =>
    set({
      password: "",
      submitting: false,
      notice: "",
      fieldErrors: {},
    }),
}));
