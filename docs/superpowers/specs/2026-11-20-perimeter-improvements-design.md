# Airport Perimeter Reporting System — 5 Operational Improvements Design

**Date:** 2026-11-20
**Status:** Approved
**Scope:** Repair verification workflow, `CHIEF` limited-operator role, 60-grid perimeter readiness KPI, red perimeter segment overlay on Leaflet map, and Reporter all-reports visibility.

---

## 1. Intent & Why

Airport perimeter security operations require a clear separation between field repair execution, field supervision/verification, and system administration, alongside immediate visual visibility of perimeter fence readiness and prevention of duplicate field reports:

1. **Two-stage repair sign-off:** Technicians should not self-close repairs as `RESOLVED` (*Selesai*). Repairs must be verified in the field by an `OPERATOR` or `CHIEF` (with actual field photo + narrative evidence) before becoming `RESOLVED`, or returned to `OPEN` (*Baru*) if the repair does not meet standards.
2. **Field supervisor access (`CHIEF`):** Field chiefs/supervisors need full operational access to monitor perimeter reports, verify/return repairs, close reports, and download PDF reports — without risking accidental edits to Master Data (User Accounts and Damage Catalog).
3. **Perimeter fence readiness KPI:** Operators and Chiefs need a quick executive metric on the dashboard showing fence readiness percentage across the 60 official perimeter grid blocks, where multiple reports in the same grid block still count as one impacted grid.
4. **Early visual damage indicator on the map:** Any perimeter grid block with active unverified damage (e.g., `M11`) should display a translucent red overlay directly along its perimeter fence line from `latest_perimeter.json`, giving instant spatial awareness on the map.
5. **Prevent duplicate field reports (Reporter visibility):** Field reporters (`REPORTER`) should be able to view all perimeter reports (not only reports they personally submitted) so they can check existing reports before filing a new one.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- Enforce technician transition ceiling at `IN_PROGRESS` (*Ditangani*) on both client UI and server actions (`commitReportSubmissionAction` and `executeTechnicianStatusUpdate`).
- Enable `OPERATOR` and `CHIEF` to **Verify/Approve** (`IN_PROGRESS → RESOLVED`) or **Return** (`IN_PROGRESS → OPEN`) reports, requiring both narrative and ≥1 field photo.
- Display clear verification attribution (e.g., *"Disetujui oleh Operator `<name>`"* / *"Disetujui oleh Chief `<name>`"*) on approved reports and clear return attribution when returned.
- Add `CHIEF` role to PostgreSQL `user_role` enum, Better-Auth/proxy RBAC, login flow, account management UI, header navigation, notifications, and server actions — granting full `/[locale]/operator` dashboard access (including Close Report and PDF Download) while strictly blocking `/[locale]/operator/accounts`, `/[locale]/operator/perimeter-damage`, and all Master Data write/management server actions.
- Keep all active unresolved damage reports (`deletedAt IS NULL AND status IN ('OPEN', 'IN_PROGRESS')`) loaded regardless of age, while keeping the 90-day cutoff for `RESOLVED` and `CLOSED`/soft-deleted reports so the map does not clutter with old green pins.
- Display a Perimeter Fence Readiness block at the top of `/[locale]/operator` (visible to `OPERATOR` and `CHIEF`) calculated against the fixed 60 official perimeter grid blocks.
- Render a translucent red overlay polyline directly over `latest_perimeter.json` along every perimeter grid segment that currently has active damage (`OPEN` or `IN_PROGRESS`).
- Allow `REPORTER` users to view all perimeter reports (list, summary counts, detail view, and attached photos) in `/[locale]/reports` and `/[locale]/reports/[reportId]` while keeping them strictly read-only on existing reports (cannot update status or close reports).

### Non-Goals
- **No changes to PDF generation:** `app/[locale]/_lib/report-document.ts` MUST NOT be modified in any way.
- **No signatures / tanda tangan:** Do not add signature capture, signature rendering, or signature blocks anywhere.
- **No new report status enum values:** Reuse existing `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` in `report_status`.
- **No data migration for legacy reports:** Migration is schema-only (`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CHIEF'`); existing `IN_PROGRESS` / `RESOLVED` rows are left untouched (the operator will prune old data manually).
- **No dynamic CRUD UI for the 60 perimeter grid list:** The 60-grid list is maintained in a dedicated static config module (`app/[locale]/_data/perimeter-grids.ts`) so it is easy to edit manually when needed.
- **No new npm packages:** All features use existing dependencies (`drizzle-orm`, `zod`, `leaflet`, `leaflet-rotate`, `lucide-react`, Tailwind v4).

