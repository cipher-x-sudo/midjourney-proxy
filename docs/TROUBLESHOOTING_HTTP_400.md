# Troubleshooting HTTP 400 Bad Request from Discord

## Problem
Your request was accepted by the proxy (code: 1), but Discord returned `HTTP 400: Bad Request` when the proxy tried to submit the task to Discord.

## Root Causes

### 1. Missing or Invalid Guild ID / Channel ID (Most Common)

The Discord interaction payload requires valid `guild_id` and `channel_id`. If these are missing or invalid, Discord will return 400.

**Check your configuration:**
```bash
# Environment variables
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
```

**Or in default.yaml:**
```yaml
mj:
  accounts:
    - guildId: your_guild_id
      channelId: your_channel_id
      userToken: your_token
```

**How to verify:**
1. Check server logs for account initialization
2. Verify guild ID and channel ID are set (not empty)
3. Verify the IDs are correct (Discord IDs are long numbers)

---

### 2. Invalid Discord Token

The Discord token might be invalid, expired, or revoked.

**Symptoms:**
- HTTP 400 or 401 from Discord
- WebSocket connection fails
- Account shows as disabled

**Solution:**
1. Verify your Discord token is valid
2. Check if token has been revoked in Discord settings
3. Get a new token if needed
4. Make sure token format is correct (starts with proper prefix)

---

### 3. Token Doesn't Have Access to Guild/Channel

The Discord token might not have permission to access the specified guild or channel.

**Symptoms:**
- HTTP 400 from Discord
- Account connects but submissions fail

**Solution:**
1. Verify the bot/user has access to the guild
2. Verify the bot/user has access to the channel
3. Check channel permissions
4. Make sure the channel ID is correct

---

### 4. Invalid Session ID

The session ID might be invalid or not connected via WebSocket.

**Symptoms:**
- HTTP 400 from Discord interactions
- WebSocket shows connected but interactions fail

**Solution:**
1. Verify WebSocket is connected (check server logs)
2. Check if `sessionId` is set after READY event
3. Restart the server to establish new session

---

### 5. Outdated Application ID or Command Version

Discord might have updated the Midjourney bot's application ID or command structure.

**Symptoms:**
- HTTP 400 from Discord
- All interactions fail

**Solution:**
1. Check if Midjourney bot application ID changed
2. Check if command ID or version changed
3. Update `src/resources/api-params/*.json` files if needed

---

## Step-by-Step Troubleshooting

### Step 1: Verify Configuration

Check that all required Discord configuration is set:

```bash
# Required environment variables
MJ_DISCORD_GUILD_ID=your_guild_id        # Required!
MJ_DISCORD_CHANNEL_ID=your_channel_id    # Required!
MJ_DISCORD_USER_TOKEN=your_token         # Required!
```

**How to get Guild ID and Channel ID:**
1. Open Discord in browser
2. Enable Developer Mode (Settings → Advanced → Developer Mode)
3. Right-click on server (guild) → Copy Server ID
4. Right-click on channel → Copy Channel ID

### Step 2: Check Server Logs

Look for account initialization and WebSocket connection:

**Good signs:**
```
[wss-xxx] WebSocket connection established
Current available account count [1] - xxx
```

**Bad signs:**
```
Account init fail, disabled: WebSocket connection failed
No available account instance
```

### Step 3: Verify Account Status

Check account status:
```
GET http://localhost:8080/mj/account/list
```

Look for:
- `enable: true` (account is enabled)
- `guildId` and `channelId` are set (not null/empty)
- Account is connected (WebSocket established)

### Step 4: Test WebSocket Connection

Verify WebSocket is connected:
1. Check server logs for WebSocket connection
2. Look for "WebSocket connection established" message
3. Verify account count is > 0

### Step 5: Check Discord Token

Verify Discord token is valid:
1. Token should start with proper prefix (e.g., `mfa.` for MFA tokens, or user token format)
2. Token should not be expired
3. Token should have access to the guild and channel

### Step 6: Verify Guild and Channel Access

1. **Guild ID:**
   - Must be a valid Discord server ID
   - Token must have access to this server
   - Server must exist and be accessible

2. **Channel ID:**
   - Must be a valid Discord channel ID
   - Channel must be in the specified guild
   - Token must have permission to send messages in this channel
   - Midjourney bot must be in this channel

---

## Common Configuration Errors

### Error 1: Empty Guild ID or Channel ID
```yaml
# ❌ Wrong - empty values
mj:
  accounts:
    - guildId: 
      channelId: 
```

```yaml
# ✅ Correct - valid IDs
mj:
  accounts:
    - guildId: "123456789012345678"
      channelId: "987654321098765432"
```

### Error 2: Wrong Environment Variable Names
```bash
# ❌ Wrong
DISCORD_GUILD_ID=xxx
DISCORD_CHANNEL_ID=xxx

# ✅ Correct
MJ_DISCORD_GUILD_ID=xxx
MJ_DISCORD_CHANNEL_ID=xxx
```

### Error 3: Token Without Access
- Token doesn't have access to the guild
- Token doesn't have access to the channel
- Token doesn't have permission to use slash commands

---

## Quick Fix Checklist

- [ ] `MJ_DISCORD_GUILD_ID` is set and valid
- [ ] `MJ_DISCORD_CHANNEL_ID` is set and valid
- [ ] `MJ_DISCORD_USER_TOKEN` is set and valid
- [ ] Token has access to the guild
- [ ] Token has access to the channel
- [ ] Midjourney bot is in the channel
- [ ] WebSocket is connected (check logs)
- [ ] Account is enabled (check `/mj/account/list`)
- [ ] Server logs show no errors

---

## Testing Your Configuration

### Test 1: Check Account Status
```
GET http://localhost:8080/mj/account/list
```

Should return account with:
- `enable: true`
- `guildId: "your_guild_id"` (not empty)
- `channelId: "your_channel_id"` (not empty)

### Test 2: Check WebSocket Connection
Look at server logs:
```
[wss-xxx] WebSocket connection established
Current available account count [1] - xxx
```

### Test 3: Submit Test Request
```
POST http://localhost:8080/mj/submit/imagine
Body: {"prompt": "test"}
```

Should return code: 1 (success) and task should complete (not fail with HTTP 400).

---

## Still Not Working?

1. **Check server logs** for detailed error messages
2. **Verify all environment variables** are set correctly
3. **Test Discord token** by manually using it in a Discord client
4. **Verify guild/channel IDs** are correct (use Discord Developer Mode)
5. **Check Midjourney bot** is in the channel and has permissions
6. **Restart server** after changing configuration
7. **Check Discord API status** for any outages

---

## Expected Behavior

**Successful submission:**
1. Request accepted (code: 1)
2. Task status: SUBMITTED → IN_PROGRESS → SUCCESS
3. No HTTP 400 errors
4. Image URL in response

**Failed submission (HTTP 400):**
1. Request accepted (code: 1)
2. Task status: SUBMITTED → FAILURE
3. failReason: "HTTP 400: Bad Request"
4. No image generated

---

## Additional Resources

- Discord Developer Documentation: https://discord.com/developers/docs
- Midjourney Bot Documentation: Check Midjourney's official docs
- Server Logs: Check console output for detailed error messages

