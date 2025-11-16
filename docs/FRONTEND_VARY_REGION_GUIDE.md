# Frontend Update Guide: Vary (Region) / Inpaint Feature

This guide explains how to update your frontend to work with the updated backend implementation for the Vary (Region) inpaint feature.

**Purpose:** Provide clear instructions for frontend developers to integrate the Vary (Region) functionality.

**Scope:** Covers API calls, response handling, UI flow, and example implementations.

---

## Overview

The Vary (Region) feature allows users to:
1. Click a "Vary (Region)" button on an image
2. Draw a mask on the image in a modal
3. Enter a prompt for the masked region
4. Submit the mask and prompt to perform inpainting

The backend now follows a specific flow that requires proper handling on the frontend.

---

## Complete Flow

```
1. User clicks "Vary (Region)" button
   ↓
2. POST /mj/submit/action with customId starting with "MJ::Inpaint::"
   ↓
3. Backend returns code 21 (EXISTED) with taskId
   ↓
4. Frontend opens modal/iframe for mask drawing
   ↓
5. User draws mask and enters prompt
   ↓
6. POST /mj/submit/modal with taskId, maskBase64, and prompt
   ↓
7. Backend processes (may take a few seconds)
   ↓
8. Frontend receives success response with new taskId
```

---

## API Endpoints

### 1. Submit Action (Button Click)

**Endpoint:** `POST /mj/submit/action`

**Request Body:**
```typescript
{
  taskId: string;      // Original task ID (the image task)
  customId: string;    // Button customId, e.g., "MJ::Inpaint::1::<hash>::SOLO"
}
```

**Response:**
```typescript
{
  code: number;        // 21 = EXISTED (modal waiting), 1 = SUCCESS, others = error
  description: string; // "Waiting for window confirm" for code 21
  result: string;      // Task ID (use this for modal submission)
  properties?: {
    finalPrompt?: string;
    remix?: boolean;
  }
}
```

**Important:** When `code === 21` (EXISTED), this means the backend is waiting for modal submission. The `result` field contains the task ID you should use for the next step.

---

### 2. Submit Modal (Mask + Prompt)

**Endpoint:** `POST /mj/submit/modal`

**Request Body:**
```typescript
{
  taskId: string;          // Required: Task ID from step 1 response
  prompt?: string;         // Optional: Prompt text for the inpaint
  maskBase64?: string;     // Required: Base64-encoded mask image (data URL format)
  state?: string;          // Optional: Custom state parameter
  notifyHook?: string;     // Optional: Webhook URL for notifications
}
```

**Response:**
```typescript
{
  code: number;        // 1 = SUCCESS, others = error
  description: string; // "Success" or error message
  result: string;      // New task ID for tracking the inpaint job
  properties?: object;
}
```

**Important:** 
- `maskBase64` must be in data URL format: `data:image/png;base64,<base64-data>`
- The backend may take 5-10 seconds to process as it waits for WebSocket events
- Consider showing a loading state during this time

---

## Frontend Implementation

### Step 1: Handle Button Click

When the user clicks the "Vary (Region)" button:

```typescript
async function handleVaryRegionClick(originalTaskId: string, customId: string) {
  try {
    // Call submit action endpoint
    const response = await fetch('/mj/submit/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your auth headers here (API secret, etc.)
        // 'mj-api-secret': 'your-secret'
      },
      body: JSON.stringify({
        taskId: originalTaskId,
        customId: customId
      })
    });

    const result = await response.json();

    // Handle response codes
    if (result.code === 21) {
      // EXISTED - Backend is waiting for modal
      // result.result contains the modal task ID
      const modalTaskId = result.result;
      
      // Open your mask drawing modal
      openMaskDrawingModal(modalTaskId, {
        finalPrompt: result.properties?.finalPrompt || '',
        onComplete: (maskBase64, prompt) => {
          submitModal(modalTaskId, maskBase64, prompt);
        }
      });
      
      return { success: true, modalTaskId };
    } else if (result.code === 1) {
      // SUCCESS (shouldn't happen for inpaint, but handle it)
      return { success: true };
    } else {
      // Error
      throw new Error(result.description || 'Failed to submit action');
    }
  } catch (error) {
    console.error('Error clicking Vary Region button:', error);
    return { success: false, error: error.message };
  }
}
```

---

### Step 2: Create Mask Drawing Modal