### Anti-Goals (Failure Conditions)
- A `CHIEF` user being able to reach `/[locale]/operator/accounts` or `/[locale]/operator/perimeter-damage` via direct URL, login `callbackUrl`, or invoking Master Data server actions.
- A `TECHNICIAN` bypassing UI restrictions by calling `commitReportSubmissionAction` or `updateTechnicianStatusAction` directly with `status: "RESOLVED"`.
- A `REPORTER` still seeing only their own reports in `/[locale]/reports` or failing to load photos/details of another reporter's report, OR a `REPORTER` being able to mutate/close another reporter's report.
- Multiple active reports in the same grid block (e.g., 3 reports in `M11`) reducing readiness by more than 1 grid block (must deduplicate per grid).
- South-fence reports falling 1–10 meters across the Row M/N grid line (`N12–N24`) failing to light up the red overlay or failing to map to `M12–M24`.
- Active unrepaired damage older than 90 days disappearing from the readiness KPI or losing its red map overlay.
- Readiness KPI changing when the user clicks a status filter tab or types in the search box on the operator dashboard (KPI must reflect all loaded reports, not the filtered list).
- Any diff touching `app/[locale]/_lib/report-document.ts`.

---

## 3. Global Constraints

- **Untouched file:** `app/[locale]/_lib/report-document.ts` — zero edits allowed.
- **No signatures:** Zero signature UI or signature metadata added for approvals.
- **Fixed readiness denominator:** Always `60` (`PERIMETER_GRID_CODES.length === 60`).
- **90-day retention query rule:** Active unresolved reports (`deleted_at IS NULL AND status IN ('OPEN', 'IN_PROGRESS')`) are always included regardless of `created_at`; `RESOLVED` and `CLOSED`/soft-deleted reports are filtered to `created_at >= now - 90 days`.
- **Mandatory evidence on verification/return:** Both `narrative` (1–2,000 chars) and `photos` (≥1 valid JPG/PNG/WebP image, ≤3 MB client / ≤5 MB base64 server) are mandatory for `IN_PROGRESS → RESOLVED` and `IN_PROGRESS → OPEN`.
- **Bilingual i18n parity:** Update both `lib/i18n/dictionaries/id.ts` and `lib/i18n/dictionaries/en.ts`, plus `app/[locale]/_lib/notification-templates.ts`.
- **Theme support:** All new UI components must use `--rd-*` CSS tokens and work cleanly in both light and dark themes.
- **Migration safety:** Schema-only migration `drizzle/0003_add_chief_role.sql` using `ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'CHIEF';`, registered in `drizzle/meta/_journal.json`.

---

## 4. Approaches Considered & Selected

### 4.1 Limited Operator Role (`CHIEF`)
- **Option A (Selected):** Add `"CHIEF"` to PostgreSQL `user_role` enum (`REPORTER | OPERATOR | CHIEF | TECHNICIAN`).
  - *Why chosen:* Explicit RBAC aligned with existing HMAC role-cookie routing (`lib/proxy/auth-proxy.ts`), server-action checks, and Account Management UI without conflating job title (`position`) with access permissions (notably, `Operator Admin` in `db/seed.ts` has `position: "Supervisor"`).
- **Option B (Rejected):** Keep `role = "OPERATOR"` and restrict Master Data based on `position`.
  - *Tradeoff:* Avoids an enum migration, but breaks existing admin accounts and couples free-form job titles to security boundaries.

### 4.2 Perimeter Grid Mapping & Red Segment Overlay
- **Option A (Selected):** Keep the user's exact 60 perimeter grid blocks as the fixed readiness denominator (`N / 60`), and use nearest-perimeter-block snapping (verified max polygon drift `0.061` cell ≈ 10 m; report snap tolerance `0.25` cell ≈ 45 m) to map `latest_perimeter.json` boundary edges and near-boundary report coordinates (`N11–N25`, `H19–H20`, `I2`) cleanly onto those 60 blocks.
  - *Why chosen:* Mathematical verification against `latest_perimeter.json` showed the southern edge runs at `row = 13.01–13.06` (1–10 m south of the M/N boundary). Nearest-block snapping covers 60/60 blocks with zero gaps while keeping the readiness denominator fixed at 60.
