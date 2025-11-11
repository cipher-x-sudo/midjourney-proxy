# Troubleshooting 404 Error on POST /mj/submit/imagine

## Step-by-Step Debugging

### Step 1: Test Health Endpoint First

Before testing `/submit/imagine`, test the health endpoint to verify the server is running:

**Request:**
```
GET http://localhost:8080/health
```

**Expected Response:**
```json
{
  "status": "ok"
}
```

**If this fails:**
- Server is not running
- Wrong port (check if server is on port 8080)
- Server not started properly

---

### Step 2: Verify Server is Running

Check if your server is actually running:
1. Look at your server console/terminal
2. You should see: `Server listening at http://0.0.0.0:8080`
3. You should see: `Server listening on http://0.0.0.0:8080/mj`

**If server is not running:**
```bash
# Start the server
npm start
# or
node dist/server.js
```

---

### Step 3: Check the Exact URL

Make sure you're using the correct URL:

**Correct URL:**
```
POST http://localhost:8080/mj/submit/imagine
```

**Common Mistakes:**
- ❌ `http://localhost:8080/submit/imagine` (missing `/mj`)
- ❌ `http://localhost:8080/mj/submit/imagine/` (trailing slash)
- ❌ `http://127.0.0.1:8080/mj/submit/imagine` (should work, but try localhost)
- ❌ Wrong port (check if server is on 8080)

---

### Step 4: Verify Postman Request Setup

**Method:** `POST` (not GET!)

**URL:** `http://localhost:8080/mj/submit/imagine`

**Headers:**
- `Content-Type: application/json`
- `mj-api-secret: your-secret` (if configured)

**Body (raw, JSON):**
```json
{
  "prompt": "test"
}
```

---

### Step 5: Check Server Logs

Look at your server console for errors:

**Good signs:**
- `Server listening at http://0.0.0.0:8080`
- `Server listening on http://0.0.0.0:8080/mj`
- No error messages

**Bad signs:**
- Error messages about routes
- Port already in use
- Server not starting

---

### Step 6: Check Server Configuration

Verify your `default.yaml` or environment variables:

**default.yaml:**
```yaml
server:
  port: 8080
  contextPath: /mj
```

**Environment Variables:**
- `SERVER_PORT` (default: 8080)
- `SERVER_CONTEXT_PATH` (default: /mj)

---

### Step 7: Test with cURL

Test the endpoint directly with cURL to rule out Postman issues:

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{"prompt": "test"}'
```

**If cURL works but Postman doesn't:**
- Postman configuration issue
- Check Postman headers
- Check Postman body format

**If cURL also fails:**
- Server issue
- Route not registered
- Server needs restart

---

### Step 8: Restart Server

If nothing works, restart the server:

1. Stop the server (Ctrl+C)
2. Rebuild (if needed):
   ```bash
   npm run build
   ```
3. Start server:
   ```bash
   npm start
   ```

---

## Common Issues and Solutions

### Issue 1: Server Not Running
**Symptom:** 404 error, health endpoint also fails
**Solution:** Start the server

### Issue 2: Wrong URL
**Symptom:** 404 error, but health endpoint works
**Solution:** Check URL includes `/mj` prefix

### Issue 3: Wrong Method
**Symptom:** "Route GET:/mj/submit/imagine not found"
**Solution:** Use POST method, not GET

### Issue 4: Server Not Fully Started
**Symptom:** 404 error immediately after starting
**Solution:** Wait a few seconds for server to fully initialize

### Issue 5: Port Conflict
**Symptom:** Server won't start or wrong port
**Solution:** Check if port 8080 is available, or change port in config

### Issue 6: Build Issue
**Symptom:** Routes not registered
**Solution:** Rebuild the project: `npm run build`

---

## Quick Checklist

- [ ] Server is running (check console)
- [ ] Health endpoint works: `GET http://localhost:8080/health`
- [ ] Using POST method (not GET)
- [ ] URL is correct: `http://localhost:8080/mj/submit/imagine`
- [ ] Headers are set: `Content-Type: application/json`
- [ ] Body is set: `{"prompt": "test"}`
- [ ] Body format is JSON (raw, JSON)
- [ ] API secret header is set (if configured)
- [ ] Server logs show no errors
- [ ] Port is correct (8080)

---

## Still Not Working?

1. **Check server logs** for any error messages
2. **Try health endpoint** first to verify server is running
3. **Try a different endpoint** like `/mj/task/queue` (GET)
4. **Check if routes are registered** by looking at server startup logs
5. **Restart server** and try again
6. **Check Postman Console** (View → Show Postman Console) to see what's actually being sent

---

## Expected Server Logs

When server starts successfully, you should see:
```
Server listening at http://0.0.0.0:8080
Server listening on http://0.0.0.0:8080/mj
```

When a request is received, you should see logs about the request (depending on logging level).

---

## Test Sequence

1. **Test Health:**
   ```
   GET http://localhost:8080/health
   ```
   Should return: `{"status": "ok"}`

2. **Test Submit Imagine:**
   ```
   POST http://localhost:8080/mj/submit/imagine
   Body: {"prompt": "test"}
   ```
   Should return task ID or queue status

3. **If health works but submit doesn't:**
   - Check URL includes `/mj`
   - Check method is POST
   - Check body is JSON
   - Check headers are set
   - Check server logs for errors

