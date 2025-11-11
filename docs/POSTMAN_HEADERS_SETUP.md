# How to Set Collection-Level Headers in Postman

> **Note**: Newer versions of Postman may not have a "Headers" tab at the collection level. Use the methods below instead.

## Method 1: Using Authorization Tab (Recommended for API Secret)

Since there's no Headers tab visible, we'll use the Authorization tab for the API secret header.

### Step 1: Select Your Collection
1. Click on your collection name in the left sidebar (you should see tabs: Overview, Variables, Authorization, Scripts, Runs)

### Step 2: Go to Authorization Tab
1. Click on the **"Authorization"** tab (you'll see it has a green dot, indicating it's configured or available)

### Step 3: Configure API Key
1. Select **Type**: `API Key` (from the dropdown)
2. Fill in the fields:
   - **Key**: `mj-api-secret`
   - **Value**: `{{apiSecret}}` (use the variable you created, or type your actual secret)
   - **Add to**: Select `Header` from the dropdown

### Step 4: Save
The Authorization tab will automatically save. The `mj-api-secret` header will now be added to all requests in this collection.

### Step 5: Add Content-Type Header Using Pre-request Script
Since we can't set collection-level headers directly, we'll use a Pre-request Script:

1. Click on the **"Scripts"** tab (or "Pre-request Script" tab if available)
2. In the **Pre-request Script** section, add this code:
```javascript
// Set Content-Type header for all requests
pm.request.headers.add({
    key: 'Content-Type',
    value: 'application/json'
});
```

3. This script will automatically add the `Content-Type` header to every request in the collection.

### Alternative: Add Content-Type to Individual Requests
If you prefer not to use scripts, you can add `Content-Type` header to each request manually:
1. Open any request in the collection
2. Go to the **"Headers"** tab of that request (below the URL bar)
3. Add:
   - **Key**: `Content-Type`
   - **Value**: `application/json`
4. Repeat for each request

## Method 2: Set Headers on Individual Requests (Alternative)

If you don't want to use the Authorization tab or scripts, you can set headers on each request:

### For Each Request:
1. Open the request (e.g., "Submit Imagine")
2. Click on the **"Headers"** tab (below the URL bar, in the request editor)
3. Add headers:
   - `mj-api-secret`: `{{apiSecret}}` (or your actual secret)
   - `Content-Type`: `application/json`

**Note**: This method requires adding headers to every request manually.

## Complete Setup Summary

Based on your Postman version (no Headers tab), here's the recommended setup:

### Step 1: Set Variables (You've already done this!)
1. Go to **Variables** tab
2. Add `apiSecret` variable with your secret value
3. Add `baseUrl` variable: `http://localhost:8080/mj`

### Step 2: Set API Secret Header
1. Go to **Authorization** tab
2. Type: `API Key`
3. Key: `mj-api-secret`
4. Value: `{{apiSecret}}`
5. Add to: `Header`

### Step 3: Set Content-Type Header (Choose one method)

**Option A: Using Pre-request Script (Recommended)**
1. Go to **Scripts** tab (or look for "Pre-request Script" in the tabs)
2. In the Pre-request Script section, add:
```javascript
pm.request.headers.add({
    key: 'Content-Type',
    value: 'application/json'
});
```

**Option B: Manual per request**
- Add `Content-Type: application/json` header to each request individually

## Troubleshooting

### "I don't see a Headers tab on my collection"
- **This is normal!** Newer Postman versions don't have collection-level Headers tab
- **Solution**: Use Authorization tab for API secret + Pre-request Script for Content-Type

### "Headers aren't being sent with requests"
- **Check**: Make sure you've saved the collection (Ctrl+S or Cmd+S)
- **Check**: For Authorization tab, make sure "Inherit auth from parent" is enabled on requests
- **Check**: For Pre-request Script, make sure the script is in the collection's Pre-request Script, not the request's
- **Check**: Verify the variable name is correct (`{{apiSecret}}` with double curly braces)
- **Check**: Open Postman Console (View → Show Postman Console) and check "Request Headers" section

### "I get 401 Unauthorized errors"
- **Check**: Verify your API secret is correct
- **Check**: Make sure the header name is exactly `mj-api-secret` (case-sensitive)
- **Check**: Verify the header is being sent (check the request in Postman Console)

## Visual Location Guide (Based on Your Postman Version)

```
Postman Window Layout:
┌─────────────────────────────────────────────────────────┐
│ File Edit View ...                    [Sync] [Settings] │
├──────────┬──────────────────────────────────────────────┤
│          │  Collection Details Panel (Right Side)       │
│          │  ┌────────────────────────────────────────┐  │
│ Collections│ MJ (or your collection name)             │  │
│          │  ├────────────────────────────────────────┤  │
│ 📁 MJ    │  [Overview] [Variables] [Authorization]   │  │
│   Collection│ [Scripts] [Runs]                       │  │
│    └─ Request 1                                        │  │
│    └─ Request 2                                        │  │
│          │  └────────────────────────────────────────┘  │
│          │                                               │
│          │  Authorization Tab:                           │
│          │  Type: API Key                                │
│          │  Key: mj-api-secret                           │
│          │  Value: {{apiSecret}}                         │
│          │  Add to: Header                               │
│          │                                               │
│          │  Scripts Tab → Pre-request Script:            │
│          │  pm.request.headers.add({                     │
│          │      key: 'Content-Type',                     │
│          │      value: 'application/json'                │
│          │  });                                          │
└──────────┴──────────────────────────────────────────────┘
```

## Quick Checklist (For Your Postman Version)

- [x] Created a collection (You have "MJ" collection)
- [x] Set up Variables (You've done this - apiSecret variable)
- [ ] Go to **Authorization** tab
- [ ] Set Type to `API Key`
- [ ] Set Key to `mj-api-secret`
- [ ] Set Value to `{{apiSecret}}`
- [ ] Set "Add to" to `Header`
- [ ] Go to **Scripts** tab (or find Pre-request Script)
- [ ] Add Pre-request Script to set `Content-Type` header
- [ ] Save the collection
- [ ] Test a request and verify headers in Console

## Testing Your Headers

1. Create a test request in your collection
2. Send the request
3. Check the Postman Console (View → Show Postman Console)
4. Look at the "Request Headers" section
5. Verify both headers are present:
   ```
   mj-api-secret: your-actual-secret-value
   Content-Type: application/json
   ```

If you see the headers in the console, they're being sent correctly!

