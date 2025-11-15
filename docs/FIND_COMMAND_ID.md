# How to Find Discord Command ID and Version

## Problem
When adding new MidJourney Discord commands, you need the correct `id` and `version` values for the command to work. Placeholder values will result in successful API responses but no Discord activity.

## Method 1: Browser DevTools Network Inspector (Recommended)

### Steps:

1. **Open Discord in Browser**
   - Go to https://discord.com in Chrome/Edge/Firefox
   - Log in to your Discord account

2. **Open Developer Tools**
   - Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Click the **Network** tab

3. **Filter Network Requests**
   - In the filter box, type: `interactions` or `api/v9/interactions`
   - This will show only Discord API interaction requests

4. **Use the Command in Discord**
   - In the Discord channel, type `/shorten` and complete the command with a test prompt
   - Press Enter to submit

5. **Find the Request**
   - Look for a POST request to `/api/v9/interactions` in the Network tab
   - Click on it to view details

6. **Copy the Payload**
   - Go to the **Payload** or **Request** tab
   - Look for JSON like this:
   ```json
   {
     "type": 2,
     "application_id": "936929561302675456",
     "guild_id": "...",
     "channel_id": "...",
     "session_id": "...",
     "nonce": "...",
     "data": {
       "id": "1092492867185950854",  // ← THIS IS THE COMMAND ID
       "version": "1237876415471554626",  // ← THIS IS THE VERSION
       "name": "shorten",
       "type": 1,
       "options": [
         {
           "type": 3,
           "name": "prompt",
           "value": "your test prompt"
         }
       ]
     }
   }
   ```

7. **Update shorten.json**
   - Copy the `id` value → update `src/resources/api-params/shorten.json` line 10
   - Copy the `version` value → update line 9
   - Save and rebuild

### Alternative: View Request Headers
- Click on the request → **Headers** tab
- Scroll to **Request Payload** section
- The JSON payload will be shown there

## Method 2: Using Browser Console (JavaScript)

1. Open Discord in browser
2. Press `F12` → Go to **Console** tab
3. Type this code and press Enter:
```javascript
// Intercept fetch requests
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0] && args[0].includes('interactions')) {
    console.log('Interactions request:', args);
    if (args[1] && args[1].body) {
      args[1].body.clone().text().then(body => {
        const data = JSON.parse(body);
        if (data.data && data.data.name === 'shorten') {
          console.log('SHORTEN COMMAND ID:', data.data.id);
          console.log('SHORTEN COMMAND VERSION:', data.data.version);
        }
      });
    }
  }
  return originalFetch.apply(this, args);
};
```

4. Use `/shorten` command in Discord
5. Check console output for the ID and version

## Method 3: Monitor WebSocket Messages

1. Open Discord in browser → DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Find the WebSocket connection to `gateway.discord.gg`
4. Click on it → Go to **Messages** tab
5. Use `/shorten` command
6. Look for MESSAGE_CREATE or INTERACTION_CREATE events
7. The command data will be in the message payload

## Method 4: Using Node.js Script (Advanced)

Create a script to intercept Discord client requests:

```javascript
// intercept-discord.js
// This requires Discord.js or similar library
// Or use mitmproxy to intercept HTTPS traffic
```

## Quick Reference: Known Command IDs

| Command | ID | Version |
|---------|-----|---------|
| imagine | 938956540159881230 | 1237876415471554623 |
| describe | 1092492867185950852 | 1237876415471554625 |
| blend | 1062880104792997970 | 1237876415471554624 |
| shorten | **TO BE FOUND** | **TO BE FOUND** |

## After Finding the Values

1. Update `src/resources/api-params/shorten.json`:
   ```json
   {
     "data": {
       "version": "YOUR_VERSION_HERE",  // Line 9
       "id": "YOUR_COMMAND_ID_HERE",     // Line 10
       ...
     }
   }
   ```

2. Rebuild the project:
   ```bash
   npm run build
   ```

3. Restart the server and test

## Troubleshooting

**If you can't see the request:**
- Make sure you're filtering correctly (try searching for "v9/interactions")
- Try typing the filter while requests are paused
- Clear the network log and try again

**If the command still doesn't work:**
- Verify the `application_id` is correct: `936929561302675456` (MidJourney bot)
- Check that `session_id` is being replaced correctly
- Verify your Discord token has permissions

**If you get HTTP 400 Bad Request:**
- The command ID or version is likely wrong
- Double-check you copied the entire ID (they're long numbers)
- Make sure there are no extra spaces or quotes

