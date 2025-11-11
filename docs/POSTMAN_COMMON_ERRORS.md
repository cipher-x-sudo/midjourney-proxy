# Common Postman Errors and Solutions

## Error: Route GET:/mj/submit/imagine not found (404)

### Problem
You're using **GET** method on a **POST** endpoint.

### Solution
Change the HTTP method from **GET** to **POST** in Postman.

### Steps to Fix:

1. **In Postman, change the method:**
   - Look at the method dropdown (left of URL bar)
   - Change from `GET` to `POST`

2. **Add request body:**
   - Go to **Body** tab
   - Select **raw**
   - Select **JSON** from dropdown
   - Add JSON body:
   ```json
   {
     "prompt": "a beautiful landscape"
   }
   ```

3. **Add headers:**
   - Go to **Headers** tab
   - Add `Content-Type: application/json`
   - Add `mj-api-secret: your-secret` (if configured)

### Correct Request:
```
Method: POST (not GET!)
URL: http://localhost:8080/mj/submit/imagine
Headers:
  Content-Type: application/json
  mj-api-secret: your-secret (if configured)
Body (raw JSON):
{
  "prompt": "a beautiful landscape"
}
```

---

## Error: 401 Unauthorized

### Problem
API secret is missing or incorrect.

### Solution
1. Check if API secret is configured in your server
2. Add `mj-api-secret` header with correct value
3. Verify the header name is exactly `mj-api-secret` (case-sensitive)

### Steps to Fix:
1. Check server configuration for `MJ_API_SECRET`
2. Add header in Postman:
   - Key: `mj-api-secret`
   - Value: Your actual API secret
3. Or configure it in collection Authorization tab

---

## Error: Validation error / prompt cannot be empty

### Problem
Request body is missing or `prompt` field is empty.

### Solution
1. Make sure you're using POST method
2. Add request body with `prompt` field
3. Check that body is set to JSON format

### Correct Body:
```json
{
  "prompt": "your prompt here"
}
```

---

## Error: Route not found (404)

### Common Causes:
1. **Wrong HTTP method** (using GET instead of POST)
2. **Wrong URL path** (typo in endpoint)
3. **Server not running** (check if server is started)
4. **Wrong port** (default is 8080)

### Solution:
1. Verify the HTTP method matches the endpoint:
   - `/submit/*` endpoints = **POST**
   - `/task/*` endpoints = **GET** or **POST**
   - `/account/*` endpoints = **GET**
   - `/health` = **GET**

2. Check the URL:
   - Base URL: `http://localhost:8080/mj`
   - Full URL: `http://localhost:8080/mj/submit/imagine`

3. Verify server is running:
   - Test: `GET http://localhost:8080/health`
   - Should return: `{"status": "ok"}`

---

## Error: Cannot read properties of undefined

### Problem
Request body is not being sent or is malformed.

### Solution:
1. Make sure **Body** tab is selected
2. Select **raw** and **JSON** format
3. Verify JSON syntax is valid
4. Check that `Content-Type: application/json` header is set

---

## Error: Queue full (code: 23)

### Problem
Too many tasks in the queue.

### Solution:
1. Wait and retry later
2. Check queue status: `GET http://localhost:8080/mj/task/queue`
3. Increase queue size in server configuration

---

## Error: Banned prompt (code: 24)

### Problem
Prompt contains sensitive/banned words.

### Solution:
1. Change the prompt to avoid banned words
2. Check the response for the banned word:
   ```json
   {
     "code": 24,
     "description": "可能包含敏感词",
     "properties": {
       "promptEn": "nude body",
       "bannedWord": "nude"
     }
   }
   ```
3. Remove or replace the banned word

---

## Quick Checklist for POST Requests

When making POST requests, always check:

- [ ] Method is set to **POST** (not GET)
- [ ] URL is correct
- [ ] **Body** tab is selected
- [ ] Body format is **raw** and **JSON**
- [ ] JSON syntax is valid
- [ ] Required fields are present (e.g., `prompt`)
- [ ] Headers include `Content-Type: application/json`
- [ ] Headers include `mj-api-secret` (if configured)
- [ ] Server is running (test with `/health` endpoint)

---

## Method Summary

### GET Endpoints (No Body Required):
- `GET /health`
- `GET /mj/task/{id}/fetch`
- `GET /mj/task/queue`
- `GET /mj/task/list`
- `GET /mj/account/list`
- `GET /mj/account/{id}/fetch`

### POST Endpoints (Body Required):
- `POST /mj/submit/imagine` ✅ **Body required**
- `POST /mj/submit/change` ✅ **Body required**
- `POST /mj/submit/simple-change` ✅ **Body required**
- `POST /mj/submit/describe` ✅ **Body required**
- `POST /mj/submit/blend` ✅ **Body required**
- `POST /mj/task/list-by-condition` ✅ **Body required**

---

## Testing Order

1. **Test Health Check First:**
   ```
   GET http://localhost:8080/health
   ```
   Should return: `{"status": "ok"}`

2. **Test Submit Imagine:**
   ```
   POST http://localhost:8080/mj/submit/imagine
   Body: {"prompt": "test"}
   ```
   Should return task ID

3. **Test Fetch Task:**
   ```
   GET http://localhost:8080/mj/task/{taskId}/fetch
   ```
   Should return task details

