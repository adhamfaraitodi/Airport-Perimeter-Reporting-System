"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Info, Languages, MoonStar, Sun, X } from "lucide-react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTheme } from "../../../_lib/use-theme";
import { loginAction } from "../_lib/auth.actions";
import { loginSchema } from "../_lib/auth.schema";
import {
  btnCloseCoral,
} from "../../../_lib/ui-classes";
import { useTranslation, type SupportedLocale } from "@/lib/i18n";

const focusClasses =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--login-link)]";
const buttonClasses = `${focusClasses} cursor-pointer font-[inherit] leading-normal transition-colors duration-200 hover:filter-none hover:shadow-none`;
const inputClasses = `${focusClasses} m-0 block h-[38px] min-h-[38px] w-full min-w-0 rounded-[9px] border border-solid border-[var(--login-border)] bg-[var(--login-bg)] px-[11px] py-[8px] font-[inherit] text-[16px] leading-[1.2] font-normal text-[var(--login-text)] placeholder:text-[var(--login-muted)] placeholder:opacity-90 focus:border-[var(--login-link)] aria-[invalid=true]:border-[var(--login-error)] min-[900px]:h-[46px] min-[900px]:px-[12px] min-[900px]:py-[12px]`;
const submitClasses = `${buttonClasses} flex min-h-[38px] w-full items-center justify-center rounded-[8px] border-0 bg-[var(--login-primary)] px-[14px] py-[8px] text-[15px] font-bold text-[var(--login-on-primary)] hover:bg-[var(--login-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 min-[900px]:min-h-[44px] min-[900px]:text-[16px]`;
const labelClasses =
  "mb-[5px] block text-[12px] leading-[1.3] font-normal min-[900px]:mb-[8px] min-[900px]:text-[14px]";

export interface LoginFormProps {
  allowDemo?: boolean;
  onDemo?: () => void;
}

