# Supports partial redraw: Vary (Region) 🖌

This document describes the "Vary (Region)" feature (partial redraw / inpaint), how it appears in the UI, the client/server flow, payload formats, relevant code locations, testing examples, and troubleshooting tips.

**Purpose:** Provide a clear reference for developers and integrators who want to understand, test, or extend the partial redraw (inpaint) capability.

**Scope:** Covers the UI button, modal flow, mask capture, API endpoints, server-side handling and forwarding to the external inpaint service.

---

## Overview

- **What it does:** Vary (Region) allows users to draw a mask on an existing image and request a partial redraw (inpaint) for the masked region using Midjourney's inpainting backend.

- **Where it appears:** As a button labeled `Vary (Region)` with an emoji 🖌️ in the image action components. The button is only added for supported model versions (>= 5).

---

## UI / Frontend Behavior

- **Button creation:** The UI buttons are created by `CustomComponentModel.CreateVaryButtons(...)` which conditionally includes the Region button via `CreateVaryRegionButton(...)` when the model version is >= 5.

  - File: `src/Midjourney.Base/Models/CustomComponentModel.cs`

  - Button CustomId: `MJ::Inpaint::1::{id}::SOLO`

  - Label: `Vary (Region)` — Emoji: `🖌️`

- **What happens on click:** The application opens a drawing modal/iframe where the user can paint a mask over the image. The frontend captures the mask from a canvas element and encodes it as a PNG data URL: `data:image/png;base64,...`.

- **Payload posted by the frontend:** the modal POST sends JSON with at least:

  ```json
  {
    "taskId": "<task-id>",
    "prompt": "<prompt text>",
    "maskBase64": "data:image/png;base64,<base64-data>"
  }
  ```

  The frontend code that prepares this payload lives in the build output at `src/Midjourney.API/wwwroot/p__Draw__index.d1c06773.async.js` and associated frontend source.

---

## API: Server Endpoints & DTOs

- **Modal submit endpoint:** `POST /api/submit/modal` (controller: `SubmitController.Modal`)

  - DTO: `Midjourney.Base.Dto.SubmitModalDTO`

  - Fields: `Prompt`, `TaskId`, `MaskBase64` (base64 data URL)

  - File: `src/Midjourney.Base/Dto/SubmitModalDTO.cs`

- **Action routing:** When a user clicks the `Vary (Region)` button, the `CustomId` beginning with `MJ::Inpaint::` sets the server-side `task.Action = TaskAction.INPAINT` in `SubmitController`.

  - File: `src/Midjourney.API/Controllers/SubmitController.cs`

---

## Server-side Flow

- **Modal/iframe handling:** In `TaskService.SubmitAction(...)`, actions with CustomId starting with `MJ::Inpaint::` are treated as modal operations. The server sets the task status to `MODAL`, clears the prompt fields on the task, records message/flag properties, and returns a response telling the frontend to open the drawing modal.

  - File: `src/Midjourney.Infrastructure/Services/TaskService.cs`

  - Behavior: sets `task.Status = TaskStatus.MODAL` and saves `Constants.TASK_PROPERTY_MESSAGE_ID`, `Constants.TASK_PROPERTY_FLAGS`, etc.

- **Modal submission:** After the user draws the mask and submits the modal, the server receives the JSON described above. `TaskService` later detects the final custom id for modal completion and handles it.

  - If the final `customId` is of type `MJ::Inpaint::...`, `TaskService` calls `DiscordInstance.InpaintAsync(...)`.

  - Relevant checks and invocation points are in:

    - `src/Midjourney.Infrastructure/Services/TaskService.cs` (modal handling and dispatch to inpaint)

    - Example lines: the code waits for `task.RemixModalMessageId` and `task.InteractionMetadataId`, then invokes inpaint when ready.

---

## Inpaint Request (External Service)

- **Method:** `DiscordInstance.InpaintAsync(TaskInfo info, string customId, string prompt, string maskBase64)`

  - File: `src/Midjourney.Infrastructure/Services/DiscordInstance.cs`

  - Steps performed:

    - Calls `GetPrompt(...)` to resolve prompt content.

    - Strips the `data:image/png;base64,` prefix from `maskBase64` (if present).

    - Constructs a JSON object:

      ```json
      {
        "customId": "<customId>",
        "mask": "<base64 without prefix>",
        "prompt": "<resolved prompt>",
        "userId": "0",
        "username": "0"
      }
      ```

    - POSTs the JSON to `https://936929561302675456.discordsays.com/inpaint/api/submit-job`.

    - Checks for HTTP 200 OK and returns success; otherwise returns a failure message.

