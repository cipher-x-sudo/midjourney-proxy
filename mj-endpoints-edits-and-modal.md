# MidJourney API Endpoints: `/mj/submit/edits` and `/mj/submit/modal`

This document explains how both endpoints work, their differences, and when to use each one.

## Overview

Both endpoints are used for image editing operations in MidJourney, but they serve different purposes:

- **`/mj/submit/edits`**: Direct single-step image editing endpoint
- **`/mj/submit/modal`**: Follow-up endpoint for actions requiring additional user input

---

## `/mj/submit/edits` - Direct Image Edit Endpoint

### Purpose
Directly submits an image edit (inpainting) request in a single API call.

### When to Use
- When `action === 'mj.edit.image'`
- For direct image editing without modal confirmation
- Used by the image edit modal (`aiEditImage.vue`)

### Location in Code
**File**: `src/api/mjapi.ts`  
**Line**: 278-279

```typescript
else if( data.action && data.action=='mj.edit.image') { // image edit
   d=  await mjFetch('/mj/submit/edits' , data.data  ); 
}
```

### Request Flow
```
User clicks "Edit Image" button
    ↓
Modal opens (aiEditImage.vue)
    ↓
User draws mask and enters prompt
    ↓
User clicks submit
    ↓
POST /mj/submit/edits with { prompt, maskBase64, image }
    ↓
Image edit executes
    ↓
Result returned
```

### Request Data Structure
```typescript
{
    prompt: string,        // User's edit prompt
    maskBase64: string,    // Base64 encoded mask image
    image: string          // Base64 encoded source image
}
```

### Example Usage
```typescript
// From aiEditImage.vue - messageFun handler
let obj2 = {
    action: 'mj.edit.image',
    version: 1, 
    data: {
        prompt: obj.prompt,
        maskBase64: obj.mask,
        image: pp.img,
    },
}
homeStore.setMyData({act:'draw', actData:obj2});
```

### Response
Returns task result with image edit completion status.

---

## `/mj/submit/modal` - Modal Confirmation Endpoint

### Purpose
Submits additional data after an action that requires user input or confirmation. This is a **two-step process**.

### When to Use
- After calling `/mj/submit/action` when action requires confirmation
- For Custom Zoom operations
- For Inpainting/Vary Region (mask-based editing)
- When error code 21 is returned
- When action description contains 'confirm'

### Location in Code
**File**: `src/api/mjapi.ts`  
**Multiple locations**:

1. **Line 260**: Custom Zoom
2. **Line 267**: Inpainting/Mask
3. **Line 287**: Actions requiring confirmation
4. **Line 306**: Error code 21 handling

### Request Flow Patterns

#### Pattern 1: Custom Zoom
```
User clicks "Custom Zoom" button
    ↓
Modal opens with text input
    ↓
User enters prompt (e.g., "--zoom 1.8")
    ↓
POST /mj/submit/action with { customId, taskId }
    ↓
Response contains result (modal taskId)
    ↓
POST /mj/submit/modal with { taskId, prompt }
    ↓
Action executes
```

**Code Reference** (lines 255-261):
```typescript
else if( data.action && data.action=="CustomZoom") {
    d = await mjFetch('/mj/submit/action' , data.data  );
    if(d.result){
        let bdata= data.maskData;
        bdata.taskId= d.result;
        d= await mjFetch('/mj/submit/modal' , bdata );
    }
}
```

#### Pattern 2: Inpainting/Mask (Vary Region)
```
User clicks "Redraw" or "Vary Region" button
    ↓
Modal opens with canvas for mask drawing
    ↓
User draws mask on image
    ↓
User enters prompt
    ↓
POST /mj/submit/action with { customId, taskId }
    ↓
Response contains result (modal taskId)
    ↓
POST /mj/submit/modal with { taskId, maskBase64, prompt }
    ↓
Action executes on selected region
```

**Code Reference** (lines 262-268):
```typescript
else if( data.action && data.action=='mask') { // inpainting
    d = await mjFetch('/mj/submit/action' , data.data  );
    if(d.result){
        let bdata= data.maskData;
        bdata.taskId= d.result;
        d= await mjFetch('/mj/submit/modal' , bdata );
    }
}
```

#### Pattern 3: Actions Requiring Confirmation
```
User clicks action button (e.g., pan, vary)
    ↓
POST /mj/submit/action with { customId, taskId }
    ↓
Response description contains 'confirm'
    ↓
POST /mj/submit/modal with { taskId, prompt }
    ↓
Action executes
```

**Code Reference** (lines 284-288):
```typescript
else if( data.action && data.action=='changeV2') {
    d= await mjFetch('/mj/submit/action' , data.data  );
    if( d.description && d.description.indexOf('confirm')>-1){
        d= await mjFetch('/mj/submit/modal' , { 
            taskId:d.result, 
            prompt: d.properties.finalPrompt??'' 
        });
    }
}
```

