# Airport Perimeter Reporting System — 5 Operational Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver two-stage repair verification (`TECHNICIAN → IN_PROGRESS`, `OPERATOR`/`CHIEF → RESOLVED` or return to `OPEN`), a limited `CHIEF` operator role without Master Data access, a 60-grid perimeter fence readiness KPI block on the operator dashboard, a translucent red perimeter map overlay on damaged segments, and full perimeter report visibility for `REPORTER` accounts.

**Architecture:** Centralize role-based status transition rules and approval attribution in a pure `lib/report-workflow.ts` module enforced by both server actions and client API, add `"CHIEF"` to PostgreSQL `user_role` via a schema-only Drizzle migration wired through Better-Auth/proxy RBAC and header navigation, and build two pure geospatial modules (`lib/perimeter-readiness.ts` and `lib/perimeter-segments.ts`) backed by the fixed 60-grid registry (`app/[locale]/_data/perimeter-grids.ts`) and `latest_perimeter.json`.

**Tech Stack:** Next.js 16.3.8 (App Router, Server Actions), React 19, TypeScript 5, Drizzle ORM 0.45, PostgreSQL, Better Auth 1.7, Leaflet 1.9 + `leaflet-rotate`, Tailwind CSS v4, Zod v4, Zustand v5, `tsx` (test runner).

**Spec:** `docs/superpowers/specs/2026-11-20-perimeter-improvements-design.md`

## Global Constraints

- **Untouched file:** `app/[locale]/_lib/report-document.ts` — ZERO modifications allowed under any task.
- **No signatures (`tanda tangan`):** Do not add signature capture, signature rendering, or signature blocks anywhere.
- **Fixed readiness denominator:** Always `60` (`PERIMETER_GRID_CODES.length === 60`).
- **90-day retention query rule:** Active unresolved reports (`deleted_at IS NULL AND status IN ('OPEN', 'IN_PROGRESS')`) are ALWAYS returned regardless of `created_at`; `RESOLVED` and `CLOSED`/soft-deleted reports remain limited to `created_at >= now - 90 days`.
- **Mandatory evidence on verification & return:** Both `narrative` (1–2,000 chars) and `photos` (≥1 valid JPG/PNG/WebP image, ≤3 MB client / ≤5 MB base64 server) are required for `IN_PROGRESS → RESOLVED` and `IN_PROGRESS → OPEN`.
- **Schema-only migration:** `drizzle/0003_add_chief_role.sql` uses `ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'CHIEF';` — no data migration on existing reports.
- **No new npm dependencies:** Use existing packages only.
- **Bilingual parity & theme tokens:** Update both `id.ts` and `en.ts` dictionaries and `notification-templates.ts`; style all new UI with `--rd-*` CSS tokens for light/dark themes.

## Review Focus

1. **`CHIEF` attempting Master Data access via direct URL or `callbackUrl`:** Visiting `/id/operator/accounts` or `/id/operator/perimeter-damage` (or logging in with those as `callbackUrl`) must redirect to `/id/operator`, while `/id/operator` itself must be allowed (pinned in Task 1 `lib/proxy/auth-proxy.test.ts`).
2. **Role workflow bypass attempts:** A `TECHNICIAN` attempting `IN_PROGRESS → RESOLVED` or `OPEN → RESOLVED`, an `OPERATOR`/`CHIEF` attempting to skip handling via `OPEN → RESOLVED`, or a `REPORTER` attempting any `STATUS`/`DELETE` mutation must all be rejected (pinned in Task 2 `lib/report-workflow.test.ts` and `technician.service.test.ts`).
3. **South-fence coordinate drift, deduplication, and invalid inputs in readiness KPI:** A report at southern fence coords falling into `N15` (1–10 m south of `M15`) must snap to `M15`; multiple active reports in `M11` must count as 1 damaged grid; `RESOLVED`/`CLOSED` reports must not reduce readiness; interior (`K10`) or `NaN` coords must resolve to `null` without throwing (pinned in Task 6 `lib/perimeter-readiness.test.ts`).
4. **Full 60-block polygon coverage & wrap-around seam on `latest_perimeter.json`:** Every one of the 60 `PERIMETER_GRID_CODES` must yield ≥1 continuous `[lat, lng][]` polyline with ≥2 finite points; unknown grid codes must be ignored gracefully; empty input must return `[]` (pinned in Task 7 `lib/perimeter-segments.test.ts`).
5. **Reporter all-reports visibility vs read-only boundary:** `REPORTER` sees all perimeter reports and their photos across `/reports` and `/reports/[reportId]`, while `canRoleTransitionReportStatus("REPORTER", ...)` and `canRoleCloseReport("REPORTER")` remain strictly `false` (pinned in Task 2 `lib/report-workflow.test.ts` and Task 4 verification).

---

## File Structure Map

### New Files
- `drizzle/0003_add_chief_role.sql` — Schema-only PostgreSQL enum migration adding `'CHIEF'` to `user_role`.
- `lib/report-workflow.ts` — Pure role-transition state machine (`canRoleTransitionReportStatus`, `canRoleCloseReport`), approval attribution (`getApprovalInfo`, `formatApprovalLabel`), and return detection (`isReturnedHistoryItem`).
- `lib/report-workflow.test.ts` — Unit tests for workflow transitions, close permissions, approval formatting, and return detection.
- `app/[locale]/_data/perimeter-grids.ts` — Static registry of the user's 60 perimeter grid blocks (`PERIMETER_GRID_CODES`, `PERIMETER_GRID_TOTAL`, `PERIMETER_GRID_SET`, `PERIMETER_GRID_BOXES`).
- `lib/perimeter-readiness.ts` — Pure 60-grid readiness computation with nearest-perimeter-block coordinate snapping and deduplication.
- `lib/perimeter-readiness.test.ts` — Unit tests for readiness math, deduplication, south-edge snapping, and edge inputs.
- `app/[locale]/(internal)/operator/_components/perimeter-readiness-card.tsx` — Operator/Chief dashboard KPI block showing readiness %, progress bar, `X/60` counts, clickable impacted grid chips, and status counters.
- `lib/perimeter-segments.ts` — Precomputed partitioning of `latest_perimeter.json` polygon edges into `[lat, lng][]` polylines keyed by the 60 perimeter grid blocks.
- `lib/perimeter-segments.test.ts` — Unit tests proving 60/60 block coverage, polyline validity, and edge-case handling.

### Modified Files
- **Task 1 (Auth & Role Foundation):** `db/schema.ts`, `drizzle/meta/_journal.json`, `lib/auth.ts`, `db/seed.ts`, `lib/proxy/auth-proxy.ts`, `lib/proxy/auth-proxy.test.ts`, `app/[locale]/(auth)/login/_lib/auth.service.ts`, `app/[locale]/_lib/client-api.ts`, `app/[locale]/_lib/accounts-store.ts`.
- **Task 2 (Workflow, Retention & Reporter Query):** `app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts`, `app/[locale]/(internal)/technician/_lib/technician.service.ts`, `app/[locale]/(internal)/technician/_lib/technician.loader.ts`, `app/[locale]/(internal)/technician/_lib/technician.service.test.ts`, `app/[locale]/_lib/client-api.ts`.
- **Task 3 (Notifications & i18n):** `app/[locale]/_lib/notifications.actions.ts`, `app/[locale]/_lib/notification-templates.ts`, `lib/i18n/dictionaries/id.ts`, `lib/i18n/dictionaries/en.ts`.
- **Task 4 (`CHIEF` UI, Accounts Master Data & Reporter All-Reports UI):** `app/[locale]/_components/app-header.tsx`, `app/[locale]/(internal)/operator/accounts/_lib/accounts.schema.ts`, `app/[locale]/(internal)/operator/accounts/page.tsx`, `app/[locale]/(internal)/operator/perimeter-damage/page.tsx`, `app/[locale]/(internal)/reports/page.tsx`, `app/[locale]/(internal)/reports/_components/report-list.tsx`, `app/[locale]/(internal)/reports/[reportId]/page.tsx`.
- **Task 5 (Verification Dialog, Attribution & Technician Ceiling UI):** `app/[locale]/(internal)/operator/_components/update-status-dialog.tsx`, `app/[locale]/(internal)/operator/_components/report-detail-sheet.tsx`, `app/[locale]/(internal)/operator/page.tsx`, `app/[locale]/(internal)/technician/page.tsx`, `app/[locale]/_components/report-history-panel.tsx`, `app/[locale]/(internal)/reports/[reportId]/_components/report-detail.tsx`.
- **Task 6 (Readiness Math & Dashboard KPI):** `app/[locale]/_components/airport-grid.ts`, `app/[locale]/(internal)/operator/page.tsx`.
- **Task 7 (Red Map Overlay & Test Script):** `app/[locale]/_components/perimeter-map-inner.tsx`, `app/[locale]/(internal)/operator/_components/perimeter-map.tsx`, `app/[locale]/(internal)/operator/page.tsx`, `app/[locale]/(internal)/technician/page.tsx`, `package.json`.

