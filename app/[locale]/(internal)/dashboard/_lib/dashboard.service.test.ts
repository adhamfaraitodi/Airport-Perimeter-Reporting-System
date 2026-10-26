import { canTransitionStatus } from "./dashboard.service";

export function testStatusTransitions() {
  const assertions = [
    canTransitionStatus("OPEN", "IN_PROGRESS") === true,
    canTransitionStatus("OPEN", "RESOLVED") === true,
    canTransitionStatus("IN_PROGRESS", "RESOLVED") === true,
    canTransitionStatus("RESOLVED", "OPEN") === true,
    canTransitionStatus("CLOSED", "OPEN") === false,
  ];
  return assertions.every(Boolean);
}
