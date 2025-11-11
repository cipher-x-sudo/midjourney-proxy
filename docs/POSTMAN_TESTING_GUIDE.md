# Postman Testing Guide for Midjourney Proxy API

This guide will help you test the Midjourney Proxy API using Postman.

## Prerequisites

1. **Postman installed** - Download from [postman.com](https://www.postman.com/downloads/)
2. **Server running** - Your Midjourney Proxy server should be running (default: `http://localhost:8080`)
3. **API Secret (optional)** - If you've configured `MJ_API_SECRET`, you'll need it for authentication

## Base URL

- **Default**: `http://localhost:8080/mj`
- **Custom**: If you've set a custom `contextPath` in config, use that instead

## Authentication

If you've configured an API secret via `MJ_API_SECRET` environment variable or in `default.yaml`, you need to include it in all requests:

- **Header Name**: `mj-api-secret`
- **Header Value**: Your configured API secret

> **Note**: If no API secret is configured, authentication is disabled and you can skip this step.

## Setting Up Postman

### 1. Create a New Collection

1. Open Postman
2. Click "New" → "Collection"
3. Name it "Midjourney Proxy API"

### 2. Configure Collection Variables (Optional)

1. Click on your collection
2. Go to the "Variables" tab
3. Add these variables:
   - `baseUrl`: `http://localhost:8080/mj`
   - `apiSecret`: `your-api-secret-here` (if configured)

### 3. Set Collection-Level Headers (If Using API Secret)

> **Note**: Newer Postman versions don't have a "Headers" tab at the collection level. Use the methods below.

**Method 1: Using Authorization Tab (For API Secret)**

1. **Open your collection** in Postman (click on the collection name in the left sidebar)

2. **Click on the "Authorization" tab** (you should see it in the tabs: Overview, Variables, Authorization, Scripts, Runs)

3. **Configure API Key authentication:**
   - **Type**: Select `API Key` from the dropdown
   - **Key**: `mj-api-secret`
   - **Value**: `{{apiSecret}}` (use the variable you created in step 2) OR your actual secret value
   - **Add to**: Select `Header` from the dropdown

4. **Save**: This is automatically saved. The `mj-api-secret` header will now be added to all requests.

**Method 2: Using Pre-request Script (For Content-Type Header)**

1. **Click on the "Scripts" tab** (or look for "Pre-request Script" in your Postman version)

2. **In the Pre-request Script section**, add this code:
```javascript
// Set Content-Type header for all requests in this collection
pm.request.headers.add({
    key: 'Content-Type',
    value: 'application/json'
});
```

3. **Save**: The script will automatically run before each request and add the Content-Type header.

**Alternative: Set Headers on Individual Requests**

If you prefer not to use scripts, you can add headers to each request manually:
1. Open any request in the collection
2. Go to the **"Headers"** tab of that request (below the URL bar)
3. Add headers:
   - `mj-api-secret`: `{{apiSecret}}`
   - `Content-Type`: `application/json`

**Visual Guide:**
```
Postman Collection Tabs (Your Version):
[Overview] [Variables] [Authorization] [Scripts] [Runs]
                              ↑              ↑
                    Set API Key here    Add script here

Authorization Tab Setup:
Type: API Key
Key: mj-api-secret
Value: {{apiSecret}}
Add to: Header

Scripts Tab → Pre-request Script:
pm.request.headers.add({
    key: 'Content-Type',
    value: 'application/json'
});
```

## API Endpoints

### 1. Health Check (No Auth Required)

**GET** `/health` or `/mj/health`

**Request:**
- Method: `GET`
- URL: `http://localhost:8080/health`

**Response:**
```json
{
  "status": "ok"
}
```

---

### 2. Submit Imagine (Generate Image)

**POST** `/mj/submit/imagine`

**Request:**
- Method: `POST`
- URL: `http://localhost:8080/mj/submit/imagine`
- Headers:
  - `Content-Type: application/json`
  - `mj-api-secret: your-secret` (if configured)
- Body (JSON):
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
- `base64` (optional): Single base64-encoded image (alternative to base64Array)
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL for task status updates

**Response Examples:**

**Success (code: 1):**
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

**In Queue (code: 22):**
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

**Queue Full (code: 23):**
```json
{
  "code": 23,
  "description": "队列已满，请稍后尝试",
  "result": "14001929738841620",
  "properties": {
    "discordInstanceId": "1118138338562560102"
  }
}
```

---

### 3. Submit Change (Upscale/Variation/Reroll)

**POST** `/mj/submit/change`

**Request:**
- Method: `POST`
- URL: `http://localhost:8080/mj/submit/change`
- Headers:
  - `Content-Type: application/json`
  - `mj-api-secret: your-secret` (if configured)
- Body (JSON):
```json
{
  "action": "UPSCALE",
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

**Action Values:**
- `UPSCALE`: Upscale an image (U1-U4)
- `VARIATION`: Create variation (V1-V4)
- `REROLL`: Reroll the prompt

---

### 4. Submit Simple Change (Alternative Format)

**POST** `/mj/submit/simple-change`

**Request:**
- Method: `POST`
- URL: `http://localhost:8080/mj/submit/simple-change`
- Headers:
  - `Content-Type: application/json`
  - `mj-api-secret: your-secret` (if configured)
- Body (JSON):
```json
{
  "content": "8498455807619990 U2",
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body Parameters:**
- `content` (required): Format: `{taskId} {action}`
  - Examples:
    - `"8498455807619990 U1"` - Upscale image 1
    - `"8498455807619990 U2"` - Upscale image 2
    - `"8498455807619990 V1"` - Variation of image 1
    - `"8498455807619990 R"` - Reroll
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL

**Actions:**
- `U1`, `U2`, `U3`, `U4`: Upscale images 1-4
- `V1`, `V2`, `V3`, `V4`: Variations of images 1-4
- `R`: Reroll

---

### 5. Submit Describe (Image to Text)

**POST** `/mj/submit/describe`

**Request:**
- Method: `POST`
- URL: `http://localhost:8080/mj/submit/describe`
- Headers:
  - `Content-Type: application/json`
  - `mj-api-secret: your-secret` (if configured)
- Body (JSON):
```json
{
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "state": "custom-state",
  "notifyHook": "https://your-webhook.com/notify"
}
```

**Body Parameters:**
- `base64` (required): Base64-encoded image with data URL prefix
- `state` (optional): Custom state parameter
- `notifyHook` (optional): Callback URL

**Response:**
The task will contain `finalPrompt` in properties when completed, which contains the generated description.

---

### 6. Submit Blend (Blend Images)

**POST** `/mj/submit/blend`

**Request:**
- Method: `POST`
- URL: `http://localhost:8080/mj/submit/blend`
- Headers:
  - `Content-Type: application/json`
  - `mj-api-secret: your-secret` (if configured)
- Body (JSON):
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

### 7. Fetch Task

**GET** `/mj/task/:id/fetch`

**Request:**
- Method: `GET`
- URL: `http://localhost:8080/mj/task/8498455807619990/fetch`
- Headers:
  - `mj-api-secret: your-secret` (if configured)

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

**Status Values:**
- `NOT_START`: Not started
- `SUBMITTED`: Submitted for processing
- `IN_PROGRESS`: Executing
- `FAILURE`: Failed
- `SUCCESS`: Success

---

### 8. Get Task Queue

**GET** `/mj/task/queue`

**Request:**
- Method: `GET`
- URL: `http://localhost:8080/mj/task/queue`
- Headers:
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
      ...
    }
  ]
}
```

---

### 9. List Tasks

**GET** `/mj/task/list`

**Request:**
- Method: `GET`
- URL: `http://localhost:8080/mj/task/list`
- Headers:
  - `mj-api-secret: your-secret` (if configured)