---

### Task 1: `CHIEF` Role Foundation (Schema, Migration, Auth, Seed & Proxy RBAC)

**Files:**
- Create: `drizzle/0003_add_chief_role.sql`
- Modify: `drizzle/meta/_journal.json:19-26`
- Modify: `db/schema.ts:21-25`
- Modify: `lib/auth.ts:7`
- Modify: `db/seed.ts:86-115`
- Modify: `lib/proxy/auth-proxy.ts:38-57,219-289`
- Modify: `app/[locale]/(auth)/login/_lib/auth.service.ts:125-170`
- Modify: `app/[locale]/_lib/client-api.ts:10,102-128,175-180`
- Modify: `app/[locale]/_lib/accounts-store.ts:21-25`
- Test: `lib/proxy/auth-proxy.test.ts`

**Interfaces:**
- Consumes: Existing `AUTH_SECRET` from `lib/auth.ts` and `handleAuthProxy` from `lib/proxy/auth-proxy.ts`.
- Produces:
  - `UserRole = "REPORTER" | "OPERATOR" | "CHIEF" | "TECHNICIAN"` (in `lib/auth.ts` and `app/[locale]/_lib/client-api.ts`)
  - `roleLabels: Record<UserRole, string>` including `CHIEF: "Chief Lapangan"` (in `app/[locale]/_lib/accounts-store.ts`)
  - `getHomeRouteForRole(locale: string, role?: UserRole | string | null): string` returning `/${locale}/operator` for both `"OPERATOR"` and `"CHIEF"`
  - `handleAuthProxy` permitting `CHIEF` on `/[locale]/operator` and redirecting `CHIEF` to `/[locale]/operator` on `/[locale]/operator/accounts`, `/[locale]/operator/perimeter-damage`, `/[locale]/technician`, and `/[locale]/reports`

- [ ] **Step 1: Add failing `CHIEF` RBAC tests to `lib/proxy/auth-proxy.test.ts`**

Append test cases inside `runAuthProxyTests()` before the final `console.log` that assert:
1. `signRoleCookie("CHIEF")` is accepted by `verifyRoleCookie(...)` and returns `"CHIEF"`.
2. `getHomeRouteForRole("id", "CHIEF") === "/id/operator"`.
3. Authenticated `CHIEF` `GET /id/operator` (`routeSegment: "operator"`, `subSegments: []`) returns non-redirect (`status === 200`).
4. Authenticated `CHIEF` `GET /id/operator/accounts` (`routeSegment: "operator"`, `subSegments: ["accounts"]`) redirects (`307`) to `http://localhost:3000/id/operator`.
5. Authenticated `CHIEF` `GET /id/operator/perimeter-damage` (`routeSegment: "operator"`, `subSegments: ["perimeter-damage"]`) redirects (`307`) to `http://localhost:3000/id/operator`.
6. Authenticated `OPERATOR` `GET /id/operator/accounts` (`routeSegment: "operator"`, `subSegments: ["accounts"]`) returns non-redirect (`status === 200`).
7. Authenticated `CHIEF` `GET /id/login?callbackUrl=/id/operator/accounts` redirects (`307`) to `http://localhost:3000/id/operator` (NOT `/id/operator/accounts`).

- [ ] **Step 2: Run auth-proxy test to verify it fails**

Run: `npx tsx lib/proxy/auth-proxy.test.ts`
Expected: FAIL because `"CHIEF"` is not yet a valid role or allowed on `/id/operator`.

- [ ] **Step 3: Add `"CHIEF"` to PostgreSQL enum, Drizzle migration, `lib/auth.ts`, and `db/seed.ts`**

1. In `db/schema.ts:21-25`, update `userRoleEnum`:
   `export const userRoleEnum = pgEnum("user_role", ["REPORTER", "OPERATOR", "CHIEF", "TECHNICIAN"]);`
2. Create `drizzle/0003_add_chief_role.sql` containing:
   ```sql
   ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'CHIEF';
   ```
3. In `drizzle/meta/_journal.json`, append entry `{ "idx": 3, "version": "7", "when": 1794017800000, "tag": "0003_add_chief_role", "breakpoints": true }`.
4. In `lib/auth.ts:7`, update `export type UserRole = "REPORTER" | "OPERATOR" | "CHIEF" | "TECHNICIAN";`.
5. In `db/seed.ts:86-115`, add idempotent default `CHIEF` entry to `DEFAULT_USERS`:
   `{ nip: "2233445", name: "Chief Lapangan", role: "CHIEF" as const, position: "Chief", unit: "Aviation Security (AVSEC)", phone: "081234567803", password: seedPassword }`.

- [ ] **Step 4: Update `lib/proxy/auth-proxy.ts`, `auth.service.ts`, `client-api.ts`, and `accounts-store.ts` for `CHIEF`**

1. In `lib/proxy/auth-proxy.ts`:
   - `getHomeRouteForRole`: return `` `/${locale}/operator` `` for both `"OPERATOR"` and `"CHIEF"`.
   - `isValidRole`: return `value === "REPORTER" || value === "OPERATOR" || value === "CHIEF" || value === "TECHNICIAN"`.
   - Add helper `isOperatorMasterDataSubRoute(subSegments: string[]): boolean` returning `subSegments[0] === "accounts" || subSegments[0] === "perimeter-damage"`.
   - In `handleAuthProxy` step 2 (`routeSegment === "login"`): when `role === "CHIEF"` and `callbackUrl` starts with `/${locale}/operator/accounts` or `/${locale}/operator/perimeter-damage`, ignore `callbackUrl` and redirect to `getHomeRouteForRole(locale, role)`.
   - In `handleAuthProxy` step 4 (`routeSegment === "operator"`):
     - If `isOperatorMasterDataSubRoute(context.subSegments)` and `role !== "OPERATOR"`, redirect to `getHomeRouteForRole(locale, role)`.
     - Else if `role !== "OPERATOR" && role !== "CHIEF"`, redirect to `getHomeRouteForRole(locale, role)`.
2. In `app/[locale]/(auth)/login/_lib/auth.service.ts:125-169`:
   - Resolve `rawRole === "OPERATOR" || rawRole === "CHIEF" || rawRole === "TECHNICIAN" ? rawRole : "REPORTER"`.
   - In `callbackUrl` check: define `isMasterDataRoute = callbackUrl.startsWith(\`/${locale}/operator/accounts\`) || callbackUrl.startsWith(\`/${locale}/operator/perimeter-damage\`)`. Allow `isOperatorRoute` for `role === "OPERATOR"` OR `(role === "CHIEF" && !isMasterDataRoute)`.
3. In `app/[locale]/_lib/client-api.ts`:
   - Update `export type UserRole = "REPORTER" | "OPERATOR" | "CHIEF" | "TECHNICIAN";`.
   - Add `CHIEF` entry to `users: Record<UserRole, SessionUser>`.
   - Update `getSession()` `resolvedRole` check to recognize `"CHIEF"`.