- **Option B (Rejected):** Strict `segmentCode` string match only, expanding the grid list to ~78 cells (`N11–N25`, `H19–H20`, `I2`).
  - *Tradeoff:* Breaks the user's fixed 60-block perimeter model and splits the southern fence across two rows.

### 4.3 Approval Attribution Storage
- **Single Clean Approach (Selected):** Reuse `report_status_history` (`actorId`, joined `user.name` + `user.role`, `previousStatus`, `newStatus`, `narrative`, `createdAt`, attached photos) without adding redundant columns to `reports`.
  - *Why chosen:* Every report query already fetches full `history` joined with `user`. Selecting `schema.user.role` alongside `schema.user.name` on the existing join provides exact attribution (`Disetujui oleh Operator <name>` / `Disetujui oleh Chief <name>`) with zero data drift.

### 4.4 Active Report Retention vs 90-Day Limit
- **Option 1 (Selected):** Widen the SQL filter in `getReportsAction()` and `getTechnicianReports()` so unresolved active reports (`deletedAt IS NULL AND status IN ('OPEN', 'IN_PROGRESS')`) are always returned regardless of age, while `RESOLVED` and `CLOSED`/soft-deleted reports stay limited to the last 90 days (`createdAt >= threeMonthsAgo`).
  - *Why chosen:* Prevents unfixed perimeter damage older than 90 days from silently disappearing from the readiness KPI and map overlay, while preventing the map from filling up with old green `RESOLVED` pins.

---

## 5. Detailed Design

### 5.1 Improvement 1 — Repair Verification Workflow

#### Shared State Machine (`lib/report-workflow.ts`)
Centralize role-based status transition rules in a pure module consumed by server actions, technician service, and client UI:

| Role | Allowed `STATUS` Transitions | Allowed `DELETE` (`CLOSED`) |
|---|---|---|
| `TECHNICIAN` | `OPEN → IN_PROGRESS` only | No |
| `OPERATOR` | `IN_PROGRESS → RESOLVED` (Approve), `IN_PROGRESS → OPEN` (Return) | Yes (any non-deleted, non-`CLOSED` report) |
| `CHIEF` | `IN_PROGRESS → RESOLVED` (Approve), `IN_PROGRESS → OPEN` (Return) | Yes (any non-deleted, non-`CLOSED` report) |
| `REPORTER` | None | No |

- `canRoleTransitionReportStatus(role: UserRole, currentStatus: string, nextStatus: LifecycleStatus): boolean`
  - Returns `false` if `currentStatus === "CLOSED"` or `currentStatus === nextStatus`.
  - Enforces the table above strictly.
- `canRoleCloseReport(role: UserRole): boolean`
  - Returns `role === "OPERATOR" || role === "CHIEF"`.
- Enforce `canRoleTransitionReportStatus` and `canRoleCloseReport` in:
  1. `app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts` (`commitReportSubmissionAction` for `payload.action === "STATUS"` and `payload.action === "DELETE"`).
  2. `app/[locale]/(internal)/technician/_lib/technician.service.ts` (`canTechnicianTransitionStatus` delegates to `canRoleTransitionReportStatus("TECHNICIAN", ...)`).
  3. `app/[locale]/_lib/client-api.ts` (`beginSubmission` validates transitions and close permission using the active `role`).

#### UI Flows
1. **Technician Dashboard (`app/[locale]/(internal)/technician/page.tsx` & `update-status-dialog.tsx`):**
   - When `report.status === "OPEN"`: button enabled (`"Tandai Ditangani"`), opens `UpdateStatusDialog` locked to `fixedStatus = "IN_PROGRESS"` (narrative + ≥1 repair photo required).
   - When `report.status === "IN_PROGRESS"`: button disabled with label `"Menunggu Verifikasi Operator"`.
   - When `report.status === "RESOLVED"` or `report.deletedAt`: button disabled (`"Selesai Diverifikasi"` / `"Laporan Ditutup"`).
   - Summary card for `IN_PROGRESS` reflects `"Menunggu Verifikasi"`.