- Query Parameters (optional):
  - `ids`: Comma-separated task IDs
  - `status`: Filter by status
  - `action`: Filter by action

**Example:**
```
GET /mj/task/list?ids=8498455807619990,0741798445574458&status=SUCCESS
```

---

### 10. List Tasks by Condition

**POST** `/mj/task/list-by-condition`

**Request:**
- Method: `POST`
- URL: `http://localhost:8080/mj/task/list-by-condition`
- Headers:
  - `Content-Type: application/json`
  - `mj-api-secret: your-secret` (if configured)
- Body (JSON):
```json
{
  "ids": ["8498455807619990", "0741798445574458"],
  "status": "SUCCESS",
  "action": "IMAGINE"
}
```

---

### 11. Fetch Account

**GET** `/mj/account/:id/fetch`

**Request:**
- Method: `GET`
- URL: `http://localhost:8080/mj/account/1118138338562560102/fetch`
- Headers:
  - `mj-api-secret: your-secret` (if configured)

---

### 12. List Accounts

**GET** `/mj/account/list`

**Request:**
- Method: `GET`
- URL: `http://localhost:8080/mj/account/list`
- Headers:
  - `mj-api-secret: your-secret` (if configured)

---

## Postman Collection Setup

### Step-by-Step: Create a Request