4. In `app/[locale]/_lib/accounts-store.ts:21-25`:
   - Add `CHIEF: "Chief Lapangan"` to `roleLabels: Record<UserRole, string>`.

- [ ] **Step 5: Run auth-proxy test and verify compilation**

Run: `npx tsx lib/proxy/auth-proxy.test.ts`
Expected: PASS (`All auth proxy regression tests passed successfully!`).

- [ ] **Step 6: Commit Task 1**

```bash
git add drizzle/0003_add_chief_role.sql drizzle/meta/_journal.json db/schema.ts db/seed.ts lib/auth.ts lib/proxy/auth-proxy.ts lib/proxy/auth-proxy.test.ts "app/[locale]/(auth)/login/_lib/auth.service.ts" "app/[locale]/_lib/client-api.ts" "app/[locale]/_lib/accounts-store.ts"
git commit -m "feat(auth): add CHIEF limited-operator role, migration, and proxy RBAC"
```

---

### Task 2: Shared Report Workflow State Machine, Server Enforcement, Retention Query & Reporter Read Visibility

**Files:**
- Create: `lib/report-workflow.ts`
- Create: `lib/report-workflow.test.ts`
- Modify: `app/[locale]/_lib/client-api.ts:43-52,147-151,252-257,334-349,445-462`
- Modify: `app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts:5,45-185,310-440`
- Modify: `app/[locale]/(internal)/technician/_lib/technician.service.ts:1-37,152-235`
- Modify: `app/[locale]/(internal)/technician/_lib/technician.loader.ts:1-125`
- Modify: `app/[locale]/(internal)/technician/_lib/technician.service.test.ts`

**Interfaces:**
- Consumes: `UserRole` from `lib/auth.ts`; `LifecycleStatus`, `ReportHistoryItem`, `ReportRecord` from `app/[locale]/_lib/client-api.ts`.
- Produces (from `lib/report-workflow.ts`):
  - `export interface ApprovalInfo { actorName: string; actorRole?: UserRole; createdAt: string }`
  - `export function canRoleTransitionReportStatus(role: UserRole | string | undefined, currentStatus: string, nextStatus: LifecycleStatus): boolean`
  - `export function canRoleCloseReport(role: UserRole | string | undefined): boolean`
  - `export function getApprovalInfo(report: Pick<ReportRecord, "status" | "deletedAt" | "history">): ApprovalInfo | null`
  - `export function formatApprovalLabel(info: Pick<ApprovalInfo, "actorName" | "actorRole">, locale?: string): string`
  - `export function isReturnedHistoryItem(item: Pick<ReportHistoryItem, "status" | "previousStatus">): boolean`
- Produces (on `ReportHistoryItem` in `app/[locale]/_lib/client-api.ts`): optional `actorRole?: UserRole`.

- [ ] **Step 1: Write failing unit tests in `lib/report-workflow.test.ts` and update `technician.service.test.ts`**

Create `lib/report-workflow.test.ts` (runnable via `tsx`) asserting:
1. `TECHNICIAN`: `OPEN → IN_PROGRESS` is `true`; `OPEN → RESOLVED`, `IN_PROGRESS → RESOLVED`, `IN_PROGRESS → OPEN`, `RESOLVED → OPEN`, `CLOSED → IN_PROGRESS`, `OPEN → OPEN` are all `false`.
2. `OPERATOR` and `CHIEF`: `IN_PROGRESS → RESOLVED` is `true`; `IN_PROGRESS → OPEN` is `true`; `OPEN → IN_PROGRESS`, `OPEN → RESOLVED`, `RESOLVED → OPEN`, `CLOSED → RESOLVED`, `IN_PROGRESS → IN_PROGRESS` are all `false`.
3. `REPORTER` and `undefined`: every status transition is `false`.
4. `canRoleCloseReport`: `true` for `"OPERATOR"` and `"CHIEF"`; `false` for `"TECHNICIAN"`, `"REPORTER"`, `undefined`.
5. `getApprovalInfo`:
   - Returns `{ actorName: "Budi", actorRole: "OPERATOR", createdAt: "..." }` for a `RESOLVED` non-deleted report using the *latest* `RESOLVED` history entry.
   - Returns `null` when `report.status !== "RESOLVED"` or `report.deletedAt !== null` or history has no `RESOLVED` entry.
6. `formatApprovalLabel`:
   - `({ actorName: "Andi", actorRole: "CHIEF" }, "id")` → `"Disetujui oleh Chief Andi"`
   - `({ actorName: "Andi", actorRole: "CHIEF" }, "en")` → `"Approved by Chief Andi"`
   - `({ actorName: "Budi", actorRole: "OPERATOR" }, "id")` → `"Disetujui oleh Operator Budi"`
   - `({ actorName: "Budi" }, "en")` → `"Approved by Operator Budi"`
7. `isReturnedHistoryItem`: `true` only when `status === "OPEN" && previousStatus === "IN_PROGRESS"`.

Update `app/[locale]/(internal)/technician/_lib/technician.service.test.ts`:
- Assert `canTechnicianTransitionStatus("OPEN", "IN_PROGRESS") === true` and `false` for `OPEN → RESOLVED`, `IN_PROGRESS → RESOLVED`, `RESOLVED → OPEN`, `OPEN → OPEN`, and all `CLOSED → *`.
- Add top-level execution block so `npx tsx "app/[locale]/(internal)/technician/_lib/technician.service.test.ts"` exits non-zero if `success !== true`.

- [ ] **Step 2: Run new workflow tests to verify they fail**

Run: `npx tsx lib/report-workflow.test.ts`
Expected: FAIL with module not found (`./report-workflow`).

- [ ] **Step 3: Implement `lib/report-workflow.ts`**

Implement `ApprovalInfo`, `canRoleTransitionReportStatus`, `canRoleCloseReport`, `getApprovalInfo`, `formatApprovalLabel`, and `isReturnedHistoryItem` matching the spec table in Section 5.1.

- [ ] **Step 4: Wire `lib/report-workflow.ts`, `actorRole`, retention query, and Reporter read visibility into server & client layers**

1. `app/[locale]/_lib/client-api.ts`:
   - Add `actorRole?: UserRole;` to `ReportHistoryItem`.
   - Remove the old `transitions` constant; in `beginSubmission`:
     - Validate `action === "DELETE"` with `canRoleCloseReport(role)`.
     - Validate `action === "STATUS"` with `Boolean(payload.status) && canRoleTransitionReportStatus(role, report.status, payload.status)`.
   - In `listReports()` fallback (lines 252–256): return `clone([...reports.values()])` without filtering by `reporterId` (Improvement 5).
   - In `getImage()` (line 451): remove `if (role === "REPORTER" && r.reporterId !== users[role].id) continue;` so reporters can inspect photos of any report (Improvement 5).
2. `app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts`:
   - Import `inArray`, `isNull`, `or` from `drizzle-orm`, and `canRoleCloseReport`, `canRoleTransitionReportStatus` from `@/lib/report-workflow`.
   - In `getReportsAction()`:
     - Remove `if (userRole === "REPORTER") conditions.push(eq(schema.reports.reporterId, user.id))` (Improvement 5).
     - Replace `gte(schema.reports.createdAt, threeMonthsAgo)` with:
       `or(gte(schema.reports.createdAt, threeMonthsAgo), and(isNull(schema.reports.deletedAt), inArray(schema.reports.status, ["OPEN", "IN_PROGRESS"])))` (90-day retention rule).
     - Add `actorRole: schema.user.role` to `historyRows` select and map `actorRole: (h.actorRole as UserRole | null) || undefined` on `historyItems`.
   - In `commitReportSubmissionAction()`:
     - For `action === "DELETE"`: check `if (!canRoleCloseReport(userRole))` throw `"Hanya Operator atau Chief yang dapat menutup laporan."`.
     - For `action === "STATUS"`: check `if (!canRoleTransitionReportStatus(userRole, report.status, payload.status))` throw `"Perubahan status tidak diizinkan untuk peran Anda pada status laporan saat ini."`.
     - Pass `previousStatus` and `narrative: payload.narrative` into `dispatchReportNotificationAction` for `action === "STATUS"`.
