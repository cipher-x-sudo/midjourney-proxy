# Postman Endpoints Quick Reference

## Base URL
- **Local**: `http://localhost:8080/mj`
- **Health Check**: `http://localhost:8080/health` (no `/mj` prefix)

## Authentication
- **Header**: `mj-api-secret` (if configured)
- **Header**: `Content-Type: application/json` (for POST requests)

---

## GET Endpoints

### 1. Health Check (No Auth Required)
```
GET http://localhost:8080/health
```
**Headers:** None required

**Response:**
```json
{
  "status": "ok"
}
```

---

### 2. Fetch Task by ID
```
GET http://localhost:8080/mj/task/{taskId}/fetch
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Example:**
```
GET http://localhost:8080/mj/task/8498455807619990/fetch
```

**Response:**
```json
{
  "id": "8498455807619990",
  "action": "IMAGINE",
  "status": "SUCCESS",
  "prompt": "a beautiful sunset over mountains",
  "promptEn": "a beautiful sunset over mountains",
  "description": "/imagine a beautiful sunset over mountains",
  "submitTime": 1689231405854,
  "startTime": 1689231442755,
  "finishTime": 1689231544312,
  "progress": "100%",
  "imageUrl": "https://cdn.discordapp.com/attachments/xxx/xxx/xxxx.png",
  "properties": {
    "finalPrompt": "a beautiful sunset over mountains --ar 16:9",
    "discordInstanceId": "1118138338562560102"
  }
}
```

---

### 3. Get Task Queue
```
GET http://localhost:8080/mj/task/queue
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Response:**
```json
{
  "code": 1,
  "description": "成功",
  "result": [
    {
      "id": "8498455807619990",
      "action": "IMAGINE",
      "status": "IN_PROGRESS",
      "prompt": "a cat",
      ...
    }
  ]
}
```

---

### 4. List Tasks
```
GET http://localhost:8080/mj/task/list
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Query Parameters (Optional):**
- `ids`: Comma-separated task IDs
- `status`: Filter by status (NOT_START, SUBMITTED, IN_PROGRESS, SUCCESS, FAILURE)
- `action`: Filter by action (IMAGINE, UPSCALE, VARIATION, REROLL, DESCRIBE, BLEND)

**Examples:**
```
GET http://localhost:8080/mj/task/list
GET http://localhost:8080/mj/task/list?ids=8498455807619990,0741798445574458
GET http://localhost:8080/mj/task/list?status=SUCCESS
GET http://localhost:8080/mj/task/list?action=IMAGINE&status=SUCCESS
```

---

### 5. Fetch Account by ID
```
GET http://localhost:8080/mj/account/{accountId}/fetch
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Example:**
```
GET http://localhost:8080/mj/account/1118138338562560102/fetch
```

---

### 6. List Accounts
```
GET http://localhost:8080/mj/account/list
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Response:**
```json
{
  "code": 1,
  "description": "成功",
  "result": [
    {
      "id": "1118138338562560102",
      "enable": true,
      ...
    }
  ]
}
```

---

### 7. Get Account Connection Status (Single Account)
```
GET http://localhost:8080/mj/account/{accountId}/status
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Example:**
```
GET http://localhost:8080/mj/account/1437559475883217048/status
```

**Response:**
```json
{
  "account": {
    "id": "1437559475883217048",
    "guildId": "1437559475199414376",
    "channelId": "1437559475883217048",
    "enable": true,
    ...
  },
  "connection": {
    "connected": true,
    "running": true,
    "sessionId": "ad7e746848627aa95ad6b4eaf3c2b81f",
    "sequence": 123,
    "websocketState": "OPEN",
    "hasSession": true
  },
  "status": "CONNECTED"
}
```

**Status Values:**
- `CONNECTED` - WebSocket connected and running
- `CONNECTING` - WebSocket connecting
- `DISCONNECTED` - WebSocket disconnected
- `DISABLED` - Account is disabled
- `NOT_FOUND` - Account not found
- `OPEN_BUT_NOT_RUNNING` - WebSocket open but not in running state

