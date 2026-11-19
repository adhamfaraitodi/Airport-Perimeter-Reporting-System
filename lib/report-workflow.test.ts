import assert from "node:assert/strict";
import {
  canRoleTransitionReportStatus,
  canRoleCloseReport,
  getApprovalInfo,
  formatApprovalLabel,
  isReturnedHistoryItem,
} from "./report-workflow";

export function runReportWorkflowTests() {
  // 1. TECHNICIAN transitions
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "OPEN", "IN_PROGRESS"), true);
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "OPEN", "RESOLVED"), false);
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "IN_PROGRESS", "RESOLVED"), false);
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "IN_PROGRESS", "OPEN"), false);
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "RESOLVED", "OPEN"), false);
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "CLOSED", "IN_PROGRESS"), false);
  assert.equal(canRoleTransitionReportStatus("TECHNICIAN", "OPEN", "OPEN"), false);

  // 2. OPERATOR and CHIEF transitions
  for (const role of ["OPERATOR", "CHIEF"] as const) {
    assert.equal(canRoleTransitionReportStatus(role, "IN_PROGRESS", "RESOLVED"), true);
    assert.equal(canRoleTransitionReportStatus(role, "IN_PROGRESS", "OPEN"), true);
    assert.equal(canRoleTransitionReportStatus(role, "OPEN", "IN_PROGRESS"), false);
    assert.equal(canRoleTransitionReportStatus(role, "OPEN", "RESOLVED"), false);
    assert.equal(canRoleTransitionReportStatus(role, "RESOLVED", "OPEN"), false);
    assert.equal(canRoleTransitionReportStatus(role, "CLOSED", "RESOLVED"), false);
    assert.equal(canRoleTransitionReportStatus(role, "IN_PROGRESS", "IN_PROGRESS"), false);
  }

  // 3. REPORTER and undefined: every status transition is false
  const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
  const nextStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
  for (const role of ["REPORTER", undefined] as const) {
    for (const current of statuses) {
      for (const next of nextStatuses) {
        assert.equal(canRoleTransitionReportStatus(role, current, next), false);
      }
    }
  }

  // 4. canRoleCloseReport
  assert.equal(canRoleCloseReport("OPERATOR"), true);
  assert.equal(canRoleCloseReport("CHIEF"), true);
  assert.equal(canRoleCloseReport("OPERATOR", "OPEN"), true);
  assert.equal(canRoleCloseReport("CHIEF", "IN_PROGRESS"), true);
  assert.equal(canRoleCloseReport("OPERATOR", "RESOLVED"), false);
  assert.equal(canRoleCloseReport("CHIEF", "RESOLVED"), false);
  assert.equal(canRoleCloseReport("OPERATOR", "CLOSED"), false);
  assert.equal(canRoleCloseReport("CHIEF", "CLOSED"), false);
  assert.equal(canRoleCloseReport("TECHNICIAN"), false);
  assert.equal(canRoleCloseReport("TECHNICIAN", "OPEN"), false);
  assert.equal(canRoleCloseReport("REPORTER"), false);
  assert.equal(canRoleCloseReport(undefined), false);

  // 5. getApprovalInfo
  const resolvedReport = {
    status: "RESOLVED" as const,
    deletedAt: null,
    history: [
      {
        id: "h1",
        status: "IN_PROGRESS" as const,
        previousStatus: "OPEN" as const,
        narrative: "Fixed once",
        createdAt: "2026-11-18T10:00:00.000Z",
        actorName: "Teknisi A",
        actorRole: "TECHNICIAN" as const,
        images: [],
      },
      {
        id: "h2",
        status: "RESOLVED" as const,
        previousStatus: "IN_PROGRESS" as const,
        narrative: "First resolve",
        createdAt: "2026-11-18T11:00:00.000Z",
        actorName: "Sari",
        actorRole: "CHIEF" as const,
        images: [],
      },
      {
        id: "h3",
        status: "RESOLVED" as const,
        previousStatus: "IN_PROGRESS" as const,
        narrative: "Latest resolve",
        createdAt: "2026-11-19T12:00:00.000Z",
        actorName: "Budi",
        actorRole: "OPERATOR" as const,
        images: [],
      },
    ],
  };

  assert.deepEqual(getApprovalInfo(resolvedReport), {
    actorName: "Budi",
    actorRole: "OPERATOR",
    createdAt: "2026-11-19T12:00:00.000Z",
  });

  // Returns null when report.status !== "RESOLVED"
  assert.equal(
    getApprovalInfo({
      ...resolvedReport,
      status: "IN_PROGRESS",
    }),
    null
  );

  // Returns null when report.deletedAt !== null
  assert.equal(
    getApprovalInfo({
      ...resolvedReport,
      deletedAt: "2026-11-19T13:00:00.000Z",
    }),
    null
  );

  // Returns null when history has no RESOLVED entry
  assert.equal(
    getApprovalInfo({
      status: "RESOLVED",
      deletedAt: null,
      history: [resolvedReport.history[0]],
    }),
    null
  );

  // 6. formatApprovalLabel
  assert.equal(
    formatApprovalLabel({ actorName: "Andi", actorRole: "CHIEF" }, "id"),
    "Disetujui oleh Chief Andi"
  );
  assert.equal(
    formatApprovalLabel({ actorName: "Andi", actorRole: "CHIEF" }, "en"),
    "Approved by Chief Andi"
  );
  assert.equal(
    formatApprovalLabel({ actorName: "Budi", actorRole: "OPERATOR" }, "id"),
    "Disetujui oleh Operator Budi"
  );
  assert.equal(
    formatApprovalLabel({ actorName: "Budi" }, "en"),
    "Approved by Operator Budi"
  );

  // 7. isReturnedHistoryItem
  assert.equal(
    isReturnedHistoryItem({ status: "OPEN", previousStatus: "IN_PROGRESS" }),
    true
  );
  assert.equal(
    isReturnedHistoryItem({ status: "OPEN", previousStatus: "OPEN" }),
    false
  );
  assert.equal(
    isReturnedHistoryItem({ status: "OPEN", previousStatus: undefined }),
    false
  );
  assert.equal(
    isReturnedHistoryItem({ status: "IN_PROGRESS", previousStatus: "OPEN" }),
    false
  );
  assert.equal(
    isReturnedHistoryItem({ status: "RESOLVED", previousStatus: "IN_PROGRESS" }),
    false
  );

  return { success: true };
}

const result = runReportWorkflowTests();
if (!result.success) {
  process.exit(1);
}
console.log("All report-workflow unit tests passed.");