export function LoginForm({ allowDemo = true, onDemo }: LoginFormProps) {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale || "id";
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || undefined;

  const { theme, dark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [help, setHelp] = useState(false);
  const dialog = useRef<HTMLDialogElement | null>(null);

  // Local component state for login form (validated with Zod)
  const [nip, setNipState] = useState("");
  const [password, setPasswordState] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    nip?: string;
    password?: string;
  }>({});

  const demoEnabled = process.env.NODE_ENV === "development" && allowDemo;

  useEffect(() => {
    if (!dialog.current) return;
    if (help && !dialog.current.open) dialog.current.showModal();
    if (!help && dialog.current.open) dialog.current.close();
  }, [help]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  function handleToggleLanguage() {
    const nextLocale: SupportedLocale = locale === "id" ? "en" : "id";
    const currentPath = window.location.pathname;
    const segments = currentPath.split("/");
    if (segments[1] === "id" || segments[1] === "en") {
      segments[1] = nextLocale;
    } else {
      segments.splice(1, 0, nextLocale);
    }
    const targetUrl = `${segments.join("/")}${window.location.search}`;
    router.push(targetUrl);
  }

  function handleNipChange(raw: string) {
    // Hanya izinkan karakter angka (0-9) dan maksimal 30 digit
    setNipState(raw.replace(/\D+/g, "").slice(0, 30));
    setNotice("");
    if (fieldErrors.nip) {
      setFieldErrors((prev) => ({ ...prev, nip: undefined }));
    }
  }

  function handlePasswordChange(val: string) {
    setPasswordState(val);
    setNotice("");
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = loginSchema.safeParse({
      nip,
      password,
      rememberMe: remember,
    });

    if (!validation.success) {
      const flattened = validation.error.flatten().fieldErrors;
      setFieldErrors({
        nip: flattened.nip?.[0],
        password: flattened.password?.[0],
      });
      const firstError = flattened.nip?.[0] || flattened.password?.[0];
      if (firstError) {
        setNotice(firstError);
      }
      return;
    }

    setSubmitting(true);
    setNotice("");
    setFieldErrors({});

    try {
      const result = await loginAction({
        nip: validation.data.nip,
        password: validation.data.password,
        rememberMe: validation.data.rememberMe,
        locale,
        callbackUrl,
      });

      if (result.success) {
        if (result.redirectTo) {
          window.location.replace(result.redirectTo);
          return;
        }
        router.replace(callbackUrl || `/${locale}/reports`);
        router.refresh();
        return;
      }

      if (result.dbUnavailable && demoEnabled) {
        if (onDemo) {
          onDemo();
        } else {
          router.push(callbackUrl || `/${locale}/reports`);
        }
        return;
      }

      setNotice(
        result.errorMessage ||
          (locale === "en"
            ? "The Employee ID or password you entered is incorrect."
            : "ID pegawai atau password yang Anda masukkan salah.")
      );
    } catch {
      setNotice(
        locale === "en"
          ? "An error occurred while connecting to the authentication service."
          : "Terjadi kesalahan saat menghubungi layanan autentikasi."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="login-page m-0 flex min-h-dvh w-full max-w-none flex-col bg-[var(--login-bg)] p-0 font-['Carlito',sans-serif] text-[14px] leading-normal text-[var(--login-text)] [color-scheme:light] data-[theme=dark]:[color-scheme:dark] min-[900px]:grid min-[900px]:grid-cols-[minmax(340px,46%)_1fr]"
      data-theme={theme}
    >
      <section
        className="relative isolate grid min-h-[325px] place-items-center overflow-hidden bg-[var(--login-brand-bg)] text-[var(--login-panel-text)] min-[900px]:min-h-dvh"
        aria-label="InJourney Airports"
      >
        <div
          className="login-brand-pattern pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-7 py-3 min-[900px]:py-5">
          <div className="flex items-center gap-2">
            <img
              className="block h-auto w-[56px] min-[400px]:w-[70px] object-contain"
              src={dark ? "/injourney-logo-white.webp" : "/injourney-logo.webp"}
              alt="InJourney Airports"
              width={dark ? 700 : 1086}
              height={dark ? 215 : 362}
            />
            <img
              className="block h-auto w-[80px] min-[400px]:w-[100px] object-contain"
              src={dark ? "/yogyakarta-international-airport-logo-white-transparent.webp" : "/yogyakarta-international-airport-logo-transparent.webp"}
              alt="YIA Logo"
              width={dark ? 2048 : 2083}
              height={dark ? 744 : 755}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">

            {/* Language Switcher */}
            <button
              type="button"
              className={`${buttonClasses} inline-flex h-[44px] items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-sm font-semibold text-[var(--login-panel-text)] hover:bg-[var(--login-theme-hover)] min-[400px]:px-3`}
              onClick={handleToggleLanguage}
              aria-label={
                locale === "id"
                  ? "Beralih ke Bahasa Inggris"
                  : "Switch to Indonesian"
              }
              title={
                locale === "id"
                  ? "Beralih ke Bahasa Inggris"
                  : "Switch to Indonesian"
              }
            >
              <Languages size={18} strokeWidth={1.8} aria-hidden="true" />
              <span className="tracking-wider">{locale.toUpperCase()}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              className={`${buttonClasses} grid size-[44px] min-h-[44px] place-items-center rounded-full border-0 bg-transparent p-0 text-[var(--login-panel-text)] hover:bg-[var(--login-theme-hover)]`}
              onClick={toggleTheme}
              aria-label={dark ? "Aktifkan light mode" : "Aktifkan dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? (
                <Sun size={27} strokeWidth={1.7} aria-hidden="true" />
              ) : (
                <MoonStar size={29} strokeWidth={1.7} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 px-5 py-[76px] text-center min-[600px]:gap-4 min-[900px]:gap-7 min-[900px]:px-10 min-[900px]:py-24">
          <img
            className="block h-auto w-[78px] object-contain min-[600px]:w-[145px] min-[900px]:w-[150px]"
            src="/avsec-logo.webp"
            alt="Avsec Logo"
            width={1952}
            height={2160}
            fetchPriority="high"
          />
          <p className="m-0 text-center text-[16px] leading-[1.45] max-[360px]:text-[15px] min-[600px]:text-[19px] min-[900px]:max-w-[350px] min-[900px]:text-[25px] min-[900px]:leading-[1.5] min-[900px]:text-balance">
            {" "}
            <span className="sm:whitespace-nowrap">
              Airport Perimeter Monitoring System
            </span>
          </p>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-9 hidden px-7 text-center text-[10px] tracking-[2px] opacity-65 min-[900px]:block"
          aria-hidden="true"
        >
          <span>Integrated Security Perimeter Monitoring System</span>
        </div>
      </section>

      <section
        className="relative z-10 flex flex-1 items-center justify-center bg-[var(--login-bg)] p-6 [box-shadow:var(--login-section-shadow)] min-[900px]:p-12"
        aria-labelledby="login-title"
      >
        <div className="w-full max-w-[304px] min-[600px]:max-w-[380px] min-[900px]:max-w-[400px]">
          <div className="relative overflow-hidden rounded-xl border border-solid border-[var(--login-border)] bg-[var(--login-surface)] p-6 [box-shadow:var(--login-card-shadow)] min-[600px]:p-8 min-[900px]:rounded-2xl">
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
                {locale === "en" ? "Welcome" : "Selamat datang"}{" "}
                <span className="sm:whitespace-nowrap">
                  {locale === "en"
                    ? "to Airport Perimeter Monitoring System"
                    : "di Airport Perimeter Monitoring System"}
                </span>
                <br />
                {locale === "en"
                  ? "you can report damage or violations immediately after signing in."
                  : "anda dapat langsung melaporkan kerusakan atau pelanggaran setelah masuk."}
              </p>{" "}
            </header>
            <form onSubmit={submit} noValidate className="m-0">
              <div className="mb-[12px] min-[900px]:mb-[19px]">
                <label className={labelClasses} htmlFor="login-nip">
                  ID pegawai
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
                  placeholder={locale === "en" ? "Enter ID employee" : "Masukkan ID pegawai"}
                  value={nip}
                  aria-invalid={!!fieldErrors.nip}
                  required={!demoEnabled}
                  pattern="[0-9]+"
                  title="Masukkan ID pegawai menggunakan angka."
                  onChange={(event) => {
                    handleNipChange(event.target.value);
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
                      handlePasswordChange(event.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className={`${buttonClasses} absolute inset-y-0 right-1 flex items-center rounded-[9px] border-0 bg-transparent px-2.5 text-[11px] font-normal text-[var(--login-muted)] min-[900px]:text-[12px]`}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-controls="login-password"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword
                      ? locale === "en"
                        ? "Hide"
                        : "Sembunyi"
                      : locale === "en"
                      ? "Show"
                      : "Lihat"}
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
                  <span>{locale === "en" ? "Stay signed in" : "Tetap masuk"}</span>
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
                {submitting
                  ? locale === "en"
                    ? "Processing…"
                    : "Memproses…"
                  : locale === "en"
                  ? "Sign In"
                  : "Masuk"}
              </button>
              <p className="m-0 mt-[12px] text-center text-[11px] leading-[1.5] text-[var(--login-muted)] min-[900px]:mt-[20px] min-[900px]:text-[12px]">
                {locale === "en" ? "Need access?" : "Butuh akses?"}{" "}
                <button
                  className={`${buttonClasses} inline min-h-[28px] rounded-[2px] border-0 bg-transparent p-0 text-[length:inherit] font-normal text-inherit hover:underline`}
                  type="button"
                  onClick={() => setHelp(true)}
                >
                  {locale === "en"
                    ? "Contact website operator."
                    : "Hubungi operator website."}
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
        <div className="flex items-center justify-between">
          <Info size={26} className="text-[var(--login-link)]" aria-hidden="true" />
          <button
            autoFocus
            type="button"
            className={btnCloseCoral}
            aria-label="Close help"
            onClick={() => setHelp(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <h2
          id="login-help-title"
          className="mt-[14px] mb-[10px] font-[inherit] text-[24px] leading-[1.35] font-bold tracking-normal"
        >
          {locale === "en" ? "Account Help" : "Help Info Akun"}
        </h2>
        <p
          id="login-help-description"
          className="mt-0 mb-[22px] text-[14px] leading-[1.6] text-[var(--login-muted)]"
        >
          {locale === "en"
            ? "Contact website operator for account access and password assistance."
            : "Hubungi operator website untuk akses akun dan bantuan password."}
        </p>
        <button
          type="button"
          className={submitClasses}
          onClick={() => setHelp(false)}
        >
          {locale === "en" ? "Understood" : "Mengerti"}
        </button>
      </dialog>
    </main>
  );
}