3. `app/[locale]/(internal)/technician/_lib/technician.service.ts`:
   - Replace `ALLOWED_TECHNICIAN_TRANSITIONS` with `canRoleTransitionReportStatus("TECHNICIAN", currentStatus, nextStatus)` inside `canTechnicianTransitionStatus`.
   - Select `actorRole: schema.user.role` on `allHistory` and include `actorRole` in `historyItems`.
   - Pass `previousStatus: report.status` and `narrative: input.narrative.trim()` to `dispatchReportNotificationAction`.
4. `app/[locale]/(internal)/technician/_lib/technician.loader.ts`:
   - Import `inArray`, `or` from `drizzle-orm`.
   - Update `summaryRow` SQL `FILTER` clauses: `open` and `inProgress` drop `createdAt >= threeMonthsAgo`; `totalActive` counts `deletedAt IS NULL AND (status IN ('OPEN', 'IN_PROGRESS') OR (status = 'RESOLVED' AND createdAt >= threeMonthsAgo))`; `resolved` keeps `createdAt >= threeMonthsAgo`.
   - Update `reportRows` `.where(...)` to the exact same `or(gte(createdAt, threeMonthsAgo), and(isNull(deletedAt), inArray(status, ["OPEN", "IN_PROGRESS"])))` predicate.
   - Select `actorRole: schema.user.role` on `historyRows` and map `actorRole` onto `historyItems`.

- [ ] **Step 5: Run workflow and technician service tests to verify they pass**

Run: `npx tsx lib/report-workflow.test.ts && npx tsx "app/[locale]/(internal)/technician/_lib/technician.service.test.ts"`
Expected: Both exit 0 with all assertions passing.

- [ ] **Step 6: Commit Task 2**

```bash
git add lib/report-workflow.ts lib/report-workflow.test.ts "app/[locale]/_lib/client-api.ts" "app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts" "app/[locale]/(internal)/technician/_lib/technician.service.ts" "app/[locale]/(internal)/technician/_lib/technician.loader.ts" "app/[locale]/(internal)/technician/_lib/technician.service.test.ts"
git commit -m "feat(workflow): enforce two-stage repair verification, active retention, and reporter all-reports query"
```

---

### Task 3: Notifications & Bilingual i18n Updates

**Files:**
- Modify: `app/[locale]/_lib/notifications.actions.ts:4,78-82,136-143,248-257,335-478`
- Modify: `app/[locale]/_lib/notification-templates.ts:17-178`
- Modify: `lib/i18n/dictionaries/id.ts:50-71,148-178`
- Modify: `lib/i18n/dictionaries/en.ts:50-72,150-180`

**Interfaces:**
- Consumes: `UserRole` (`"REPORTER" | "OPERATOR" | "CHIEF" | "TECHNICIAN"`) from `lib/auth.ts`.
- Produces:
  - `dispatchReportNotificationAction` accepting optional `previousStatus?: string` and allowing `actor.role === "CHIEF"` for `STATUS` and `DELETE`.
  - `getNotificationsAction` & `markAllNotificationsReadAction` delivering `"OPERATOR"` and `"CHIEF"` broadcasts to `CHIEF` users without duplicate rows.
  - Bilingual i18n keys in `id.ts` & `en.ts`:
    - `header.roles.CHIEF` (`"Chief Lapangan"` / `"Field Chief"`)
    - `header.viewAllMyReports` updated to `"Buka Daftar Laporan Perimeter"` / `"Open Perimeter Reports List"`
    - `operator.readiness`: `{ title, readyGrids, damagedGrids, impactedGridsLabel, allClear, openLabel, awaitingVerificationLabel, resolvedLabel, moreCount }`
    - `operator.verification`: `{ approveAction, returnAction, approveTitle, returnTitle, approveSubtitle, returnSubtitle, approvePlaceholder, returnPlaceholder, awaitingVerificationBadge, approvedByOperator, approvedByChief, returnedToTechnician }`
    - `technician.awaitingVerification` (`"Menunggu Verifikasi Operator"` / `"Awaiting Operator Verification"`) and `technician.verifiedComplete` (`"Selesai Diverifikasi"` / `"Verified Complete"`).

- [ ] **Step 1: Update `app/[locale]/_lib/notifications.actions.ts` for `CHIEF` & verification/return context**

1. Import `inArray` from `drizzle-orm`.
2. In `resolveCurrentActor()`: recognize `rawRole === "OPERATOR" || rawRole === "CHIEF" || rawRole === "TECHNICIAN"`.
3. Add helper `roleNotificationCondition(actorRole: UserRole)` returning `actorRole === "CHIEF" ? inArray(schema.notification.targetRole, ["OPERATOR", "CHIEF"]) : eq(schema.notification.targetRole, actorRole)` and use it in both `getNotificationsAction` and `markAllNotificationsReadAction`.
4. Add optional `previousStatus?: string` to `dispatchReportNotificationAction` params.
5. In `dispatchReportNotificationAction`:
   - `STATUS`: allow `actor.role === "OPERATOR" || actor.role === "CHIEF" || actor.role === "TECHNICIAN"`; pass `previousStatus: params.previousStatus` and `note: params.narrative` inside `params` for all 3 notification targets (`STATUS_UPDATE_REPORTER`, `STATUS_UPDATE_OPERATOR`, `STATUS_UPDATE_TECHNICIAN`).
   - `DELETE`: allow `actor.role === "OPERATOR" || actor.role === "CHIEF"`.

- [ ] **Step 2: Update `app/[locale]/_lib/notification-templates.ts` for two-stage verification copy (ID & EN)**

1. Add optional `previousStatus?: string` to `NotificationParams`.
2. In `NOTIFICATION_TEMPLATES.id` and `NOTIFICATION_TEMPLATES.en`:
   - `STATUS_UPDATE_REPORTER`, `STATUS_UPDATE_OPERATOR`, and `STATUS_UPDATE_TECHNICIAN` branch cleanly on 3 cases:
     - **Returned (`p.status === "OPEN" && p.previousStatus === "IN_PROGRESS"`):**
       - `TECHNICIAN`: *"Perbaikan Dikembalikan · `<part>`"* / *"Repair Returned · `<part>`"* including `actorName` and `note`.
       - `REPORTER`: *"Perbaikan Sedang Ditinjau Ulang"* / *"Repair Under Re-evaluation"*.
       - `OPERATOR`: *"Laporan Dikembalikan · `<part>`"* / *"Report Returned · `<part>`"*.
     - **Approved (`p.status === "RESOLVED"`):**
       - `REPORTER`: *"Laporan Anda Selesai & Diverifikasi"* / *"Your Report Has Been Verified & Resolved"* by `actorName`.
       - `TECHNICIAN`: *"Perbaikan Disetujui · `<part>`"* / *"Repair Approved · `<part>`"* by `actorName`.
       - `OPERATOR`: *"Perbaikan Disetujui · `<part>`"* / *"Repair Approved · `<part>`"* by `actorName`.
     - **Handled (`p.status === "IN_PROGRESS"`):**
       - `OPERATOR`: *"Menunggu Verifikasi · `<part>`"* / *"Awaiting Verification · `<part>`"* (technician finished handling, awaiting field verification).
       - `REPORTER`: *"Laporan Anda Ditangani"* / *"Your Report Is Being Handled"* (awaiting operator verification).
       - `TECHNICIAN`: *"Menunggu Verifikasi · `<part>`"* / *"Awaiting Verification · `<part>`"*.

- [ ] **Step 3: Update `lib/i18n/dictionaries/id.ts` and `lib/i18n/dictionaries/en.ts`**

Add all keys listed in the **Produces** block above with 1:1 structural parity (`en: typeof id` enforces identical structure at compile time).

- [ ] **Step 4: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: Exit 0 with zero TypeScript errors across the entire project.

- [ ] **Step 5: Commit Task 3**

