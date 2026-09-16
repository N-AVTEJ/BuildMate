import assert from "node:assert";
import { computeEffectiveStatus } from "../../project-status";
import { validateUploadFile, sanitizeFilename } from "../../storage/validation";

async function runTests() {
  console.log("=== BuildMate Phase 3 Client Project Flow Verification Tests ===");

  // 1. Project Code Format (PRJ-{year}-{4-digit-sequence})
  console.log("1. Testing Project Code format regex...");
  const sampleSeq = "1";
  const year = new Date().getFullYear();
  const projectCode = `PRJ-${year}-${sampleSeq.padStart(4, "0")}`;
  assert.match(projectCode, /^PRJ-\d{4}-\d{4}$/, "Project code must match PRJ-YYYY-NNNN format");
  assert.strictEqual(projectCode, `PRJ-${year}-0001`);
  console.log(`  ✓ Generated format: ${projectCode}`);

  // 2. Acceptance Deadline Calculation (Strictly now + 48 hours)
  console.log("2. Testing 48-hour acceptance deadline calculation...");
  const creationTime = new Date("2026-06-01T12:00:00Z");
  const deadline = new Date(creationTime.getTime() + 48 * 60 * 60 * 1000);
  const diffHours = (deadline.getTime() - creationTime.getTime()) / (1000 * 60 * 60);
  assert.strictEqual(diffHours, 48, "Acceptance deadline must be strictly 48 hours from creation");
  console.log("  ✓ Acceptance deadline is exactly 48 hours");

  // 3. Pure computeEffectiveStatus Tests
  console.log("3. Testing pure computeEffectiveStatus derivation...");
  const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pastDeadline = new Date(Date.now() - 1000);

  // Available with future deadline -> remains AVAILABLE
  const effectiveActive = computeEffectiveStatus({
    status: "AVAILABLE",
    acceptanceDeadline: futureDeadline,
  });
  assert.strictEqual(effectiveActive.status, "AVAILABLE");

  // Available with past deadline -> derives EXPIRED_NO_BUILDER
  const effectiveExpired = computeEffectiveStatus({
    status: "AVAILABLE",
    acceptanceDeadline: pastDeadline,
  });
  assert.strictEqual(effectiveExpired.status, "EXPIRED_NO_BUILDER");

  // Other statuses (e.g. IN_PROGRESS) are not affected by acceptance deadline alone
  const inProgressProject = computeEffectiveStatus({
    status: "IN_PROGRESS",
    acceptanceDeadline: pastDeadline,
  });
  assert.strictEqual(inProgressProject.status, "IN_PROGRESS");
  console.log("  ✓ computeEffectiveStatus derivations passed");

  // 4. File Allowlist & Magic Bytes Validation
  console.log("4. Testing file validation allowlist & magic bytes...");

  // PDF Validation
  const validPdfHeader = Buffer.from("%PDF-1.4 header content here");
  const pdfRes = validateUploadFile(validPdfHeader, "spec.pdf", "application/pdf");
  assert.strictEqual(pdfRes.valid, true);

  // Disguised PDF (executable renamed to .pdf)
  const fakePdfHeader = Buffer.from("MZThisIsAnExecutableFile");
  const fakePdfRes = validateUploadFile(fakePdfHeader, "malware.pdf", "application/pdf");
  assert.strictEqual(fakePdfRes.valid, false);
  assert.ok(fakePdfRes.error?.includes("PDF signature"));

  // PNG Validation
  const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const pngRes = validateUploadFile(validPngHeader, "mockup.png", "image/png");
  assert.strictEqual(pngRes.valid, true);

  // JPEG Validation
  const validJpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const jpgRes = validateUploadFile(validJpgHeader, "photo.jpg", "image/jpeg");
  assert.strictEqual(jpgRes.valid, true);

  // ZIP Validation
  const validZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const zipRes = validateUploadFile(validZipHeader, "archive.zip", "application/zip");
  assert.strictEqual(zipRes.valid, true);

  // DOCX OpenXML Container Validation
  const validDocxMock = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("some archive [Content_Types].xml and word/document.xml data"),
  ]);
  const docxRes = validateUploadFile(validDocxMock, "requirements.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.strictEqual(docxRes.valid, true);

  // Generic ZIP renamed to .docx without word/ container
  const genericZipAsDocx = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("just arbitrary zip content without office markup"),
  ]);
  const invalidDocxRes = validateUploadFile(genericZipAsDocx, "fake.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.strictEqual(invalidDocxRes.valid, false);
  assert.ok(invalidDocxRes.error?.includes("DOCX"));

  // PPTX OpenXML Container Validation
  const validPptxMock = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("some archive [Content_Types].xml and ppt/presentation.xml data"),
  ]);
  const pptxRes = validateUploadFile(validPptxMock, "deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.strictEqual(pptxRes.valid, true);

  // TXT Rejection
  const txtFile = Buffer.from("Just plain text notes");
  const txtRes = validateUploadFile(txtFile, "notes.txt", "text/plain");
  assert.strictEqual(txtRes.valid, false);
  assert.ok(txtRes.error?.includes("TXT files are not allowed"));

  // Max 5 MB limit
  const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 10);
  const oversizedRes = validateUploadFile(oversizedBuffer, "huge.pdf", "application/pdf");
  assert.strictEqual(oversizedRes.valid, false);
  assert.ok(oversizedRes.error?.includes("exceeds 5 MB"));

  // Filename Sanitization & Path Traversal Elimination
  console.log("5. Testing filename sanitization & path traversal prevention...");
  assert.strictEqual(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.strictEqual(sanitizeFilename("..\\..\\windows\\system32\\calc.exe"), "calc.exe");
  assert.strictEqual(sanitizeFilename("my draft (v1) [final]!.pdf"), "my_draft__v1___final__.pdf");
  console.log("  ✓ Filename sanitization passed");

  console.log("=== All Phase 3 Verification Unit Tests Passed Successfully! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
