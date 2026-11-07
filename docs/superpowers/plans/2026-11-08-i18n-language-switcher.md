# Lightweight Type-Safe i18n & Language Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghadirkan fitur pergantian bahasa (ID ⇄ EN) dengan tombol switcher `<Languages />` di samping kiri tombol light/dark mode pada header, didukung oleh dictionary type-safe untuk cakupan terjemahan teks UI website.

**Architecture:** Menggunakan dictionary modular type-safe di `lib/i18n/` (`id.ts`, `en.ts`, dan hook `useTranslation`). Locale dikontrol langsung oleh segmen URL Next.js 16 `/[locale]/...`. Tombol switcher di `app-header.tsx` membaca locale aktif dan me-redirect URL ke locale target (`id` ⇄ `en`) dengan mempertahankan pathname dan query params.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Lucide React icons (`Languages`), Tailwind CSS.

**Spec:** Desain arsitektur lightweight dictionary & URL-driven language switcher yang telah disetujui.

## Global Constraints
- **Zero heavy runtime i18n dependencies**: Menggunakan modul dictionary TypeScript native (`lib/i18n/`).
- **Preserve route params**: Pergantian bahasa tidak boleh mereset query string atau path aktif.
- **Strictly maintain Next.js 16 `proxy.ts` convention**: Menggunakan prefix locale `id` dan `en`.
- **Do NOT touch `db/seed.ts`**: Database seed kustom pengguna tidak boleh dimodifikasi.

---

### Task 1: Dictionaries & i18n Core Module
**Files:**
- Create: `lib/i18n/dictionaries/id.ts`
- Create: `lib/i18n/dictionaries/en.ts`
- Create: `lib/i18n/index.ts`

- [ ] **Step 1: Buat dictionary Bahasa Indonesia (`lib/i18n/dictionaries/id.ts`)**
  Ekstrak semua teks dari UI (common, nav, header, status, reports, operator, technician, profile, auth).
- [ ] **Step 2: Buat dictionary Bahasa Inggris (`lib/i18n/dictionaries/en.ts`)**
  Terjemahkan teks ke dalam Bahasa Inggris dengan struktur kunci yang 100% identik dengan `id.ts`.
- [ ] **Step 3: Buat modul entry point & hook (`lib/i18n/index.ts`)**
  Export `getDictionary(locale)`, `type TranslationDictionary`, dan hook client-side `useTranslation()`.
- [ ] **Step 4: Jalankan verifikasi tipe data TypeScript**
  Run: `npx tsc --noEmit`
  Expected: PASS

---

### Task 2: Language Switcher Button in Header
**Files:**
- Modify: `app/[locale]/_components/app-header.tsx`

- [ ] **Step 1: Import icon `Languages` dari `lucide-react` dan hook `useTranslation`**
- [ ] **Step 2: Tambahkan fungsi toggle bahasa di `app-header.tsx`**
  Ganti segmen locale pertama di `pathname` antara `id` dan `en`, lalu panggil `router.push(newUrl)`.
- [ ] **Step 3: Render tombol `<Languages /> ID` / `<Languages /> EN`**
  Letakkan persis di sebelah kiri tombol Theme Mode di container kanan header.
- [ ] **Step 4: Hubungkan teks header, notifikasi, dan profil ke dictionary**
- [ ] **Step 5: Verifikasi rendering dan type check**
  Run: `npx tsc --noEmit`
  Expected: PASS

---

### Task 3: Integrasikan Terjemahan ke Komponen Utama
**Files:**
- Modify: `app/[locale]/(internal)/reports/_components/report-list.tsx`
- Modify: `app/[locale]/(internal)/reports/_components/create-report-dialog.tsx`
- Modify: `app/[locale]/(internal)/reports/[reportId]/_components/report-detail.tsx`
- Modify: `app/[locale]/(internal)/operator/_components/update-status-dialog.tsx`
- Modify: `app/[locale]/(auth)/login/_components/login-form.tsx`

- [ ] **Step 1: Terapkan dictionary pada halaman & dialog Laporan**
- [ ] **Step 2: Terapkan dictionary pada dialog update status dan login form**
- [ ] **Step 3: Verifikasi build dan pemeriksaan kompilasi**
  Run: `npx tsc --noEmit`
  Expected: PASS