```bash
git add "app/[locale]/_lib/notifications.actions.ts" "app/[locale]/_lib/notification-templates.ts" lib/i18n/dictionaries/id.ts lib/i18n/dictionaries/en.ts
git commit -m "feat(notifications,i18n): support CHIEF notifications and verification/return templates"
```

---

### Task 4: `CHIEF` Navigation/RBAC UI, Accounts Master Data Support & Reporter All-Reports UI

**Files:**
- Modify: `app/[locale]/_components/app-header.tsx:105-115,186-200,234-239,307-412,617-623,694-808`
- Modify: `app/[locale]/(internal)/operator/accounts/_lib/accounts.schema.ts:4-6`
- Modify: `app/[locale]/(internal)/operator/accounts/page.tsx:149-155,173-179,514-530,583-590,702-708,976-981`
- Modify: `app/[locale]/(internal)/operator/perimeter-damage/page.tsx:138-144`
- Modify: `app/[locale]/(internal)/reports/page.tsx:85-95`
- Modify: `app/[locale]/(internal)/reports/_components/report-list.tsx:96-127,269-272,379-387`
- Modify: `app/[locale]/(internal)/reports/[reportId]/page.tsx:16-18,64-75`

**Interfaces:**
- Consumes: `UserRole` (including `"CHIEF"`), `roleLabels.CHIEF`, `t.header.roles.CHIEF`, `t.reports.title`.
- Produces:
  - Header showing `Pantau Perimeter` to `OPERATOR` & `CHIEF`, and `Data Master` (desktop & mobile) **only** to `OPERATOR`.
  - Accounts management supporting creating/editing/filtering/displaying `CHIEF` accounts.
  - Reporter dashboard & detail pages showing all perimeter reports without `reporterId` filtering.

- [ ] **Step 1: Split `isOperatorDashboardRole` and `canAccessMasterData` in `app/[locale]/_components/app-header.tsx`**

1. Define:
   - `const isOperatorDashboardRole = user?.role === "OPERATOR" || user?.role === "CHIEF" || Boolean(roleLabel?.toLowerCase().includes("operator")) || Boolean(roleLabel?.toLowerCase().includes("chief"));`
   - `const canAccessMasterData = user?.role === "OPERATOR";`
2. Use `isOperatorDashboardRole` for: `getHomeRoute()` (`/${locale}/operator`), desktop `Pantau Perimeter` link, mobile `Pantau Perimeter` link, and notification footer CTA (`t.header.viewAllOperatorReports`).
3. Gate both the desktop `Data Master` dropdown (`lines 324–409`) and the mobile `Data Master` collapsible (`lines 722–805`) strictly behind `{canAccessMasterData && (...)}`.
4. Ensure `resolvedRoleLabel` resolves `t.header.roles[user.role]` (which now covers `CHIEF`).

- [ ] **Step 2: Support `"CHIEF"` in Accounts schema and Master Data pages**

1. `app/[locale]/(internal)/operator/accounts/_lib/accounts.schema.ts:4-6`:
   Update `userRoleEnum` to `z.enum(["REPORTER", "OPERATOR", "CHIEF", "TECHNICIAN"], { message: "Role harus salah satu dari REPORTER, OPERATOR, CHIEF, atau TECHNICIAN." })`.
2. `app/[locale]/(internal)/operator/accounts/page.tsx`:
   - Guard (lines 149–154): keep `if (session.role !== "OPERATOR")`, redirect `CHIEF` to `/${locale}/operator`, `TECHNICIAN` to `/${locale}/technician`, else `/${locale}/reports`.
   - `totalOperators` (line 174): count `a.role === "OPERATOR" || a.role === "CHIEF"` (card label `"Operator & Chief"`).
   - Role filter pills (lines 584–589): add `["CHIEF", \`Chief (${accounts.filter((a) => a.role === "CHIEF").length})\`]`.
   - `roleBadgeClass` (lines 702–707): add distinct pill style for `CHIEF` (`bg-[var(--rd-lime)]/15 text-[var(--rd-lime)]`).
   - Account create/edit `<select>` (lines 977–979): add `<option value="CHIEF">Chief Lapangan</option>`.
3. `app/[locale]/(internal)/operator/perimeter-damage/page.tsx:138-143`:
   Keep `if (session.role !== "OPERATOR")`, redirect `CHIEF` to `/${locale}/operator`, `TECHNICIAN` to `/${locale}/technician`, else `/${locale}/reports`.

- [ ] **Step 3: Open Reporter report list & detail pages to all perimeter reports (Improvement 5)**

1. `app/[locale]/(internal)/reports/page.tsx:85-95`:
   Remove `reports.filter((r) => r.reporterId === user.id)` — pass `visibleReports = user ? reports : []` directly to `<ReportList reports={visibleReports} ... />` and compute `selected` from `visibleReports`.
2. `app/[locale]/(internal)/reports/_components/report-list.tsx`:
   - Replace `owned` filter (lines 96–103) with `const visibleReports = user ? reports : [];` and compute `stats` and `<ReportHistoryPanel reports={visibleReports} ... />` from `visibleReports`.
   - Update line 110 (`"Seluruh laporan perimeter yang tercatat"` / `"All recorded perimeter reports"`), line 124 (`"Telah diverifikasi selesai"` / `"Verified as resolved"`), and line 270 (`"Rekapitulasi seluruh laporan perimeter saat ini"` / `"Summary of all current perimeter reports"`).
3. `app/[locale]/(internal)/reports/[reportId]/page.tsx`:
   - Import `useTranslation` from `@/lib/i18n` and replace hardcoded breadcrumb `"Laporan Saya"` (line 68) with `{t.reports.title}`.

- [ ] **Step 4: Run TypeScript type check and existing test suite**

Run: `npx tsc --noEmit && npm test`
Expected: Exit 0 with zero TypeScript errors and all existing tests passing.

- [ ] **Step 5: Commit Task 4**

```bash
git add "app/[locale]/_components/app-header.tsx" "app/[locale]/(internal)/operator/accounts/_lib/accounts.schema.ts" "app/[locale]/(internal)/operator/accounts/page.tsx" "app/[locale]/(internal)/operator/perimeter-damage/page.tsx" "app/[locale]/(internal)/reports/page.tsx" "app/[locale]/(internal)/reports/_components/report-list.tsx" "app/[locale]/(internal)/reports/[reportId]/page.tsx"
git commit -m "feat(ui): wire CHIEF access restrictions, accounts role UI, and reporter all-reports view"
```

---

### Task 5: Operator/Chief Verification UI, Attribution Badges & Technician Ceiling UI

**Files:**
- Modify: `app/[locale]/(internal)/operator/_components/update-status-dialog.tsx:81-125,246-254,292-306,360-467,670-689`
- Modify: `app/[locale]/(internal)/operator/_components/report-detail-sheet.tsx:1-200`
- Modify: `app/[locale]/(internal)/operator/page.tsx:35,50-56,186-203`
- Modify: `app/[locale]/(internal)/technician/page.tsx:68-74,220-234,316-343`
- Modify: `app/[locale]/_components/report-history-panel.tsx:1-220`
- Modify: `app/[locale]/(internal)/reports/[reportId]/_components/report-detail.tsx:1-395`

**Interfaces:**
- Consumes: `getApprovalInfo`, `formatApprovalLabel`, `isReturnedHistoryItem` from `@/lib/report-workflow`; `UserRole`, `LifecycleStatus` from `client-api.ts`.
- Produces:
  - `SubmissionFormProps` extended with `fixedStatus?: LifecycleStatus`.
  - `ReportDetailSheetProps` extended with `canVerifyRepair?: boolean` and `onVerifyAction?: (targetStatus: "RESOLVED" | "OPEN") => void`.
  - Visual approval attribution (*"Disetujui oleh Operator/Chief `<name>`"*) on `ReportDetailSheet`, `ReportDetail`, and `ReportCardItem`.

- [ ] **Step 1: Extend `UpdateStatusDialog` with `fixedStatus` mode & verification/return copy**

