"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Info, MoonStar, Sun, X } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { loginAction } from "../_lib/auth.actions";
import { useAuthStore } from "../_lib/auth.store";

const focusClasses =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--login-link)]";
const buttonClasses = `${focusClasses} cursor-pointer font-[inherit] leading-normal transition-colors duration-200 hover:filter-none hover:shadow-none`;
const inputClasses = `${focusClasses} m-0 block h-[38px] min-h-[38px] w-full min-w-0 rounded-[9px] border border-solid border-[var(--login-border)] bg-[var(--login-bg)] px-[11px] py-[8px] font-[inherit] text-[16px] leading-[1.2] font-normal text-[var(--login-text)] placeholder:text-[var(--login-muted)] placeholder:opacity-90 focus:border-[var(--login-link)] aria-[invalid=true]:border-[var(--login-error)] min-[900px]:h-[46px] min-[900px]:px-[12px] min-[900px]:py-[12px]`;
const submitClasses = `${buttonClasses} flex min-h-[38px] w-full items-center justify-center rounded-[8px] border-0 bg-[var(--login-primary)] px-[14px] py-[8px] text-[15px] font-bold text-[var(--login-on-primary)] hover:bg-[var(--login-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 min-[900px]:min-h-[44px] min-[900px]:text-[16px]`;
const labelClasses =
  "mb-[5px] block text-[12px] leading-[1.3] font-normal min-[900px]:mb-[8px] min-[900px]:text-[14px]";

function initialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem("perimeter-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Storage may be unavailable in embedded browsers. */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export interface LoginFormProps {
  allowDemo?: boolean;
  onDemo?: () => void;
}

