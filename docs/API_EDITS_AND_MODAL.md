# API Documentation: `/mj/submit/edits` and `/mj/submit/modal`

This document describes the implementation and usage of both image editing endpoints in the MidJourney Proxy.

---

## Overview

Both endpoints are used for image editing operations in MidJourney, but they serve different purposes:

- **`/mj/submit/edits`**: Direct single-step image editing endpoint
- **`/mj/submit/modal`**: Follow-up endpoint for actions requiring additional user input (two-step process)

---

## `/mj/submit/edits` - Direct Image Edit Endpoint

### Purpose
Directly submits an image edit (inpainting) request in a single API call. This endpoint handles the complete flow internally.

### Endpoint
```
POST /mj/submit/edits
```

### Authentication
Requires authentication via `authMiddleware` (API secret or session token).

### Request Body

```typescript
{
  prompt: string,           // Required: Edit prompt describing the desired changes
  maskBase64: string,       // Required: Base64-encoded mask image (data URL format)
  image: string,            // Required: Base64-encoded source image (data URL format)
  state?: string,           // Optional: Custom state parameter
  notifyHook?: string       // Optional: Webhook URL for task completion notifications
}
```

### Request Data Structure

**Required Fields:**
- `prompt`: The text prompt describing what changes to make to the image
- `maskBase64`: Base64-encoded mask image indicating which regions to edit
  - Format: `data:image/png;base64,<base64_data>` or `data:image/jpeg;base64,<base64_data>`
- `image`: Base64-encoded source image to be edited
  - Format: `data:image/jpeg;base64,<base64_data>` or `data:image/png;base64,<base64_data>`

**Optional Fields (from BaseSubmitDTO):**
- `state`: Custom state string for tracking
- `notifyHook`: Webhook URL to receive task completion notifications (overrides global notifyHook)

### Example Request

```json
{
  "prompt": "off light",
  "maskBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..."
}
```

### Implementation Flow

1. **Validation**: Validates that `prompt`, `maskBase64`, and `image` are provided and non-empty
2. **Translation**: Translates the prompt to English if it contains Chinese characters (based on config)
3. **Banned Word Check**: Checks if the prompt contains banned words
4. **Image Processing**:
   - Parses the source image from base64 data URL
   - Parses the mask image from base64 data URL
5. **Upload**:
   - Uploads the source image to Discord
   - Uploads the mask image to Discord
   - Sends the source image as a Discord message
6. **Imagine Command**: Uses the `/imagine` command with the uploaded image and prompt to generate a grid
7. **Storage**: Stores the mask and prompt in task properties for later use by WebSocket handlers
8. **Completion**: The WebSocket handlers will automatically:
   - Wait for the grid message
   - Extract the inpaint button `custom_id`
   - Click the button (opens modal)
   - Submit the modal with mask and prompt

### Response

Returns a `SubmitResultVO` object:

```typescript
{
  code: number,           // Return code (0 = success)
  description: string,    // Description message
  result: string,         // Task ID
  properties?: {          // Additional properties
    promptEn?: string,    // Translated prompt
    bannedWord?: string   // Banned word if detected
  }
}
```

### Error Responses

- **400 (VALIDATION_ERROR)**: Missing or empty `prompt`, `maskBase64`, or `image`
- **400 (VALIDATION_ERROR)**: Invalid base64 format in image data
- **403 (BANNED_PROMPT)**: Prompt contains banned words
- **404 (NOT_FOUND)**: No available Discord account instance

### Code Location

- **Controller**: `src/controllers/submitController.ts` - `edits()` method (line 306)
- **DTO**: `src/dto/SubmitEditsDTO.ts`
- **Service**: `src/services/taskService.ts` - `submitEdits()` method (line 216)
- **Route**: `src/app.ts` - line 164

### Notes

- The endpoint uses `TaskAction.VARIATION` internally
- The mask and prompt are stored in task properties (`edits_mask_base64`, `edits_prompt`, `edits_mask_filename`)
- The full automation requires WebSocket message handlers to complete the inpaint flow
- The image and mask are uploaded separately to Discord before processing