2. **Operator & Chief Dashboard (`app/[locale]/(internal)/operator/page.tsx`, `report-detail-sheet.tsx`, `update-status-dialog.tsx`):**
   - On `ReportDetailSheet` (when `operator` mode is active and `!report.deletedAt`):
     - If `report.status === "IN_PROGRESS"` and `canVerifyRepair` is true (`OPERATOR` or `CHIEF`): show two explicit verification buttons alongside `"Tutup laporan"`:
       - **Setujui Perbaikan** (primary button) → opens `UpdateStatusDialog` with `action="STATUS"` and `fixedStatus="RESOLVED"`, title `"Verifikasi & Setujui Perbaikan"`, narrative placeholder asking for actual field verification notes, mandatory ≥1 actual field photo.
       - **Kembalikan ke Teknisi** (warning/outline button) → opens `UpdateStatusDialog` with `action="STATUS"` and `fixedStatus="OPEN"`, title `"Kembalikan Laporan ke Teknisi"`, narrative placeholder asking for reasons why the repair does not meet requirements, mandatory ≥1 actual field photo.
     - If `report.status === "OPEN"` or `"RESOLVED"`: only `"Tutup laporan"` (`DELETE`) is shown (no manual status jumping).
   - `UpdateStatusDialog` accepts an optional `fixedStatus?: LifecycleStatus` prop so operator approval (`RESOLVED`), operator return (`OPEN`), and technician handling (`IN_PROGRESS`) open directly in the intended mode without a status dropdown, using draft key `${user.id}:${action}:${fixedStatus || ""}:${report?.id || "new"}` and preserving mandatory narrative + ≥1 photo upload validation.

#### Approval & Return Attribution
- Extend `ReportHistoryItem` in `client-api.ts` with optional `actorRole?: UserRole`.
- Select `actorRole: schema.user.role` in the existing `reportStatusHistory` left join in `operator-reports.actions.ts`, `technician.loader.ts`, and `technician.service.ts`.
- Helpers in `lib/report-workflow.ts`:
  - `getApprovalInfo(report: ReportRecord): ApprovalInfo | null` — when `report.status === "RESOLVED"` and `!report.deletedAt`, finds the latest history entry where `status === "RESOLVED"` and returns `{ actorName: string; actorRole?: UserRole; createdAt: string }`.
  - `formatApprovalLabel(info: Pick<ApprovalInfo, "actorName" | "actorRole">, locale?: string): string` — returns `"Disetujui oleh Chief ${actorName}"` / `"Approved by Chief ${actorName}"` when `actorRole === "CHIEF"`, otherwise `"Disetujui oleh Operator ${actorName}"` / `"Approved by Operator ${actorName}"`.
  - `isReturnedHistoryItem(item: Pick<ReportHistoryItem, "status" | "previousStatus">): boolean` — returns `item.status === "OPEN" && item.previousStatus === "IN_PROGRESS"`.
- Display locations:
  1. **Report Detail Sheet (`report-detail-sheet.tsx`):** Highlighted approval callout under the status badge when `getApprovalInfo(report)` is non-null, plus labeled history items (`formatApprovalLabel(...)` for `RESOLVED`, `"Dikembalikan ke Teknisi"` for returned items).
  2. **Reporter Detail View (`reports/[reportId]/_components/report-detail.tsx`):** Matching approval callout under the status badge and labeled history items.
  3. **Report History Card (`report-history-panel.tsx`):** Subtle compact approval indicator on `RESOLVED` cards (checkmark icon + `formatApprovalLabel(...)`).

#### Notifications
- Update `dispatchReportNotificationAction` and `notification-templates.ts`:
  - Pass `previousStatus` and `narrative` in `STATUS` notification params.
  - When `OPEN → IN_PROGRESS`:
    - `OPERATOR` (received by both `OPERATOR` and `CHIEF`): *"Menunggu Verifikasi · `<part>`"* — technician `<actorName>` has handled the issue; awaiting field verification.
    - `REPORTER`: *"Laporan Anda Ditangani"* — repair submitted by `<actorName>`, awaiting operator verification.
  - When `IN_PROGRESS → RESOLVED` (Approved):
    - `REPORTER`: *"Laporan Anda Selesai & Diverifikasi"* — approved by `<actorName>`.
    - `TECHNICIAN`: *"Perbaikan Disetujui · `<part>`"* — verified and approved by `<actorName>`.
    - `OPERATOR` (received by `OPERATOR` & `CHIEF`): *"Perbaikan Disetujui · `<part>`"* — approved by `<actorName>`.
  - When `IN_PROGRESS → OPEN` (Returned):
    - `TECHNICIAN`: *"Perbaikan Dikembalikan · `<part>`"* — returned by `<actorName>` because repair did not meet requirements (`note`).
    - `REPORTER`: *"Perbaikan Sedang Ditinjau Ulang"* — returned by `<actorName>` for re-repair.
    - `OPERATOR` (received by `OPERATOR` & `CHIEF`): *"Laporan Dikembalikan · `<part>`"* — returned to technician by `<actorName>`.