export function LoginForm({ allowDemo = true, onDemo }: LoginFormProps) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLDialogElement | null>(null);

  const nip = useAuthStore((state) => state.nip);
  const password = useAuthStore((state) => state.password);
  const remember = useAuthStore((state) => state.rememberMe);
  const showPassword = useAuthStore((state) => state.showPassword);
  const submitting = useAuthStore((state) => state.submitting);
  const notice = useAuthStore((state) => state.notice);
  const fieldErrors = useAuthStore((state) => state.fieldErrors);

  const setNip = useAuthStore((state) => state.setNip);
  const setPassword = useAuthStore((state) => state.setPassword);
  const setRemember = useAuthStore((state) => state.setRememberMe);
  const toggleShowPassword = useAuthStore((state) => state.toggleShowPassword);
  const setSubmitting = useAuthStore((state) => state.setSubmitting);
  const setNotice = useAuthStore((state) => state.setNotice);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const validateForm = useAuthStore((state) => state.validateForm);
  const resetLoginForm = useAuthStore((state) => state.resetLoginForm);

  const dark = theme === "dark";
  const demoEnabled = process.env.NODE_ENV === "development" && allowDemo;

  useEffect(() => {
    setTheme(initialTheme());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("perimeter-theme", theme);
    } catch {
      /* Theme still works without persistence. */
    }
  }, [theme]);

  useEffect(() => {
    if (!dialog.current) return;
    if (help && !dialog.current.open) dialog.current.showModal();
    if (!help && dialog.current.open) dialog.current.close();
  }, [help]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Allow instant demo entry in development only when both fields are empty
    if (!nip.trim() && !password && demoEnabled) {
      resetLoginForm();
      if (onDemo) {
        onDemo();
      } else {
        router.push(`/${locale}/reports`);
      }
      return;
    }

    // Validate form inputs with Zod via Zustand store
    const validation = validateForm(locale);
    if (!validation.valid) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginAction(validation.data);

      if (result.success && result.redirectTo) {
        if (result.user) {
          setCurrentUser(result.user);
        }
        resetLoginForm();
        router.push(result.redirectTo);
        router.refresh();
        return;
      }

      if (result.dbUnavailable && demoEnabled) {
        resetLoginForm();
        if (onDemo) {
          onDemo();
        } else {
          router.push(`/${locale}/reports`);
        }
        return;
      }

      setNotice(
        result.errorMessage || "NIP atau password yang Anda masukkan salah."
      );
    } catch {
      setNotice("Terjadi kesalahan saat menghubungi layanan autentikasi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="login-page m-0 min-h-dvh w-full max-w-none bg-[var(--login-bg)] p-0 font-['Carlito',sans-serif] text-[14px] leading-normal text-[var(--login-text)] [color-scheme:light] data-[theme=dark]:[color-scheme:dark] min-[900px]:grid min-[900px]:grid-cols-[minmax(340px,46%)_1fr]"
      data-theme={theme}
    >
      <section
        className="relative h-[269px] bg-[var(--login-brand-bg)] text-[var(--login-panel-text)] min-[900px]:h-auto min-[900px]:min-h-dvh"
        aria-label="InJourney Airports"
      >
        <button
          type="button"
          className={`${buttonClasses} absolute top-[34px] right-[26px] grid h-[44px] min-h-[44px] w-[44px] place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--login-panel-text)] hover:bg-[var(--login-theme-hover)] min-[900px]:top-[30px] min-[900px]:right-[30px]`}
          onClick={() => setTheme(dark ? "light" : "dark")}
          aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
          title={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? (
            <Sun size={27} strokeWidth={1.7} />
          ) : (
            <MoonStar size={29} strokeWidth={1.7} />
          )}
        </button>
        <div className="flex h-full flex-col items-center justify-end gap-[35px] px-[20px] pt-0 pb-[40px] min-[900px]:justify-center min-[900px]:gap-[40px] min-[900px]:px-[40px] min-[900px]:py-[70px]">
          <img
            className="block h-auto w-[120px] object-contain min-[600px]:w-[145px] min-[900px]:w-[210px]"
            src={dark ? "/injourney-logo-white.webp" : "/injourney-logo.webp"}
            alt="InJourney Airports"
          />
          <p className="m-0 text-center text-[16px] leading-[1.45] max-[360px]:text-[15px] min-[600px]:text-[19px] min-[900px]:max-w-[350px] min-[900px]:text-[25px] min-[900px]:leading-[1.5] min-[900px]:text-balance">
            {" "}
            <span className="whitespace-nowrap">
              Airport Perimeter Reporting System
            </span>
          </p>
        </div>
        <div
          className="absolute right-[30px] bottom-[35px] left-[30px] hidden flex-col gap-[8px] text-center text-[10px] tracking-[2px] opacity-65 min-[900px]:flex"
          aria-hidden="true"
        >
          <span>YOGYAKARTA INTERNATIONAL AIRPORT</span>
        </div>
      </section>

      <section
        className="px-[24px] pt-[48px] pb-[44px] max-[360px]:px-[18px] max-[360px]:py-[32px] min-[900px]:flex min-[900px]:items-center min-[900px]:px-[48px] min-[900px]:py-[64px]"
        aria-labelledby="login-title"
      >
        <div className="mx-auto w-full max-w-[304px] min-[600px]:max-w-[380px] min-[900px]:max-w-[400px]">
          <div className="relative overflow-hidden rounded-[13px] border border-solid border-[var(--login-border)] bg-[var(--login-surface)] px-[24px] pt-[31px] pb-[24px] max-[360px]:px-[18px] min-[600px]:p-[34px] min-[900px]:rounded-[16px] min-[900px]:px-[34px] min-[900px]:pt-[38px] min-[900px]:pb-[30px]">
            <div
              className="absolute inset-x-0 top-0 flex h-[3px]"
              aria-hidden="true"
            >
              <i className="flex-1 bg-[var(--login-stripe-coral)]" />
              <i className="flex-1 bg-[var(--login-stripe-amber)]" />
              <i className="flex-1 bg-[var(--login-stripe-lime)]" />
              <i className="flex-1 bg-[var(--login-stripe-teal)]" />
            </div>
            <header>
              <h1
                id="login-title"
                className="m-0 mb-[5px] font-[inherit] text-[22px] leading-[1.2] font-bold tracking-normal min-[900px]:text-[29px]"
              >
                Sign in
              </h1>
              <p className="m-0 mb-[19px] text-[12px] leading-[1.5] text-[var(--login-muted)] min-[900px]:mb-[28px] min-[900px]:text-[14px]">
                Selamat datang{" "}
                <span className="whitespace-nowrap">
                  di Airport Perimeter Reporting System
                </span>
                <br />
                anda dapat langsung melaporkan kerusakan atau pelanggaran
                setelah masuk.
              </p>{" "}
            </header>
            <form onSubmit={submit} noValidate className="m-0">
              <div className="mb-[12px] min-[900px]:mb-[19px]">
                <label className={labelClasses} htmlFor="login-nip">
                  NIP
                </label>
                <input
                  className={inputClasses}
                  id="login-nip"
                  name="username"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Masukkan NIP"
                  value={nip}
                  aria-invalid={!!fieldErrors.nip}
                  required={!demoEnabled}
                  pattern="[0-9]+"
                  title="Masukkan NIP menggunakan angka, termasuk nol di depan."
                  onChange={(event) => {
                    setNip(event.target.value);
                  }}
                />
              </div>
              <div className="mb-[12px] min-[900px]:mb-[19px]">
                <label className={labelClasses} htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <input
                    className={`${inputClasses} pr-[55px] min-[900px]:pr-[55px]`}
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    aria-invalid={!!fieldErrors.password}
                    required={!demoEnabled}
                    onChange={(event) => {
                      setPassword(event.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className={`${buttonClasses} absolute top-[-3px] right-[2px] min-h-[44px] rounded-[9px] border-0 bg-transparent px-[10px] py-0 text-[11px] font-normal text-[var(--login-muted)] min-[900px]:top-[1px] min-[900px]:text-[12px]`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-controls="login-password"
                    aria-pressed={showPassword}
                    onClick={toggleShowPassword}
                  >
                    {showPassword ? "Sembunyi" : "Lihat"}
                  </button>
                </div>
              </div>
              <div className="-mt-[3px] mb-[7px] flex items-center justify-between gap-[5px] max-[360px]:flex-wrap min-[900px]:mb-[16px]">
                <label className="m-0 flex min-h-[36px] cursor-pointer items-center gap-[6px] text-[12px] font-normal whitespace-nowrap min-[900px]:text-[13px]">
                  <input
                    className={`${focusClasses} m-0 inline-block h-[13px] min-h-0 w-[13px] shrink-0 appearance-auto rounded-[2px] border border-solid border-[var(--login-border)] bg-[var(--login-bg)] p-0 text-[var(--login-text)] accent-[var(--login-primary)]`}
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span>Tetap masuk</span>
                </label>
              </div>
              {notice && (
                <div
                  className="mb-[12px] flex items-start gap-[8px] rounded-[6px] bg-[var(--login-error-bg)] p-[10px] text-[12px] leading-[1.4] text-[var(--login-error)] [overflow-wrap:anywhere]"
                  role="status"
                >
                  <Info
                    size={16}
                    className="mt-[2px] shrink-0"
                    aria-hidden="true"
                  />
                  <span>{notice}</span>
                </div>
              )}
              <button
                className={submitClasses}
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Memproses…" : "Masuk"}
              </button>
              <p className="m-0 mt-[12px] text-center text-[11px] leading-[1.5] text-[var(--login-muted)] min-[900px]:mt-[20px] min-[900px]:text-[12px]">
                Butuh akses?{" "}
                <button
                  className={`${buttonClasses} inline min-h-[28px] rounded-[2px] border-0 bg-transparent p-0 text-[length:inherit] font-normal text-inherit hover:underline`}
                  type="button"
                  onClick={() => setHelp(true)}
                >
                  Hubungi operator website.
                </button>
              </p>
            </form>
          </div>
        </div>
      </section>

      <dialog
        ref={dialog}
        className="login-help fixed inset-0 m-auto w-[calc(100%-40px)] max-w-[380px] rounded-[16px] border border-solid border-[var(--login-border)] bg-[var(--login-surface)] p-[30px] text-[var(--login-text)] shadow-[0_20px_80px_#0003]"
        onCancel={() => setHelp(false)}
        onClose={() => setHelp(false)}
        aria-labelledby="login-help-title"
        aria-describedby="login-help-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelp(false);
        }}
      >
        <button
          autoFocus
          type="button"
          className={`${buttonClasses} absolute top-[10px] right-[10px] grid min-h-[44px] w-[40px] place-items-center rounded-[9px] border-0 bg-transparent p-0 text-[var(--login-muted)] transition-colors hover:bg-[var(--rd-coral)]/15 hover:text-[var(--rd-coral)]`}
          aria-label="Close help"
          onClick={() => setHelp(false)}
        >
          <X size={20} />
        </button>
        <Info size={26} className="text-[var(--login-link)]" aria-hidden="true" />
        <h2
          id="login-help-title"
          className="mt-[14px] mb-[10px] font-[inherit] text-[24px] leading-[1.35] font-bold tracking-normal"
        >
          Help Info Akun
        </h2>
        <p
          id="login-help-description"
          className="mt-0 mb-[22px] text-[14px] leading-[1.6] text-[var(--login-muted)]"
        >
          Hubungi operator website untuk akses akun dan bantuan password.
        </p>
        <button
          type="button"
          className={submitClasses}
          onClick={() => setHelp(false)}
        >
          Mengerti
        </button>
      </dialog>
    </main>
  );
}