#### Pattern 4: Error Code 21 Handling
```
Any action returns code==21
    ↓
POST /mj/submit/modal with { taskId }
    ↓
Retry action
```

**Code Reference** (lines 305-307):
```typescript
if(d.code==21  ){
    d= await mjFetch('/mj/submit/modal' , { taskId:d.result} );
}
```

### Request Data Structures

**For Custom Zoom**:
```typescript
{
    taskId: string,    // From /mj/submit/action response
    prompt: string     // User's custom zoom prompt
}
```

**For Inpainting**:
```typescript
{
    taskId: string,      // From /mj/submit/action response
    maskBase64: string,  // Base64 encoded mask image
    prompt: string       // Optional prompt for the region
}
```

**For Confirmation**:
```typescript
{
    taskId: string,  // From /mj/submit/action response
    prompt: string   // Final prompt from response properties
}
```

**For Error Handling**:
```typescript
{
    taskId: string   // From previous action response
}
```

---

## Key Differences

| Feature | `/mj/submit/edits` | `/mj/submit/modal` |
|---------|-------------------|-------------------|
| **Steps** | Single step | Two steps (action + modal) |
| **Prerequisite** | None | Requires `/mj/submit/action` first |
| **Use Case** | Direct image editing | Modal-based actions |
| **Data Required** | `{ prompt, maskBase64, image }` | `{ taskId, prompt }` or `{ taskId, maskBase64, prompt }` |
| **When Called** | `action === 'mj.edit.image'` | After action returns modal taskId |
| **Component** | `aiEditImage.vue` | Various (Custom Zoom, Inpaint, etc.) |

---

## Complete Flow Examples

### Example 1: Direct Image Edit (using `/mj/submit/edits`)

```typescript
// User action in aiEditImage.vue
const messageFun = (e: MessageEvent) => {
    const obj = JSON.parse(e.data);
    
    let obj2 = {
        action: 'mj.edit.image',
        version: 1, 
        data: {
            prompt: obj.prompt,
            maskBase64: obj.mask,
            image: pp.img,
        },
    }
    
    homeStore.setMyData({act:'draw', actData:obj2});
}

// In mjapi.ts subTask()
else if( data.action && data.action=='mj.edit.image') {
   d = await mjFetch('/mj/submit/edits' , data.data  ); 
}
```

### Example 2: Custom Zoom (using `/mj/submit/modal`)

```typescript
// User action in mjText.vue
const subCustom = () => {
    let obj = {
        action: 'CustomZoom',
        version: 1, 
        data: {
            customId: chat.value.opt?.buttons[i].customId, 
            taskId: chat.value.mjID
        },
        maskData: {  
            prompt: st.value.customText,
        }
    }
    homeStore.setMyData({act:'draw', actData:obj});
}

// In mjapi.ts subTask()
else if( data.action && data.action=="CustomZoom") {
    d = await mjFetch('/mj/submit/action' , data.data  );
    if(d.result){
        let bdata = data.maskData;
        bdata.taskId = d.result;
        d = await mjFetch('/mj/submit/modal' , bdata );
    }
}
```

### Example 3: Inpainting (using `/mj/submit/modal`)

```typescript
// User action in mjText.vue
const maskOk = (d: any) => {
    let obj = {
        action: 'mask',
        version: 1, 
        data: {
            customId: chat.value.opt?.buttons[i].customId, 
            taskId: chat.value.mjID
        },
        maskData: { 
            maskBase64: d.mask,
            prompt: d.prompt,
        }
    }
    homeStore.setMyData({act:'draw', actData:obj});
}

// In mjapi.ts subTask()
else if( data.action && data.action=='mask') {
    d = await mjFetch('/mj/submit/action' , data.data  );
    if(d.result){
        let bdata = data.maskData;
        bdata.taskId = d.result;
        d = await mjFetch('/mj/submit/modal' , bdata );
    }
}
```

---

## API Routing

Both endpoints are called via `mjFetch()` which:

1. **Prepends MJ_SERVER URL** (from `getUrl()` function in `src/api/mjapi.ts:149-154`)
2. **Sends request** to external MidJourney API server
3. **Proxied through** `/mjapi` route (see `api/mjapi.js`)

```typescript
// From src/api/mjapi.ts
const getUrl = (url: string) => {
    if(url.indexOf('http')==0) return url;
    if(gptServerStore.myData.MJ_SERVER){
        return `${gptServerStore.myData.MJ_SERVER}${url}`;
    }
    // ... fallback logic
}

export const mjFetch = (url: string, data?: any) => {
    // ... makes fetch request to getUrl(url)
}
```

The `api/mjapi.js` file acts as a proxy that forwards requests to the external MJ server configured in `MJ_SERVER`.

---

## Summary

- **`/mj/submit/edits`**: Use for direct image editing without modal workflow
- **`/mj/submit/modal`**: Use as a follow-up after `/mj/submit/action` when additional user input is required
- Both endpoints are present in the codebase and route to external MidJourney API server
- The choice between them depends on the action type and whether modal confirmation is needed