---

## Example: cURL test

- Minimal example showing how to emulate a modal submission to the API (replace base64 with a real small PNG base64 string and include any required auth/headers):

```bash
curl -X POST "http://localhost:5000/api/submit/modal" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId":"da2b1fda-0455-4952-9f0e-d4cb891f8b1e",
    "prompt":"A fantasy portrait, cinematic lighting",
    "maskBase64":"data:image/png;base64,iVBORw0KGgoAAAANS..."
  }'
```

If the server accepts the modal it will respond with code `21` (EXISTED) and the frontend will then proceed to call the backend to complete the inpaint job.

**Direct inpaint endpoint (external):**

- The repo forwards the inpaint payload to `https://936929561302675456.discordsays.com/inpaint/api/submit-job`. This is an external service used by the project to perform the actual inpainting work.

---

## Frontend snippet (mask capture)

- The UI captures a mask from an HTML canvas and converts to a PNG data URL. A simplified example of how that is done:

```javascript
// canvas is an HTMLCanvasElement used for drawing the mask
const dataUrl = canvas.toDataURL('image/png');
const payload = {
  taskId: taskId,
  prompt: promptText,
  maskBase64: dataUrl
};

fetch('/api/submit/modal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

The real frontend implementation is present in the built JS assets under `src/Midjourney.API/wwwroot/` (search for `maskBase64` in the distributed bundle).

---

## Validation & Recommended Enhancements

- **Server-side validation:** Currently, `DiscordInstance.InpaintAsync` strips the `data:` prefix and forwards. Consider adding:

  - Max mask size check (dimensions and file size) to prevent oversized payloads.

  - Validate base64 content decodes to a valid PNG (check header bytes `\u000089PNG`).

  - Check that `maskBase64` is not empty and has substantial non-transparent content to avoid no-op requests.

- **Security:** Sanitize or limit prompt length. Enforce authentication and rate limits on the modal endpoint.

- **Logging:** Log mask size and task id at INFO level; errors returned by the external endpoint should be recorded with request/response for troubleshooting (avoid logging full base64 payloads in production).

---

## Troubleshooting

- **Client sees "Waiting for window confirm":** The server is expecting the modal submission. The frontend should open the drawing iframe/modal and POST `maskBase64` to `/api/submit/modal`.

- **Server returns non-200 for external inpaint:** The inpaint service failed; check the `DiscordInstance.InpaintAsync` logs and the external request payload. Verify `mask` is base64 only (no `data:` prefix) before forwarding.

- **Mask appears blank after inpaint:** Confirm the drawing canvas uses black/white or alpha appropriately; ensure the mask encodes the region correctly (some APIs interpret white as keep/transparent as remove — check external API expectations).

---

## Code References

- `CreateVaryButtons` / `CreateVaryRegionButton` — `src/Midjourney.Base/Models/CustomComponentModel.cs`

- Submit controller actions and routing — `src/Midjourney.API/Controllers/SubmitController.cs`

- Modal DTO — `src/Midjourney.Base/Dto/SubmitModalDTO.cs`

- Modal handling and dispatch — `src/Midjourney.Infrastructure/Services/TaskService.cs`

- Inpaint request / forwarding — `src/Midjourney.Infrastructure/Services/DiscordInstance.cs` (method `InpaintAsync`)

- Frontend mask capture in built JS — `src/Midjourney.API/wwwroot/p__Draw__index.d1c06773.async.js` (search for `maskBase64`)

---

## Contribution / Extension Ideas

- Add server-side mask validation and image type checks.

- Provide a mock/local inpaint handler (configurable) for offline testing.

- Add unit/integration tests that simulate modal submit and verify the external request payload is correct (mock HTTP client).

---

If you want, I can:

- Add a small unit/integration test that covers the modal submission -> InpaintAsync payload creation (mocking the HTTP client).

- Implement server-side validation for `maskBase64` and a safe size limit.

---

Document created by the codebase analysis. For code changes or tests, tell me which option you prefer next.