In `app/[locale]/(internal)/operator/_components/update-status-dialog.tsx`:
1. Add `fixedStatus?: LifecycleStatus;` to `SubmissionFormProps`.
2. Compute `const resolvedFixedStatus: LifecycleStatus | undefined = fixedStatus ?? (isTechnician && action === "STATUS" ? "IN_PROGRESS" : undefined);`.
3. Update draft key to `` const key = `${user.id}:${action}:${resolvedFixedStatus || ""}:${report?.id || "new"}`; `` so Approve and Return drafts never collide.
4. Set initial `status` state to `resolvedFixedStatus ?? defaultStatus` and submit `targetStatus = resolvedFixedStatus ?? status`.
5. Hide the `<select>` status dropdown whenever `resolvedFixedStatus` is defined (no manual status jumping for technician, operator approval, or operator return).
6. Update eyebrow, heading, subtitle, narrative label/placeholder, and submit button text for each locked mode:
   - `isTechnician` (`fixedStatus = "IN_PROGRESS"`): eyebrow `"TINDAKAN TEKNISI"`, title `"Tandai Sedang Ditangani"`, subtitle explaining that repair evidence will be forwarded for Operator/Chief field verification, submit `"Kirim untuk Verifikasi"`.
   - `OPERATOR`/`CHIEF` Approve (`fixedStatus = "RESOLVED"`): eyebrow `user.role === "CHIEF" ? "VERIFIKASI CHIEF" : "VERIFIKASI OPERATOR"`, title `"Verifikasi & Setujui Perbaikan"`, subtitle requiring actual field inspection notes + actual field photo, narrative label `"Narasi verifikasi lapangan"`, placeholder `"Catat hasil pengecekan aktual di lapangan dan konfirmasi kelayakan perbaikan."`, submit `"Setujui Perbaikan"`.
   - `OPERATOR`/`CHIEF` Return (`fixedStatus = "OPEN"`): eyebrow `user.role === "CHIEF" ? "VERIFIKASI CHIEF" : "VERIFIKASI OPERATOR"`, title `"Kembalikan Laporan ke Teknisi"`, subtitle requiring actual field photo + explanation of why the repair does not meet requirements, narrative label `"Alasan pengembalian (kondisi lapangan)"`, placeholder `"Jelaskan kekurangan hasil perbaikan di lapangan agar dapat ditindaklanjuti kembali oleh teknisi."`, submit `"Kembalikan ke Teknisi"` (using `btnDanger` styling).
7. Preserve existing validation in `submit()` (`!narrative.trim() || countText(narrative) > 2000 || !files.length`) so both narrative and ≥1 actual field photo remain strictly mandatory.

- [ ] **Step 2: Add Approve/Return buttons and Approval/Return attribution to `ReportDetailSheet`**

In `app/[locale]/(internal)/operator/_components/report-detail-sheet.tsx`:
1. Extend `ReportDetailSheetProps` with `canVerifyRepair?: boolean;` and `onVerifyAction?: (targetStatus: "RESOLVED" | "OPEN") => void;`.
2. Compute `const approvalInfo = getApprovalInfo(report);` using `getApprovalInfo` and `formatApprovalLabel` from `@/lib/report-workflow`.
3. Render an approval banner/callout immediately under the status badge row when `approvalInfo` is non-null (using `ShieldCheck` icon + `--rd-lime` token styling, displaying `formatApprovalLabel(approvalInfo)`).
4. In the action bar (`operator && !report.deletedAt`):
   - When `canVerifyRepair && report.status === "IN_PROGRESS" && onVerifyAction`, render:
     - Primary button **"Setujui Perbaikan"** → `onVerifyAction("RESOLVED")`
     - Outline/warning button **"Kembalikan ke Teknisi"** → `onVerifyAction("OPEN")`
   - Keep existing `canUpdateStatus` button (used by Technician) and `canDelete` button (`"Tutup laporan"`).
5. In the history timeline (`report.history`):
   - For items where `isReturnedHistoryItem(item)` is true, label heading `"Dikembalikan ke Teknisi"`.
   - For items where `item.status === "RESOLVED"`, display `formatApprovalLabel({ actorName: item.actorName, actorRole: item.actorRole })`.

- [ ] **Step 3: Wire `operator/page.tsx` and `technician/page.tsx` to the new verification & ceiling flows**

1. `app/[locale]/(internal)/operator/page.tsx`:
   - Role guard (line 50): allow `session.role === "OPERATOR" || session.role === "CHIEF"`.
   - Replace `action` state with `type OperatorAction = { type: "DELETE" } | { type: "STATUS"; targetStatus: "RESOLVED" | "OPEN" } | null;`.
   - Pass `canVerifyRepair={user?.role === "OPERATOR" || user?.role === "CHIEF"}`, `canDelete={user?.role === "OPERATOR" || user?.role === "CHIEF"}`, `onVerifyAction={(targetStatus) => setPendingAction({ type: "STATUS", targetStatus })}`, and `onAction={(a) => a === "DELETE" && setPendingAction({ type: "DELETE" })}` to `ReportDetailSheet`.
   - Pass `action={pendingAction.type}`, `fixedStatus={pendingAction.type === "STATUS" ? pendingAction.targetStatus : undefined}`, and key `` `${user.id}:${pendingAction.type}:${pendingAction.type === "STATUS" ? pendingAction.targetStatus : ""}:${selected?.id || "new"}` `` to `UpdateStatusDialog`.
2. `app/[locale]/(internal)/technician/page.tsx`:
   - Role guard (lines 68–73): redirect `OPERATOR` and `CHIEF` to `/${locale}/operator`.
   - Summary card #2 (line 224): update label from `"Sedang Dikerjakan"` to `"Menunggu Verifikasi"`.
   - `ReportDetailSheet` props (lines 332–340):
     - `statusActionDisabled={selected.status !== "OPEN" || !!selected.deletedAt}`
     - `statusActionLabel={selected.deletedAt ? "Laporan Ditutup" : selected.status === "OPEN" ? "Tandai Ditangani" : selected.status === "IN_PROGRESS" ? "Menunggu Verifikasi Operator" : "Selesai Diverifikasi"}`
   - `UpdateStatusDialog`: pass `fixedStatus="IN_PROGRESS"` so technician dialog is strictly locked to `OPEN → IN_PROGRESS`.

- [ ] **Step 4: Add approval attribution to `ReportCardItem` and Reporter `ReportDetail`**

1. `app/[locale]/_components/report-history-panel.tsx` (`ReportCardItem`):
   - Call `getApprovalInfo(report)` and when non-null, render a compact `--rd-lime` meta item with `ShieldCheck` icon and `formatApprovalLabel(approvalInfo, locale)` in the card footer.
2. `app/[locale]/(internal)/reports/[reportId]/_components/report-detail.tsx`:
   - Show reporter name in header metadata: `Dilaporkan oleh {report.reporterName || "Pelapor"} · {timestamp(report.createdAt)}`.
   - Show approval callout badge when `getApprovalInfo(report)` is non-null.
   - In the history list, display `"Dikembalikan ke Teknisi"` when `isReturnedHistoryItem(item)` is true and `formatApprovalLabel({ actorName: item.actorName, actorRole: item.actorRole })` when `item.status === "RESOLVED"`.

- [ ] **Step 5: Run TypeScript type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: Exit 0 with zero TypeScript errors and all tests passing.

- [ ] **Step 6: Commit Task 5**

```bash
git add "app/[locale]/(internal)/operator/_components/update-status-dialog.tsx" "app/[locale]/(internal)/operator/_components/report-detail-sheet.tsx" "app/[locale]/(internal)/operator/page.tsx" "app/[locale]/(internal)/technician/page.tsx" "app/[locale]/_components/report-history-panel.tsx" "app/[locale]/(internal)/reports/[reportId]/_components/report-detail.tsx"
git commit -m "feat(workflow-ui): add operator/chief verification dialog, approval badges, and technician ceiling"
```

---

### Task 6: 60-Grid Perimeter Readiness Engine & Operator Dashboard KPI Block