---

## `/mj/submit/modal` - Modal Confirmation Endpoint

### Purpose
Submits additional data after an action that requires user input or confirmation. This is a **two-step process** that must be called after `/mj/submit/action`.

### Endpoint
```
POST /mj/submit/modal
```

### Authentication
Requires authentication via `authMiddleware` (API secret or session token).

### Request Body

```typescript
{
  taskId: string,          // Required: Task ID from previous /submit/action response
  prompt?: string,         // Optional: Prompt text (for Custom Zoom, confirmation, etc.)
  maskBase64?: string,    // Optional: Base64-encoded mask (for Inpainting/Vary Region)
  state?: string,          // Optional: Custom state parameter
  notifyHook?: string      // Optional: Webhook URL for task completion notifications
}
```

### Request Data Structure

**Required Fields:**
- `taskId`: The task ID returned from a previous `/mj/submit/action` call that requires modal confirmation

**Optional Fields:**
- `prompt`: Text prompt (used for Custom Zoom, confirmation prompts, etc.)
- `maskBase64`: Base64-encoded mask image (used for Inpainting/Vary Region operations)
  - Format: `data:image/png;base64,<base64_data>`
- `state`: Custom state string for tracking
- `notifyHook`: Webhook URL to receive task completion notifications

### Use Cases

#### 1. Custom Zoom
```json
{
  "taskId": "1234567890",
  "prompt": "--zoom 1.8"
}
```

#### 2. Inpainting/Vary Region
```json
{
  "taskId": "1234567890",
  "maskBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "prompt": "make it blue"
}
```

#### 3. Actions Requiring Confirmation
```json
{
  "taskId": "1234567890",
  "prompt": "final prompt text"
}
```

#### 4. Error Code 21 Retry
```json
{
  "taskId": "1234567890"
}
```

### Implementation Flow

1. **Validation**: Validates that `taskId` is provided
2. **Task Lookup**: Retrieves the original task from the task store
3. **Validation**: 
   - Checks that the original task exists
   - Verifies the original task status is `SUCCESS`
4. **Task Creation**: Creates a new task inheriting properties from the original task
5. **Modal Submit**: Calls Discord's `modalSubmit` API with:
   - The modal `taskId`
   - Optional `prompt`
   - Optional `maskBase64`

### Response

Returns a `SubmitResultVO` object:

```typescript
{
  code: number,           // Return code (0 = success)
  description: string,    // Description message
  result: string,         // New task ID
  properties?: object     // Additional properties
}
```

### Error Responses

- **400 (VALIDATION_ERROR)**: Missing or empty `taskId`
- **404 (NOT_FOUND)**: Related task does not exist or has expired
- **400 (VALIDATION_ERROR)**: Related task status is not `SUCCESS`
- **404 (NOT_FOUND)**: Discord account instance unavailable

### Code Location

- **Controller**: `src/controllers/submitController.ts` - `modal()` method (line 278)
- **DTO**: `src/dto/SubmitModalDTO.ts`
- **Service**: `src/services/taskService.ts` - `submitModal()` method (line 202)
- **Route**: `src/app.ts` - line 127
- **Discord Service**: `src/services/discordService.ts` - `modalSubmit()` method (line 234)
- **Template**: `src/resources/api-params/modal-submit.json`

### Notes

- This endpoint requires a previous `/mj/submit/action` call that returns a modal `taskId`
- The new task inherits properties from the original task (prompt, final prompt, message ID, etc.)
- Uses `TaskAction.VARIATION` internally
- The modal submission uses Discord interaction type 5 (modal submission)

---

## Key Differences

| Feature | `/mj/submit/edits` | `/mj/submit/modal` |
|---------|-------------------|-------------------|
| **Steps** | Single step | Two steps (action + modal) |
| **Prerequisite** | None | Requires `/mj/submit/action` first |
| **Use Case** | Direct image editing | Modal-based actions |
| **Data Required** | `{ prompt, maskBase64, image }` | `{ taskId, prompt? }` or `{ taskId, maskBase64?, prompt? }` |
| **Image Upload** | Handles image upload internally | Uses existing task/image |
| **Automation** | Fully automated (with WebSocket handlers) | Manual two-step process |
| **Task Action** | `VARIATION` | `VARIATION` |

