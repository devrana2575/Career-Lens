# Phase 23 — Resume Upload Hardening

## Goal
Stop binary/oversized/spoofed files from reaching the resume text analyser,
both at the client and the server.

## What shipped

### Server (`packages/api`)
- `routes/resume.routes.js` `AnalyzeBody` schema now:
  - rejects `text` containing NUL bytes;
  - validates `fileName` (when provided) ends with an allowed extension —
    `.txt`, `.md`, `.text`, `.markdown` — as its last path segment.

### Frontend (`packages/frontend`)
- `pages/dashboard/ResumePage.jsx` `handleFile`:
  - rejects files larger than 2 MB;
  - rejects extensions outside the allowlist (a defensive mirror of the
    server check, since the file input is the only upload path);
  - refuses text containing NUL bytes (binary file heuristic) and surfaces a
    friendly error instead of sending garbage upstream.

## Notes
- Both layers enforce the same allowlist so a user can't bypass client checks
  by curling the API directly.