Create a modal component where users can:
1. See the original image
2. Draw a mask on the image
3. Enter a prompt
4. Submit the mask and prompt

**Example using HTML5 Canvas:**

```typescript
interface MaskDrawingModalProps {
  taskId: string;
  imageUrl: string;
  finalPrompt?: string;
  onComplete: (maskBase64: string, prompt: string) => void;
  onCancel: () => void;
}

function MaskDrawingModal({ taskId, imageUrl, finalPrompt, onComplete, onCancel }: MaskDrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prompt, setPrompt] = useState(finalPrompt || '');
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    // Load the image onto canvas
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    drawOnCanvas(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    drawOnCanvas(e);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const drawOnCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Draw with white color (adjust based on your needs)
    ctx.fillStyle = 'rgba(255, 255, 255, 255)';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2); // 10px brush size
    ctx.fill();
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to base64 data URL
    const maskBase64 = canvas.toDataURL('image/png');
    
    // Call the completion callback
    onComplete(maskBase64, prompt);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reload the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = imageUrl;
  };

  return (
    <div className="mask-drawing-modal">
      <div className="modal-content">
        <h2>Vary (Region) - Draw Mask</h2>
        
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ border: '1px solid #ccc', cursor: 'crosshair' }}
          />
        </div>

        <div className="controls">
          <button onClick={handleClear}>Clear</button>
          <button onClick={onCancel}>Cancel</button>
        </div>

        <div className="prompt-input">
          <label>Prompt (optional):</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want in the masked region"
          />
        </div>

        <button onClick={handleSubmit} className="submit-button">
          Submit
        </button>
      </div>
    </div>
  );
}
```

---

### Step 3: Submit Modal

When the user submits the mask and prompt:

```typescript
async function submitModal(
  taskId: string,
  maskBase64: string,
  prompt: string
) {
  try {
    // Show loading state
    showLoadingState('Submitting mask and prompt...');

    const response = await fetch('/mj/submit/modal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your auth headers here
        // 'mj-api-secret': 'your-secret'
      },
      body: JSON.stringify({
        taskId: taskId,
        maskBase64: maskBase64, // Already in data URL format
        prompt: prompt || ''
      })
    });

    const result = await response.json();

    if (result.code === 1) {
      // SUCCESS
      const newTaskId = result.result;
      
      // Hide loading state
      hideLoadingState();
      
      // Close modal
      closeMaskDrawingModal();
      
      // Show success message or navigate to task tracking
      showSuccessMessage('Inpaint job submitted successfully!');
      
      // Optionally: Start polling for task status
      startPollingTaskStatus(newTaskId);
      
      return { success: true, taskId: newTaskId };
    } else {
      // Error
      throw new Error(result.description || 'Failed to submit modal');
    }
  } catch (error) {
    console.error('Error submitting modal:', error);
    hideLoadingState();
    showErrorMessage(error.message || 'Failed to submit mask and prompt');
    return { success: false, error: error.message };
  }
}
```

---

## Response Codes

| Code | Name | Description | Action |
|------|------|-------------|--------|
| 1 | SUCCESS | Operation completed successfully | Use `result` as new task ID |
| 21 | EXISTED | Modal waiting (for button click) | Open modal, use `result` as modal task ID |
| 3 | NOT_FOUND | Resource not found | Show error message |
| 4 | VALIDATION_ERROR | Invalid input | Show validation error |
| 9 | FAILURE | System error | Show error message |
| 24 | BANNED_PROMPT | Prompt contains banned words | Show warning, allow user to edit |

---

## Error Handling

### Common Errors and Solutions

**1. Code 21 (EXISTED) when clicking button:**
- **Expected behavior** - This means the backend is waiting for modal submission
- **Action:** Open the mask drawing modal and proceed

**2. Timeout waiting for modal submission:**
- **Cause:** Backend waits up to 5 minutes for WebSocket events
- **Action:** Show appropriate loading message, consider timeout UI after 30 seconds
- **Backend message:** "Timeout: remixModalMessageId and interactionMetadataId not found"

**3. Invalid maskBase64:**
- **Cause:** Mask not in correct format
- **Action:** Ensure mask is in data URL format: `data:image/png;base64,...`
- **Check:** Use `canvas.toDataURL('image/png')` to get correct format

**4. Task not found:**
- **Cause:** Task ID expired or invalid
- **Action:** Show error, allow user to start over