---

### 5.2 Improvement 2 — `CHIEF` Role (Limited Operator)

#### Database & Auth
- `db/schema.ts`: `userRoleEnum = pgEnum("user_role", ["REPORTER", "OPERATOR", "CHIEF", "TECHNICIAN"])`.
- `drizzle/0003_add_chief_role.sql` (schema-only, no data migration):
  ```sql
  ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'CHIEF';
  ```
  Registered in `drizzle/meta/_journal.json` as `idx: 3`.
- `lib/auth.ts`: `export type UserRole = "REPORTER" | "OPERATOR" | "CHIEF" | "TECHNICIAN";`
- `db/seed.ts`: Add default `CHIEF` seed account (NIP `2233445`, name `"Chief Lapangan"`, role `"CHIEF"`, position `"Chief"`, unit `"Aviation Security (AVSEC)"`).

#### Permission Matrix

| Capability / Route / Action | `OPERATOR` | `CHIEF` | `TECHNICIAN` | `REPORTER` |
|---|---|---|---|---|
| `/[locale]/operator` (Monitor Perimeter) | Yes | Yes | Redirect → `/technician` | Redirect → `/reports` |
| `/[locale]/operator/accounts` | Yes | Redirect → `/operator` | Redirect → `/technician` | Redirect → `/reports` |
| `/[locale]/operator/perimeter-damage` | Yes | Redirect → `/operator` | Redirect → `/technician` | Redirect → `/reports` |
| Verify (`IN_PROGRESS → RESOLVED`) & Return (`IN_PROGRESS → OPEN`) | Yes | Yes | No | No |
| Close report (`DELETE` → `CLOSED`) | Yes | Yes | No | No |
| Download PDF (`report-document.ts` — untouched) | Yes | Yes | Yes | Yes |
| Master Data Actions (`accounts.actions.ts`, `damage-catalog.actions.ts` mutations) | Yes | **Denied** | **Denied** | **Denied** |
| Operator Notifications (`targetRole = 'OPERATOR'` or `'CHIEF'`) | Yes | Yes | No | No |
| Header `Data Master` dropdown (desktop & mobile) | Visible | **Hidden** | Hidden | Hidden |

#### Files Touched for `CHIEF`
- `lib/proxy/auth-proxy.ts`:
  - `isValidRole` includes `"CHIEF"`.
  - `getHomeRouteForRole(locale, "CHIEF")` returns `/${locale}/operator`.
  - RBAC guard on `routeSegment === "operator"`:
    - If `subSegments[0] === "accounts" || subSegments[0] === "perimeter-damage"`: require `role === "OPERATOR"`, otherwise redirect to `getHomeRouteForRole(locale, role)`.
    - Otherwise (`/operator` home): allow `role === "OPERATOR" || role === "CHIEF"`.
- `app/[locale]/(auth)/login/_lib/auth.service.ts`:
  - Resolve `"CHIEF"` in role parsing (not defaulting to `"REPORTER"`).
  - Restrict `callbackUrl` for `CHIEF` so `/operator/accounts` and `/operator/perimeter-damage` redirect to `/${locale}/operator`, while `/operator` is permitted.
- `app/[locale]/_lib/client-api.ts`:
  - Update `UserRole`, `users` map, `getSession()` role resolver (`rawRole === "OPERATOR" || rawRole === "CHIEF" || rawRole === "TECHNICIAN"`).
- `app/[locale]/_components/app-header.tsx`:
  - Separate `isOperatorDashboardRole = user?.role === "OPERATOR" || user?.role === "CHIEF"` (for home route, `Pantau Perimeter` nav item, and notification CTA) from `canAccessMasterData = user?.role === "OPERATOR"` (for desktop & mobile `Data Master` dropdown).