**Connection Fields:**
- `connected`: `true` if WebSocket is OPEN and running
- `running`: `true` if gateway is in running state
- `sessionId`: Discord session ID (null if not connected)
- `sequence`: Last message sequence number (null if not connected)
- `websocketState`: WebSocket state (OPEN, CONNECTING, CLOSING, CLOSED, NOT_INITIALIZED)
- `hasSession`: `true` if sessionId is set

---

### 8. Get All Accounts Connection Status
```
GET http://localhost:8080/mj/account/status
```
**Headers:**
- `mj-api-secret: your-secret` (if configured)

**Response:**
```json
[
  {
    "accountId": "1437559475883217048",
    "account": {
      "id": "1437559475883217048",
      "guildId": "1437559475199414376",
      "channelId": "1437559475883217048",
      "enable": true,
      ...
    },
    "connection": {
      "connected": true,
      "running": true,
      "sessionId": "ad7e746848627aa95ad6b4eaf3c2b81f",
      "sequence": 123,
      "websocketState": "OPEN",
      "hasSession": true
    },
    "status": "CONNECTED"
  }
]
```

---

## POST Endpoints

### 1. Submit Imagine (Generate Image)
```
POST http://localhost:8080/mj/submit/imagine
```
**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body:**
```json
{
  "prompt": "a beautiful sunset over mountains",
  "base64Array": [],
  "state": "custom-state-123",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body Parameters:**
- `prompt` (required): Text prompt for image generation
- `base64Array` (optional): Array of base64-encoded reference images
- `base64` (optional): Single base64-encoded image
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL for task status updates

**Response (Success):**
```json
{
  "code": 1,
  "description": "成功",
  "result": "8498455807619990",
  "properties": {
    "discordInstanceId": "1118138338562560102"
  }
}
```

**Response (In Queue):**
```json
{
  "code": 22,
  "description": "排队中，前面还有1个任务",
  "result": "0741798445574458",
  "properties": {
    "numberOfQueues": 1,
    "discordInstanceId": "1118138338562560102"
  }
}
```

---

### 2. Submit Change (Upscale/Variation/Reroll)
```
POST http://localhost:8080/mj/submit/change
```
**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body (Upscale):**
```json
{
  "action": "UPSCALE",
  "taskId": "8498455807619990",
  "index": 1,
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body (Variation):**
```json
{
  "action": "VARIATION",
  "taskId": "8498455807619990",
  "index": 2,
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body (Reroll):**
```json
{
  "action": "REROLL",
  "taskId": "8498455807619990",
  "index": 1,
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body Parameters:**
- `action` (required): `UPSCALE`, `VARIATION`, or `REROLL`
- `taskId` (required): Task ID from previous imagine request
- `index` (required): Image index (1-4 for UPSCALE/VARIATION, ignored for REROLL)
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL

---

### 3. Submit Simple Change (Alternative Format)
```
POST http://localhost:8080/mj/submit/simple-change
```
**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body (Upscale U1):**
```json
{
  "content": "8498455807619990 U1",
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body (Upscale U2):**
```json
{
  "content": "8498455807619990 U2"
}
```

**Body (Variation V1):**
```json
{
  "content": "8498455807619990 V1"
}
```

**Body (Reroll R):**
```json
{
  "content": "8498455807619990 R"
}
```

**Body Parameters:**
- `content` (required): Format: `{taskId} {action}`
  - Examples:
    - `"8498455807619990 U1"` - Upscale image 1
    - `"8498455807619990 U2"` - Upscale image 2
    - `"8498455807619990 U3"` - Upscale image 3
    - `"8498455807619990 U4"` - Upscale image 4
    - `"8498455807619990 V1"` - Variation of image 1
    - `"8498455807619990 V2"` - Variation of image 2
    - `"8498455807619990 V3"` - Variation of image 3
    - `"8498455807619990 V4"` - Variation of image 4
    - `"8498455807619990 R"` - Reroll
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL

---

### 4. Submit Describe (Image to Text)
```
POST http://localhost:8080/mj/submit/describe
```
**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body:**
```json
{
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body Parameters:**
- `base64` (required): Base64-encoded image with data URL prefix (`data:image/png;base64,...`)
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL

**Response:**
The task will contain `finalPrompt` in properties when completed, which contains the generated description.

---

### 5. Submit Blend (Blend Images)
```
POST http://localhost:8080/mj/submit/blend
```
**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body:**
```json
{
  "base64Array": [
    "data:image/png;base64,xxx1",
    "data:image/png;base64,xxx2"
  ],
  "dimensions": "SQUARE",
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body Parameters:**
- `base64Array` (required): Array of 2-5 base64-encoded images
- `dimensions` (optional): `PORTRAIT` (2:3), `SQUARE` (1:1), or `LANDSCAPE` (3:2)
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL

---

### 6. List Tasks by Condition
```
POST http://localhost:8080/mj/task/list-by-condition
```
**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body:**
```json
{
  "ids": ["8498455807619990", "0741798445574458"],
  "status": "SUCCESS",
  "action": "IMAGINE"
}
```

**Body Parameters:**
- `ids` (optional): Array of task IDs
- `status` (optional): Filter by status
- `action` (optional): Filter by action

---

## Testing Workflow Example

### Step 1: Health Check
```
GET http://localhost:8080/health
```
Verify server is running.

### Step 2: Submit Imagine
```
POST http://localhost:8080/mj/submit/imagine
Body: {
  "prompt": "a cat wearing a hat"
}
```
Save the `result` (task ID) from the response.

### Step 3: Check Task Status
```
GET http://localhost:8080/mj/task/{taskId}/fetch
```
Poll this endpoint until `status` is `SUCCESS` or `FAILURE`.

### Step 4: Upscale Image
```
POST http://localhost:8080/mj/submit/change
Body: {
  "action": "UPSCALE",
  "taskId": "{taskId from step 2}",
  "index": 1
}
```
Or use simple-change:
```
POST http://localhost:8080/mj/submit/simple-change
Body: {
  "content": "{taskId} U1"
}
```

### Step 5: Check Upscale Status
```
GET http://localhost:8080/mj/task/{upscaleTaskId}/fetch
```

---

## Response Codes

### Submit Response Codes:
- `code: 1` - Success, task submitted
- `code: 21` - Task already exists
- `code: 22` - In queue (waiting)
- `code: 23` - Queue full
- `code: 24` - Banned prompt (contains sensitive words)

### Task Status Values:
- `NOT_START` - Not started
- `SUBMITTED` - Submitted for processing
- `IN_PROGRESS` - Executing
- `SUCCESS` - Success
- `FAILURE` - Failed

---

## Quick Copy-Paste for Postman

### GET Requests:

**Health Check:**
```
GET http://localhost:8080/health
```

**Fetch Task:**
```
GET http://localhost:8080/mj/task/8498455807619990/fetch
```

**Get Queue:**
```
GET http://localhost:8080/mj/task/queue
```

**List Tasks:**
```
GET http://localhost:8080/mj/task/list
```

**List Accounts:**
```
GET http://localhost:8080/mj/account/list
```

**Get Account Status:**
```
GET http://localhost:8080/mj/account/{accountId}/status
```

**Get All Accounts Status:**
```
GET http://localhost:8080/mj/account/status
```

### POST Requests:

**Submit Imagine:**
```
POST http://localhost:8080/mj/submit/imagine
Body: {"prompt": "a beautiful landscape"}
```

**Submit Change (Upscale):**
```
POST http://localhost:8080/mj/submit/change
Body: {"action": "UPSCALE", "taskId": "8498455807619990", "index": 1}
```

**Submit Simple Change:**
```
POST http://localhost:8080/mj/submit/simple-change
Body: {"content": "8498455807619990 U1"}
```

**Submit Describe:**
```
POST http://localhost:8080/mj/submit/describe
Body: {"base64": "data:image/png;base64,xxx"}
```

**Submit Blend:**
```
POST http://localhost:8080/mj/submit/blend
Body: {"base64Array": ["data:image/png;base64,xxx1", "data:image/png;base64,xxx2"]}
```

**List Tasks by Condition:**
```
POST http://localhost:8080/mj/task/list-by-condition
Body: {"ids": ["8498455807619990"], "status": "SUCCESS"}
```

---

## Notes

1. **Replace `{taskId}`** with actual task IDs from responses
2. **Replace `your-secret`** with your actual API secret (if configured)
3. **Replace base64 values** with actual base64-encoded images
4. **Poll task status** every few seconds until completion
5. **Use webhooks** (`notifyHook`) to get automatic status updates
6. **Save task IDs** from responses to use in subsequent requests

