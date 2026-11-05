import { canTechnicianTransitionStatus } from "./technician.service";
import { updateTechnicianStatusSchema } from "./technician.schema";

/**
 * Self-contained unit test suite for Technician business logic and schema validation.
 */
export function runTechnicianUnitTests() {
  const transitionAssertions = [
    // Valid transitions
    canTechnicianTransitionStatus("OPEN", "IN_PROGRESS") === true,
    canTechnicianTransitionStatus("OPEN", "RESOLVED") === true,
    canTechnicianTransitionStatus("IN_PROGRESS", "RESOLVED") === true,
    canTechnicianTransitionStatus("RESOLVED", "OPEN") === true,

    // Invalid transitions (Technician cannot close reports or transition to same status)
    canTechnicianTransitionStatus("OPEN", "OPEN" as any) === false,
    canTechnicianTransitionStatus("CLOSED", "IN_PROGRESS") === false,
    canTechnicianTransitionStatus("CLOSED", "OPEN") === false,
    canTechnicianTransitionStatus("CLOSED", "RESOLVED") === false,
  ];

  // Schema validation tests
  const validPayload = {
    reportId: "123e4567-e89b-12d3-a456-426614174000",
    nextStatus: "IN_PROGRESS" as const,
    narrative: "Pagar kawat duri telah dikencangkan kembali.",
    photos: [
      {
        id: "photo-1",
        mimeType: "image/jpeg" as const,
        base64: "dGVzdC1kYXRh",
      },
    ],
  };

  const parsedValid = updateTechnicianStatusSchema.safeParse(validPayload);

  // Missing narrative should fail
  const parsedNoNarrative = updateTechnicianStatusSchema.safeParse({
    ...validPayload,
    narrative: "",
  });

  // Empty photos should fail
  const parsedNoPhotos = updateTechnicianStatusSchema.safeParse({
    ...validPayload,
    photos: [],
  });

  const schemaAssertions = [
    parsedValid.success === true,
    parsedNoNarrative.success === false,
    parsedNoPhotos.success === false,
  ];

  const allPassed =
    transitionAssertions.every(Boolean) && schemaAssertions.every(Boolean);

  return {
    success: allPassed,
    transitionTests: transitionAssertions.length,
    schemaTests: schemaAssertions.length,
  };
}
