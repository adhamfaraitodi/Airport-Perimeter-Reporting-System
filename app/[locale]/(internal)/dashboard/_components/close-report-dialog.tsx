"use client";

import {
  UpdateStatusDialog,
  type SubmissionFormProps,
} from "./update-status-dialog";

export function CloseReportDialog(
  props: Omit<SubmissionFormProps, "action">
) {
  return <UpdateStatusDialog {...props} action="DELETE" />;
}