---

## Example: Complete Integration

Here's a complete React example:

```typescript
import React, { useState } from 'react';

interface VaryRegionButtonProps {
  taskId: string;
  customId: string;
  imageUrl: string;
  onSuccess?: (newTaskId: string) => void;
}

export function VaryRegionButton({ taskId, customId, imageUrl, onSuccess }: VaryRegionButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/mj/submit/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers
        },
        body: JSON.stringify({ taskId, customId })
      });

      const result = await response.json();

      if (result.code === 21) {
        // EXISTED - Open modal
        setModalTaskId(result.result);
        setShowModal(true);
      } else if (result.code === 1) {
        // Direct success (unlikely for inpaint)
        onSuccess?.(result.result);
      } else {
        setError(result.description || 'Failed to submit action');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalSubmit = async (maskBase64: string, prompt: string) => {
    if (!modalTaskId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/mj/submit/modal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers
        },
        body: JSON.stringify({
          taskId: modalTaskId,
          maskBase64,
          prompt
        })
      });

      const result = await response.json();

      if (result.code === 1) {
        setShowModal(false);
        onSuccess?.(result.result);
      } else {
        setError(result.description || 'Failed to submit modal');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        title="Vary (Region)"
      >
        🖌️ Vary (Region)
      </button>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {showModal && modalTaskId && (
        <MaskDrawingModal
          taskId={modalTaskId}
          imageUrl={imageUrl}
          onComplete={handleModalSubmit}
          onCancel={() => {
            setShowModal(false);
            setModalTaskId(null);
          }}
        />
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div>Processing...</div>
        </div>
      )}
    </>
  );
}
```

---

## Testing

### Manual Testing Checklist

1. ✅ Click "Vary (Region)" button → Should return code 21 with taskId
2. ✅ Modal opens → User can draw mask
3. ✅ Submit mask and prompt → Should return code 1 with new taskId
4. ✅ Error handling → Invalid inputs show appropriate errors
5. ✅ Loading states → UI shows loading during API calls
6. ✅ Timeout handling → Long waits show appropriate messages

### cURL Testing

**Test Button Click:**
```bash
curl -X POST "http://localhost:8080/mj/submit/action" \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "taskId": "original-task-id",
    "customId": "MJ::Inpaint::1::<hash>::SOLO"
  }'
```

**Test Modal Submit:**
```bash
curl -X POST "http://localhost:8080/mj/submit/modal" \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{
    "taskId": "modal-task-id-from-step-1",
    "prompt": "make it blue",
    "maskBase64": "data:image/png;base64,iVBORw0KGgoAAAANS..."
  }'
```

---

## Best Practices

1. **Mask Format:**
   - Always use `canvas.toDataURL('image/png')` to get proper format
   - Ensure mask has visible content (not transparent)
   - Consider validating mask size before submission

2. **Loading States:**
   - Show loading during button click (step 1)
   - Show loading during modal submission (step 2)
   - Modal submission may take 5-10 seconds, show appropriate message

3. **Error Handling:**
   - Always check response `code` field
   - Display user-friendly error messages
   - Allow retry on failure

4. **User Experience:**
   - Provide clear instructions in the modal
   - Allow users to clear/reset the mask
   - Show preview of mask before submission
   - Consider mask brush size options

5. **Performance:**
   - Compress large images before converting to base64
   - Consider image size limits (backend may have limits)
   - Cache image URLs to avoid re-downloading

---

## Troubleshooting

### Issue: Modal never opens after button click

**Solution:** Check if response code is 21 and use `result.result` as modal task ID.

### Issue: "Task not found" error

**Solution:** Ensure you're using the task ID from the button click response, not the original task ID.

### Issue: Mask appears blank

**Solution:** 
- Check canvas drawing code
- Ensure white/opaque color is used for mask drawing
- Verify mask is converted to base64 correctly

### Issue: Request times out

**Solution:**
- Backend waits up to 5 minutes for WebSocket events
- Consider increasing frontend timeout
- Show appropriate "processing" message to user

---

## Additional Resources

- Backend API Documentation: `docs/API_EDITS_AND_MODAL.md`
- Backend Vary Region Docs: `docs/vary-region.md`
- Backend Endpoint: `/mj/submit/modal` and `/mj/submit/action`

---

**Last Updated:** Based on backend implementation as of latest update
**Version:** 1.0