- `app/[locale]/(internal)/operator/page.tsx`: Allow `session.role === "OPERATOR" || session.role === "CHIEF"`.
- `app/[locale]/(internal)/operator/accounts/page.tsx` & `perimeter-damage/page.tsx`: Keep strict `session.role !== "OPERATOR"`, and redirect `CHIEF` to `/${locale}/operator`.
- `app/[locale]/(internal)/technician/page.tsx`: Redirect `CHIEF` (and `OPERATOR`) to `/${locale}/operator`.
- `app/[locale]/(internal)/operator/accounts/_lib/accounts.schema.ts`, `accounts-store.ts`, `operator/accounts/page.tsx`:
  - Support `"CHIEF"` in Zod schema, `roleLabels` (`CHIEF: "Chief Lapangan"`), role filter chips, account creation/edit role dropdown, badge styling, and account stats.
- `app/[locale]/_lib/notifications.actions.ts`:
  - Resolve `"CHIEF"` in `resolveCurrentActor()`.
  - Allow `"CHIEF"` in `dispatchReportNotificationAction` for `STATUS` and `DELETE`.
  - In `getNotificationsAction` and `markAllNotificationsReadAction`, match `inArray(schema.notification.targetRole, ["OPERATOR", "CHIEF"])` when `actor.role === "CHIEF"` so Chiefs receive all operational perimeter notifications without duplicate rows.
- `lib/i18n/dictionaries/id.ts` & `en.ts`: Add `header.roles.CHIEF` (`"Chief Lapangan"` / `"Field Chief"`).

---

### 5.3 Improvement 3 — Perimeter Fence Readiness Percentage Block

#### Report Query Retention Update
- In `app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts` (`getReportsAction`) and `app/[locale]/(internal)/technician/_lib/technician.loader.ts` (`getTechnicianReports`):
  - Replace the unconditional `gte(schema.reports.createdAt, threeMonthsAgo)` filter with:
    ```ts
    or(
      gte(schema.reports.createdAt, threeMonthsAgo),
      and(
        isNull(schema.reports.deletedAt),
        inArray(schema.reports.status, ["OPEN", "IN_PROGRESS"])
      )
    )
    ```
  - In `getTechnicianReports` summary SQL `FILTER` clauses, remove the `createdAt >= threeMonthsAgo` restriction on `open`, `inProgress`, and active `OPEN`/`IN_PROGRESS` contribution to `totalActive`, while keeping `createdAt >= threeMonthsAgo` on `resolved` so badge counters match the loaded report list 1:1.

#### Static Grid Registry (`app/[locale]/_data/perimeter-grids.ts`)
Contains the exact 60 perimeter grid codes provided by the user:
```ts
export const PERIMETER_GRID_CODES = [
  "J2", "J3", "J4", "J5", "J6", "J7",
  "I7", "I8", "I9", "I10", "I11", "I12", "I13", "I14", "I15", "I16",
  "I17", "I18", "I19", "I20", "I21", "I22",
  "J22", "J23", "J24",
  "K24", "K25", "K26", "K27", "K28",
  "L28",
  "M28", "M27", "M26", "M25", "M24", "M23", "M22", "M21", "M20", "M19",
  "M18", "M17", "M16", "M15", "M14", "M13", "M12", "M11", "M10", "M9",
  "M8", "M7", "M6", "M5", "M4", "M3", "M2",
  "L2", "K2",
] as const;

export const PERIMETER_GRID_TOTAL = PERIMETER_GRID_CODES.length; // 60
```

#### Readiness Calculation (`lib/perimeter-readiness.ts`)
- **Active damage reports:** `!report.deletedAt && (report.status === "OPEN" || report.status === "IN_PROGRESS")`.
- **Report-to-perimeter-block resolution (`resolvePerimeterGridCode`):**
  1. Normalize `report.segmentCode?.trim().toUpperCase()`. If present in `PERIMETER_GRID_SET`, return it.
  2. Otherwise, if `Number.isFinite(report.latitude) && Number.isFinite(report.longitude)`, convert `(lat, lng)` to continuous grid coordinates `(colFloat, rowFloat)` via `latLngToGridFloat` (exported from `airport-grid.ts`) and compute Euclidean cell distance to each of the 60 block boxes `[colIndex, colIndex+1] × [rowIndex, rowIndex+1]`. If the nearest block distance is `<= 0.25` cells (~45 m), return that block code.
  3. Otherwise return `null`.