**Files:**
- Create: `app/[locale]/_data/perimeter-grids.ts`
- Modify: `app/[locale]/_components/airport-grid.ts:88-121`
- Create: `lib/perimeter-readiness.ts`
- Create: `lib/perimeter-readiness.test.ts`
- Create: `app/[locale]/(internal)/operator/_components/perimeter-readiness-card.tsx`
- Modify: `app/[locale]/(internal)/operator/page.tsx:15-20,120-225`

**Interfaces:**
- Consumes: `ROW_LABELS`, `gridToLatLng` from `app/[locale]/_components/airport-grid.ts`; `ReportRecord` from `app/[locale]/_lib/client-api.ts`; `t.operator.readiness` from `@/lib/i18n`.
- Produces:
  - `app/[locale]/_components/airport-grid.ts`: `export function latLngToGridFloat(lat: number, lng: number): { colFloat: number; rowFloat: number }`
  - `app/[locale]/_data/perimeter-grids.ts`: `PERIMETER_GRID_CODES` (readonly 60-tuple), `PERIMETER_GRID_TOTAL = 60`, `PERIMETER_GRID_SET: ReadonlySet<string>`, `PERIMETER_GRID_BOXES: ReadonlyArray<{ code: string; colIndex: number; rowIndex: number }>`
  - `lib/perimeter-readiness.ts`:
    - `export interface PerimeterReadinessSummary { totalGrids: number; damagedGrids: number; readyGrids: number; readinessPercent: number; damagedGridCodes: string[]; openCount: number; awaitingVerificationCount: number; resolvedCount: number }`
    - `export function resolvePerimeterGridCode(report: Pick<ReportRecord, "segmentCode" | "latitude" | "longitude">): string | null`
    - `export function calculatePerimeterReadiness(reports: ReadonlyArray<Pick<ReportRecord, "status" | "deletedAt" | "segmentCode" | "latitude" | "longitude">>): PerimeterReadinessSummary`
  - `PerimeterReadinessCard` component rendered at the top of `operator/page.tsx`.

- [ ] **Step 1: Write failing unit tests in `lib/perimeter-readiness.test.ts`**

Create `lib/perimeter-readiness.test.ts` asserting:
1. `PERIMETER_GRID_TOTAL === 60` and `PERIMETER_GRID_SET.size === 60` (no duplicates).
2. Empty reports array → `{ totalGrids: 60, damagedGrids: 0, readyGrids: 60, readinessPercent: 100, damagedGridCodes: [] }`.
3. Deduplication: 3 active reports (`OPEN`, `IN_PROGRESS`, `OPEN`) all in `M11` → `damagedGrids === 1`, `readyGrids === 59`, `readinessPercent === 98.3`, `damagedGridCodes` equals `["M11"]`.
4. 6 distinct damaged grids (`J2`, `I10`, `M11`, `M15`, `K28`, `L2`) → `damagedGrids === 6`, `readyGrids === 54`, `readinessPercent === 90`.
5. `RESOLVED` reports and soft-deleted (`deletedAt !== null`) reports do NOT reduce readiness (`damagedGrids === 0`, `readinessPercent === 100`).
6. South-edge coordinate snapping: construct `[lat, lng] = gridToLatLng(14.5, 13.04)` (inside `N15`, 0.04 cells south of `M15`) with `segmentCode: "N15"` → `resolvePerimeterGridCode(...) === "M15"`.
7. Far interior report (`segmentCode: "K10"` with `[lat, lng] = gridToLatLng(9.5, 10.5)`) and invalid coords (`NaN, NaN`, no `segmentCode`) both resolve to `null` and do not throw or change readiness.

- [ ] **Step 2: Run readiness tests to verify they fail**

Run: `npx tsx lib/perimeter-readiness.test.ts`
Expected: FAIL with module not found (`./perimeter-readiness`).

- [ ] **Step 3: Export `latLngToGridFloat`, create `perimeter-grids.ts`, and implement `lib/perimeter-readiness.ts`**

1. In `app/[locale]/_components/airport-grid.ts:93-121`: extract the existing inverse-projection math into `export function latLngToGridFloat(lat: number, lng: number): { colFloat: number; rowFloat: number }` and have `getGridCellFromLatLng` call it (zero behavior change).
2. Create `app/[locale]/_data/perimeter-grids.ts` with the exact 60 `PERIMETER_GRID_CODES` from spec Section 5.3, `PERIMETER_GRID_TOTAL = PERIMETER_GRID_CODES.length`, `PERIMETER_GRID_SET`, and pre-parsed `PERIMETER_GRID_BOXES` (`colIndex = Number(code.slice(1)) - 1`, `rowIndex = ROW_LABELS.indexOf(code[0])`).
3. Create `lib/perimeter-readiness.ts`:
   - `distanceToBox(colFloat, rowFloat, colIndex, rowIndex)`: Euclidean distance to `[colIndex, colIndex + 1] × [rowIndex, rowIndex + 1]` (`dx = Math.max(colIndex - colFloat, 0, colFloat - (colIndex + 1))`, `dy = Math.max(rowIndex - rowFloat, 0, rowFloat - (rowIndex + 1))`, `Math.hypot(dx, dy)`).
   - `resolvePerimeterGridCode`: check normalized `segmentCode` in `PERIMETER_GRID_SET`; else if `Number.isFinite(latitude) && Number.isFinite(longitude)`, project via `latLngToGridFloat`, find nearest box in `PERIMETER_GRID_BOXES`, return its `code` if `minDist <= 0.25`, else `null`.
   - `calculatePerimeterReadiness`: iterate all reports to compute `openCount`, `awaitingVerificationCount`, `resolvedCount`, deduplicate active (`!deletedAt && (status === "OPEN" || status === "IN_PROGRESS")`) resolved grid codes in a `Set`, order `damagedGridCodes` by `PERIMETER_GRID_CODES` order, compute `readyGrids = 60 - damagedGrids` and `readinessPercent = Math.round(((readyGrids / 60) * 100) * 10) / 10`.

- [ ] **Step 4: Run readiness tests to verify they pass**