1. **Create New Request**
   - Click "New" → "HTTP Request"
   - Name it (e.g., "Submit Imagine")

2. **Set Method and URL**
   - Select `POST` from dropdown
   - Enter URL: `http://localhost:8080/mj/submit/imagine`

3. **Add Headers**
   - Go to "Headers" tab
   - Add `Content-Type: application/json`
   - Add `mj-api-secret: your-secret` (if configured)

4. **Add Body**
   - Go to "Body" tab
   - Select "raw"
   - Select "JSON" from dropdown
   - Paste your JSON body

5. **Send Request**
   - Click "Send"
   - View response in bottom panel

### Example: Complete Workflow

1. **Submit Imagine**
   ```
   POST http://localhost:8080/mj/submit/imagine
   Body: {"prompt": "a cat wearing a hat"}
   Response: {"code": 1, "result": "8498455807619990"}
   ```

2. **Wait for Task to Complete** (poll or use webhook)
   ```
   GET http://localhost:8080/mj/task/8498455807619990/fetch
   Response: {"status": "SUCCESS", "imageUrl": "https://..."}
   ```

3. **Upscale Image 1**
   ```
   POST http://localhost:8080/mj/submit/change
   Body: {"action": "UPSCALE", "taskId": "8498455807619990", "index": 1}
   Response: {"code": 1, "result": "8498455807619991"}
   ```

## Testing Tips

1. **Start with Health Check**: Always test `/health` first to verify server is running

2. **Check Response Codes**:
   - `code: 1` = Success
   - `code: 22` = In queue
   - `code: 23` = Queue full
   - `code: 24` = Banned prompt

3. **Save Task IDs**: After submitting, save the task ID from the response to fetch status later

4. **Use Variables**: Create Postman environment variables for:
   - Base URL
   - API Secret
   - Task IDs (for chaining requests)

5. **Test Webhooks**: Set up a webhook URL to receive task status updates automatically

6. **Polling**: For task status, poll `/task/:id/fetch` every few seconds until status is `SUCCESS` or `FAILURE`

## Common Issues

### 401 Unauthorized
- **Cause**: Missing or incorrect API secret
- **Solution**: Check that `mj-api-secret` header matches your configured secret

### Connection Refused
- **Cause**: Server not running
- **Solution**: Start your server and verify it's listening on the correct port

### Validation Error
- **Cause**: Missing required fields or invalid format
- **Solution**: Check request body matches the required format

### Queue Full (code: 23)
- **Cause**: Too many tasks in queue
- **Solution**: Wait and retry, or increase queue size in config

## Additional Resources

- API Documentation: `http://localhost:8080/doc.html` (when server is running)
- API Documentation: `http://localhost:8080/mj/doc.html`
- GitHub Repository: Check the main README for more details

## Example Postman Collection JSON

You can import this collection into Postman:

```json
{
  "info": {
    "name": "Midjourney Proxy API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:8080/health",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["health"]
        }
      }
    },
    {
      "name": "Submit Imagine",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "mj-api-secret",
            "value": "{{apiSecret}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"prompt\": \"a beautiful sunset over mountains\",\n  \"base64Array\": [],\n  \"notifyHook\": \"https://your-webhook.com/notify\"\n}"
        },
        "url": {
          "raw": "http://localhost:8080/mj/submit/imagine",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["mj", "submit", "imagine"]
        }
      }
    },
    {
      "name": "Fetch Task",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "mj-api-secret",
            "value": "{{apiSecret}}"
          }
        ],
        "url": {
          "raw": "http://localhost:8080/mj/task/:taskId/fetch",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8080",
          "path": ["mj", "task", ":taskId", "fetch"],
          "variable": [
            {
              "key": "taskId",
              "value": "8498455807619990"
            }
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:8080/mj"
    },
    {
      "key": "apiSecret",
      "value": "your-api-secret-here"
    }
  ]
}
```

Save this as `midjourney-proxy.postman_collection.json` and import it into Postman.