- **Deduplication:** Store resolved codes in a `Set<string>`. Multiple reports in the same block count once.
- **Formula (fixed denominator = 60):**
  - `totalGrids = 60`
  - `damagedGrids = damagedSet.size`
  - `readyGrids = totalGrids - damagedGrids`
  - `readinessPercent = Math.round(((readyGrids / totalGrids) * 100) * 10) / 10` (e.g., `60/60 → 100%`, `58/60 → 96.7%`, `54/60 → 90%`).
  - Also return `damagedGridCodes: string[]` (ordered by `PERIMETER_GRID_CODES` order), `openCount`, `awaitingVerificationCount`, `resolvedCount`.

#### Operator Dashboard Block (`app/[locale]/(internal)/operator/_components/perimeter-readiness-card.tsx`)
- Rendered at the top of `app/[locale]/(internal)/operator/page.tsx` above the map + panel grid, visible to both `OPERATOR` and `CHIEF`.
- Always computed from full `reports` (unfiltered by search/status tab).
- Shows:
  1. **Primary Readiness Block:** Title *"Kesiapan Pagar Perimeter"*, big percentage (e.g., `96,7%`), horizontal progress bar colored by threshold (`≥95%` `--rd-lime`, `80–94.9%` `--rd-brown`, `<80%` `--rd-coral`), and exact fixed-denominator counts: **`58/60 grid siap`** & **`2/60 grid rusak`**.
  2. **Impacted Grid Chips (when `damagedGrids > 0`):** Displays affected grid codes (e.g. `M11`, `I15` — up to 8 chips + `+N lainnya`); clicking a chip fills the dashboard search input with that grid code to jump straight to those reports.
  3. **Compact Status Counters:** `Baru` (`OPEN`), `Menunggu Verifikasi` (`IN_PROGRESS`), `Selesai` (`RESOLVED`).
  4. **Loading state:** Uses existing `Skeleton` component while `loading === true`.
- Desktop map/panel container height in `operator/page.tsx` adjusted from `md:h-[calc(100dvh-280px)]` to `md:h-[calc(100dvh-350px)]` (min-height `520px`) so the page fits cleanly without clipping.

---

### 5.4 Improvement 4 — Transparent Red Overlay on Damaged Perimeter Segments

#### Perimeter Segment Partitioning (`lib/perimeter-segments.ts`)
- Input: polygon ring from `app/[locale]/_data/latest_perimeter.json` (`features[0].geometry.coordinates[0]`, `[lng, lat]`) and `PERIMETER_GRID_CODES` (60 blocks).
- Algorithm (runs once at module initialization; cached):
  1. For each edge `(p1, p2)` of the closed perimeter polygon ring, convert endpoints to continuous grid coords `(c1, r1)` and `(c2, r2)`.
  2. Compute `steps = Math.max(1, Math.ceil(Math.hypot(c2 - c1, r2 - r1) / 0.04))` (micro-step ≤ 0.04 cells ≈ 7–8 m).
  3. For each micro-segment `k = 0 .. steps - 1`, compute its midpoint in grid space and find the nearest block among the 60 `PERIMETER_GRID_CODES` (mathematically verified: 60/60 blocks hit, `maxDist = 0.061` cells).
  4. Group consecutive micro-segments assigned to the same block code into continuous `[lat, lng][]` polylines (stitching the wrap-around seam at vertex 0/N if both belong to the same block).
  5. Store in `Map<string, [number, number][][]>` (`gridCode -> polylines`).
- Export `getPerimeterPolylinesForGrids(gridCodes: Iterable<string>): Array<{ gridCode: string; latLngs: [number, number][] }>`.

#### Leaflet Map Integration (`perimeter-map-inner.tsx`, `perimeter-map.tsx`)
- Add optional prop `damagedGridCodes?: string[]` to `PerimeterMapProps` and `PerimeterMapInnerProps` (propagates automatically through `perimeter-map-view.tsx`).
  - If `damagedGridCodes` is provided (e.g., from `operator/page.tsx` using full `reports`), use it directly.
  - Otherwise, if `reports.length > 0`, derive `calculatePerimeterReadiness(reports).damagedGridCodes` automatically (so Technician dashboard gets the red overlay automatically too).