Run: `npx tsx lib/perimeter-readiness.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Build `PerimeterReadinessCard` and integrate into `operator/page.tsx`**

1. Create `app/[locale]/(internal)/operator/_components/perimeter-readiness-card.tsx`:
   - Props: `{ summary: PerimeterReadinessSummary; loading?: boolean; activeSearch?: string; onSelectGrid?: (gridCode: string) => void }`.
   - Renders with `--rd-*` tokens:
     - Title (`t.operator.readiness.title`), large formatted percentage (`96,7%` in `id` / `96.7%` in `en`), threshold-colored progress bar (`>= 95` `--rd-lime`, `>= 80` `--rd-brown`, `< 80` `--rd-coral`), fixed-denominator counts (`${summary.readyGrids}/${summary.totalGrids} grid siap` & `${summary.damagedGrids}/${summary.totalGrids} grid rusak`).
     - Clickable impacted grid chips (up to 8 chips + `+N` overflow badge) when `damagedGridCodes.length > 0`, invoking `onSelectGrid(code)`.
     - Compact status counters (`Baru`, `Menunggu Verifikasi`, `Selesai`) and `Skeleton` placeholders when `loading === true`.
2. In `app/[locale]/(internal)/operator/page.tsx`:
   - Compute `const readiness = useMemo(() => calculatePerimeterReadiness(reports), [reports]);` from **full `reports`** (never `visible`).
   - Render `<PerimeterReadinessCard summary={readiness} loading={loading} activeSearch={search} onSelectGrid={(code) => { setFilter("ALL"); setSearch((prev) => prev.toUpperCase() === code ? "" : code); }} />` right below the breadcrumb and above the map + panel grid.
   - Adjust desktop container height from `md:h-[calc(100dvh-280px)] md:min-h-[550px]` to `md:h-[calc(100dvh-350px)] md:min-h-[520px]`.

- [ ] **Step 6: Run TypeScript type check and readiness tests**

Run: `npx tsc --noEmit && npx tsx lib/perimeter-readiness.test.ts`
Expected: Exit 0 with zero errors.

- [ ] **Step 7: Commit Task 6**

```bash
git add "app/[locale]/_components/airport-grid.ts" "app/[locale]/_data/perimeter-grids.ts" lib/perimeter-readiness.ts lib/perimeter-readiness.test.ts "app/[locale]/(internal)/operator/_components/perimeter-readiness-card.tsx" "app/[locale]/(internal)/operator/page.tsx"
git commit -m "feat(readiness): add 60-grid perimeter readiness calculation and operator KPI card"
```

---

### Task 7: Perimeter Segment Partitioning, Translucent Red Map Overlay & Full Test Suite Wiring

**Files:**
- Create: `lib/perimeter-segments.ts`
- Create: `lib/perimeter-segments.test.ts`
- Modify: `app/[locale]/_components/perimeter-map-inner.tsx:15-45,94-115,146-245,246-292`
- Modify: `app/[locale]/(internal)/operator/_components/perimeter-map.tsx:6-48`
- Modify: `app/[locale]/(internal)/operator/page.tsx:174-180`
- Modify: `app/[locale]/(internal)/technician/page.tsx:304-310`
- Modify: `package.json:10`

**Interfaces:**
- Consumes: `latest_perimeter.json`, `PERIMETER_GRID_CODES`, `PERIMETER_GRID_BOXES`, `latLngToGridFloat`, `calculatePerimeterReadiness`.
- Produces:
  - `lib/perimeter-segments.ts`:
    - `export interface PerimeterSegmentPolyline { gridCode: string; latLngs: [number, number][] }`
    - `export function getPerimeterPolylinesForGrids(gridCodes: Iterable<string>): PerimeterSegmentPolyline[]`
  - `PerimeterMapInnerProps` & `PerimeterMapProps`: optional `damagedGridCodes?: string[]`.
  - Updated `npm test` script executing all unit test suites (`evidence-image`, `date-filter`, `auth-proxy`, `report-workflow`, `technician.service`, `perimeter-readiness`, `perimeter-segments`).

- [ ] **Step 1: Write failing unit tests in `lib/perimeter-segments.test.ts`**

Create `lib/perimeter-segments.test.ts` asserting:
1. Every single grid code in `PERIMETER_GRID_CODES` (all 60/60) returns ≥1 polyline from `getPerimeterPolylinesForGrids([code])`, and every polyline has `latLngs.length >= 2` with finite `lat` in `[-8.0, -7.8]` and `lng` in `[110.0, 110.1]`.
2. `getPerimeterPolylinesForGrids(["M11"])` returns non-empty polylines whose `gridCode === "M11"`.
3. `getPerimeterPolylinesForGrids([])` returns `[]`.
4. `getPerimeterPolylinesForGrids(["INVALID", "A1", "m11"])` ignores unknown codes and normalizes `"m11"` → `"M11"`.
5. Deduplication: `getPerimeterPolylinesForGrids(["M11", "M11"])` returns the same count as `["M11"]`.

- [ ] **Step 2: Run perimeter-segments tests to verify they fail**

Run: `npx tsx lib/perimeter-segments.test.ts`
Expected: FAIL with module not found (`./perimeter-segments`).

- [ ] **Step 3: Implement `lib/perimeter-segments.ts`**

Implement the cached edge-partitioning algorithm from spec Section 5.4:
1. Read ring `perimeter.features[0].geometry.coordinates[0]` (`[lng, lat][]`).
2. For each edge `(p1, p2)`, subdivide into `steps = Math.max(1, Math.ceil(Math.hypot(c2 - c1, r2 - r1) / 0.04))` micro-segments in grid space.
3. Assign each micro-segment to the nearest block in `PERIMETER_GRID_BOXES` (using midpoint box distance).
4. Group consecutive micro-segments sharing the same `gridCode` into `[lat, lng][]` polylines; stitch the first and last run if they share the same `gridCode` (closed polygon wrap-around).
5. Cache in `Map<string, [number, number][][]>` and implement `getPerimeterPolylinesForGrids(gridCodes)` with uppercase normalization and `Set` deduplication.

- [ ] **Step 4: Run perimeter-segments tests to verify 60/60 coverage passes**

Run: `npx tsx lib/perimeter-segments.test.ts`
Expected: PASS (all 60 blocks covered and all assertions green).

- [ ] **Step 5: Integrate translucent red overlay into Leaflet map & wire `npm test`**

1. `app/[locale]/_components/perimeter-map-inner.tsx`:
   - Add `damagedGridCodes?: string[];` to `PerimeterMapInnerProps`.
   - Create `const damageOverlayLayer = useRef<L.LayerGroup | null>(null);`, initialize `damageOverlayLayer.current = L.layerGroup().addTo(instance);` right after the base green `L.geoJSON(perimeter, ...)` polygon and before `layer.current` (pins), and clean it up in the unmount return (`damageOverlayLayer.current = null`).
   - Add a `useEffect` depending on `[damagedGridCodes, reports]`:
     - Resolve `activeDamagedGrids = damagedGridCodes ?? (reports.length > 0 ? calculatePerimeterReadiness(reports).damagedGridCodes : [])`.
     - `damageOverlayLayer.current.clearLayers()`.
     - For each segment from `getPerimeterPolylinesForGrids(activeDamagedGrids)`, add two non-interactive `L.polyline(seg.latLngs, ...)` layers to `damageOverlayLayer.current`:
       - Outer glow: `{ color: "#ef4444", weight: 10, opacity: 0.38, lineCap: "round", lineJoin: "round", interactive: false }`
       - Core line: `{ color: "#dc2626", weight: 4, opacity: 0.72, lineCap: "round", lineJoin: "round", interactive: false }`
2. `app/[locale]/(internal)/operator/_components/perimeter-map.tsx`:
   - Add `damagedGridCodes?: string[];` to `PerimeterMapProps` and forward it to `<MapView damagedGridCodes={damagedGridCodes} ... />`.
   - Add legend item in the bottom overlay bar: `<span className="flex items-center gap-1.5"><i className="inline-block h-[4px] w-3 rounded-full bg-red-500/75" />Segmen rusak</span>`.
3. `app/[locale]/(internal)/operator/page.tsx`:
   - Pass `damagedGridCodes={readiness.damagedGridCodes}` to `<PerimeterMap />` (so red overlay reflects all active perimeter damage even when status/search filters are applied).
4. `app/[locale]/(internal)/technician/page.tsx`:
   - Compute `const damagedGridCodes = useMemo(() => calculatePerimeterReadiness(reports).damagedGridCodes, [reports]);` and pass `damagedGridCodes={damagedGridCodes}` to `<PerimeterMap />`.
5. `package.json:10`:
   - Update `"test"` script to run all 7 `tsx` test suites sequentially:
     `"test": "tsx lib/evidence-image.test.ts && tsx lib/date-filter.test.ts && tsx lib/proxy/auth-proxy.test.ts && tsx lib/report-workflow.test.ts && tsx \"app/[locale]/(internal)/technician/_lib/technician.service.test.ts\" && tsx lib/perimeter-readiness.test.ts && tsx lib/perimeter-segments.test.ts"`

- [ ] **Step 6: Full verification gate (tests, typecheck, build, untouched-file check)**

Run:
1. `npm test` — Expected: all 7 test suites PASS.
2. `npx tsc --noEmit` — Expected: Exit 0, zero type errors.
3. `npm run build` — Expected: Next.js production build succeeds cleanly.
4. `git diff --name-only` — Verify `app/[locale]/_lib/report-document.ts` does NOT appear anywhere in modified files.

- [ ] **Step 7: Commit Task 7**

```bash
git add lib/perimeter-segments.ts lib/perimeter-segments.test.ts "app/[locale]/_components/perimeter-map-inner.tsx" "app/[locale]/(internal)/operator/_components/perimeter-map.tsx" "app/[locale]/(internal)/operator/page.tsx" "app/[locale]/(internal)/technician/page.tsx" package.json
git commit -m "feat(map): render translucent red overlay on damaged perimeter segments and wire full test suite"
```