---

## Complete Flow Examples

### Example 1: Direct Image Edit (using `/mj/submit/edits`)

```bash
curl -X POST http://localhost:8080/mj/submit/edits \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "prompt": "turn off the lights",
    "maskBase64": "data:image/png;base64,iVBORw0KGgo...",
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

**Response:**
```json
{
  "code": 1,
  "description": "Success",
  "result": "1234567890123"
}
```

### Example 2: Custom Zoom (using `/mj/submit/modal`)

**Step 1: Submit Action**
```bash
curl -X POST http://localhost:8080/mj/submit/action \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "taskId": "original-task-id",
    "customId": "MJ::CustomZoom::<hash>"
  }'
```

**Response:**
```json
{
  "code": 1,
  "description": "Success",
  "result": "modal-task-id-12345"
}
```

**Step 2: Submit Modal**
```bash
curl -X POST http://localhost:8080/mj/submit/modal \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "taskId": "modal-task-id-12345",
    "prompt": "--zoom 1.8"
  }'
```

### Example 3: Inpainting (using `/mj/submit/modal`)

**Step 1: Submit Action (Vary Region button)**
```bash
curl -X POST http://localhost:8080/mj/submit/action \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "taskId": "original-task-id",
    "customId": "MJ::Inpaint::1::<hash>::SOLO"
  }'
```

**Response:**
```json
{
  "code": 1,
  "description": "Success",
  "result": "modal-task-id-67890"
}
```

**Step 2: Submit Modal with Mask**
```bash
curl -X POST http://localhost:8080/mj/submit/modal \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "taskId": "modal-task-id-67890",
    "maskBase64": "data:image/png;base64,iVBORw0KGgo...",
    "prompt": "make it blue"
  }'
```

---

## Implementation Details

### Task Properties Used

**For `/mj/submit/edits`:**
- `edits_mask_base64`: Stores the mask base64 data
- `edits_prompt`: Stores the prompt for the edit
- `edits_mask_filename`: Stores the uploaded mask filename

**For `/mj/submit/modal`:**
- Inherits properties from the original task:
  - `TASK_PROPERTY_FINAL_PROMPT`
  - `TASK_PROPERTY_PROGRESS_MESSAGE_ID`
  - `TASK_PROPERTY_DISCORD_INSTANCE_ID`

### Discord API Interactions

**`/mj/submit/edits`:**
- Uses `/imagine` command with image URL
- Stores data for WebSocket handlers to complete the flow
- WebSocket handlers will use button interactions and modal submissions

**`/mj/submit/modal`:**
- Uses Discord interaction type 5 (modal submission)
- Template: `src/resources/api-params/modal-submit.json`
- Sends data directly to Discord's modal submit endpoint

---

## Error Handling

Both endpoints follow the standard error handling pattern:

- **Validation errors** return `VALIDATION_ERROR` (400)
- **Not found errors** return `NOT_FOUND` (404)
- **Banned prompts** return `BANNED_PROMPT` (403) with additional properties
- **System errors** return `FAILURE` (500)

All errors include a descriptive message in the `description` field.

---

## Notes for Developers

1. **WebSocket Integration**: The `/mj/submit/edits` endpoint requires WebSocket message handlers to complete the full automation flow. The handlers should:
   - Detect grid messages from edits tasks
   - Extract inpaint button `custom_id`
   - Automatically click the button
   - Submit the modal with stored mask and prompt

2. **Image Format**: Both endpoints accept base64-encoded images in data URL format. Supported formats include JPEG and PNG.

3. **Prompt Translation**: The `/mj/submit/edits` endpoint automatically translates Chinese prompts to English if translation is enabled in the configuration.

4. **Task Inheritance**: The `/mj/submit/modal` endpoint creates a new task that inherits properties from the original task, ensuring continuity in the workflow.