- In `perimeter-map-inner.tsx`:
  - Create a dedicated `damageOverlayLayer = useRef<L.LayerGroup | null>(null)` added to the Leaflet map right after the base green perimeter polygon and before report pin markers.
  - In a `useEffect` reactive to `damagedGridCodes` / `reports`:
    - `damageOverlayLayer.current.clearLayers()`.
    - For each polyline returned by `getPerimeterPolylinesForGrids(activeDamagedGrids)`:
      - Draw a wide translucent red outer highlight (`color: "#ef4444"`, `weight: 10`, `opacity: 0.38`, `lineCap: "round"`, `lineJoin: "round"`, `interactive: false`) and a crisp translucent red core line (`color: "#dc2626"`, `weight: 4`, `opacity: 0.72`, `lineCap: "round"`, `lineJoin: "round"`, `interactive: false`).
- In `perimeter-map.tsx`:
  - Add a subtle legend entry in the map bottom bar: red translucent swatch + `"Segmen rusak"` (so operators/technicians immediately recognize the red line overlay).

---

### 5.5 Improvement 5 — Reporter All-Reports Visibility (Anti-Double Reporting)

#### Purpose
Allow field reporters (`REPORTER`) to browse, search, filter, and inspect **all perimeter reports** (created by any reporter) from `/[locale]/reports` and `/[locale]/reports/[reportId]`, so field personnel can verify whether a damage point has already been reported before submitting a new report. Reporters remain strictly read-only on existing reports (only `CREATE` is permitted; `STATUS` and `DELETE` remain forbidden).

#### Changes Across Layers
1. **Server query (`app/[locale]/(internal)/operator/_lib/operator-reports.actions.ts`):**
   - Remove the `if (userRole === "REPORTER") conditions.push(eq(schema.reports.reporterId, user.id))` filter in `getReportsAction()`.
   - Reporters receive the same retention-scoped report set as other authenticated roles (all active `OPEN`/`IN_PROGRESS` reports regardless of age + `RESOLVED`/`CLOSED` reports from the last 90 days).
2. **Client API cache & image lookup (`app/[locale]/_lib/client-api.ts`):**
   - Remove the `(r) => role !== "REPORTER" || r.reporterId === users[role].id` filter in `api.listReports()` fallback.
   - Remove the `if (role === "REPORTER" && r.reporterId !== users[role].id) continue;` guard in `api.getImage()` so reporters can view photo evidence on any report.
3. **Reporter Dashboard & List (`app/[locale]/(internal)/reports/page.tsx` & `reports/_components/report-list.tsx`):**
   - Pass all loaded `reports` directly without filtering by `reporterId === user.id`.
   - Update summary card descriptions & subtitle copy from *"laporan Anda"* / *"your reports"* to *"seluruh laporan perimeter"* / *"all perimeter reports"*.
   - Keep `CreateReportDialog` and read-only `ReportDetail` unchanged in permissions (reporters cannot change status or close reports).
4. **Reporter Detail Page & View (`app/[locale]/(internal)/reports/[reportId]/page.tsx` & `_components/report-detail.tsx`):**
   - Update breadcrumb link from `"Laporan Saya"` to `t.reports.title` (*"Laporan Perimeter"* / *"Perimeter Reports"*).
   - Display reporter attribution (`report.reporterName`) in the `ReportDetail` header so reporters immediately see who submitted the existing report.
5. **Bilingual i18n (`lib/i18n/dictionaries/id.ts` & `en.ts`):**
   - Update `header.viewAllMyReports` copy to `"Buka Daftar Laporan Perimeter"` (ID) / `"Open Perimeter Reports List"` (EN).

---

## 6. Decisions Left to the Builder

- Exact Tailwind spacing, icon selection from `lucide-react` (e.g., `ShieldCheck`, `RotateCcw`, `ShieldAlert`), and exact copy polish for toast messages and form placeholders, provided they match existing `--rd-*` tokens and bilingual (`id` / `en`) conventions.
- Exact polyline simplification threshold (if any) in `lib/perimeter-segments.ts`, as long as each of the 60 perimeter blocks renders a visually faithful continuous overlay along `latest_perimeter.json`.
- Test file organization: add focused `tsx` test files (wired into `package.json`'s `npm test` script) covering workflow transitions, `CHIEF` auth-proxy RBAC, readiness calculation (including deduplication, south-edge snapping, and fixed 60 denominator), and 60-block perimeter segment coverage.
