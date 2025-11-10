# Testing Configuration and Railway Setup

This guide explains how to test your configuration and set up environment variables in Railway.

## Quick Start

### 1. Test Your Configuration

```bash
npm run test:config
```

This will validate that all required configuration is present in your `default.yaml` file.

### 2. Export Railway Environment Variables

```bash
npm run export:railway-env
```

This will generate the environment variables you need to set in Railway.

### 3. Test Server (if running)

```bash
npm run test:server
```

This will test the server connection and health endpoint.

## Step-by-Step Guide

### Step 1: Test Local Configuration

1. **Run configuration test:**
   ```bash
   npm run test:config
   ```

2. **Expected output:**
   ```
   ✅ Config file loaded successfully
   ✅ Port: 8080
   ✅ Context Path: /mj
   ✅ Guild ID: your_guild_id
   ✅ Channel ID: your_channel_id
   ✅ User Token: your_token...
   ✅ API Secret: your_secret...
   ✅ All required configuration is present!
   ```

3. **If there are errors:**
   - Fix any missing or incorrect configuration
   - Re-run the test until all checks pass

### Step 2: Start Local Server (Optional)

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Test server connection:**
   ```bash
   npm run test:server
   ```

4. **Expected output:**
   ```
   ✅ Health check successful: /mj/health
   ✅ Response: {"status":"ok"}
   ```

### Step 3: Export Railway Environment Variables

1. **Generate environment variables:**
   ```bash
   npm run export:railway-env
   ```

2. **Copy the output** - you'll see something like:
   ```
   MJ_DISCORD_GUILD_ID=your_guild_id
   MJ_DISCORD_CHANNEL_ID=your_channel_id
   MJ_DISCORD_USER_TOKEN=your_discord_token
   MJ_API_SECRET=your-generated-api-secret
   ```

### Step 4: Set Up Railway Environment Variables

#### Method 1: Using Railway Dashboard (Recommended)

1. **Go to Railway Dashboard:**
   - Visit https://railway.app
   - Log in to your account
   - Select your project
   - Click on your service

2. **Navigate to Variables:**
   - Click on the **Variables** tab
   - Click **New Variable**

3. **Add Each Variable:**
   - Variable name: `MJ_DISCORD_GUILD_ID`
   - Value: `1437559475199414376`
   - Click **Add**
   - Repeat for all variables

4. **Required Variables:**
   - `MJ_DISCORD_GUILD_ID`
   - `MJ_DISCORD_CHANNEL_ID`
   - `MJ_DISCORD_USER_TOKEN`
   - `MJ_API_SECRET` (recommended)

#### Method 2: Using Railway CLI

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Link your project:**
   ```bash
   railway link
   ```

4. **Set environment variables:**
   ```bash
   railway variables set MJ_DISCORD_GUILD_ID=your_guild_id
   railway variables set MJ_DISCORD_CHANNEL_ID=your_channel_id
   railway variables set MJ_DISCORD_USER_TOKEN=your_discord_token
   railway variables set MJ_API_SECRET=your-generated-api-secret
   ```

5. **Verify variables:**
   ```bash
   railway variables
   ```

### Step 5: Deploy and Verify

1. **Railway will automatically deploy** when you add environment variables

2. **Check deployment logs:**
   - Go to Railway dashboard
   - Click on your service
   - Click on **Deployments** tab
   - Click on the latest deployment
   - Check logs for:
     - `Server listening on http://0.0.0.0:8080/mj`
     - `Current available account count [1]` (or higher)

3. **Test health endpoint:**
   ```bash
   curl https://your-app.railway.app/mj/health
   ```
   
   Expected response:
   ```json
   {"status":"ok"}
   ```

4. **Test API endpoint:**
   ```bash
   curl -X POST https://your-app.railway.app/mj/submit/imagine \
     -H "Content-Type: application/json" \
     -H "mj-api-secret: your-generated-api-secret" \
     -d '{
       "prompt": "a beautiful landscape",
       "notifyHook": "https://your-webhook.com"
     }'
   ```

## Testing Checklist

- [ ] Configuration test passes (`npm run test:config`)
- [ ] All required variables are set in Railway
- [ ] Server starts successfully (check Railway logs)
- [ ] Health endpoint responds (`/mj/health`)
- [ ] API endpoint works (with correct API secret)
- [ ] Discord account connects (`Current available account count [1]`)

## Troubleshooting

### Configuration Test Fails

**Issue:** Missing required configuration

**Solution:**
1. Check `src/config/default.yaml`
2. Ensure all required fields are filled:
   - `mj.discord.guildId`
   - `mj.discord.channelId`
   - `mj.discord.userToken`

### Server Test Fails

**Issue:** Server not running or not accessible

**Solution:**
1. Start the server: `npm start`
2. Check if server is running on port 8080
3. Verify health endpoint is accessible: `curl http://localhost:8080/mj/health`

### Railway Deployment Fails

**Issue:** Environment variables not set or incorrect

**Solution:**
1. Verify all environment variables are set in Railway
2. Check Railway logs for errors
3. Ensure variable names are correct (case-sensitive)
4. Verify Discord token is valid and not expired

### "Current available account count [0]"

**Issue:** Discord account not connecting

**Solution:**
1. Verify Discord credentials are correct
2. Check Discord token is valid and not expired
3. Verify guild ID and channel ID are correct
4. Check Railway logs for connection errors

### 401 Unauthorized Error

**Issue:** API secret mismatch

**Solution:**
1. Verify `MJ_API_SECRET` is set in Railway
2. Ensure `mj-api-secret` header is included in requests
3. Verify secret value matches exactly

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit secrets to Git**
   - Your `default.yaml` contains secrets
   - Use environment variables in Railway
   - Don't commit `default.yaml` with secrets

2. **Protect your Discord token**
   - Discord tokens are sensitive
   - Rotate if compromised
   - Use environment variables only

3. **Use strong API secrets**
   - Generate using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Use at least 32 characters
   - Rotate periodically

## Additional Resources

- [Railway Environment Variables Setup](./RAILWAY_ENV_SETUP.md)
- [Configuration Guide](./CONFIGURATION.md)
- [API Secret Guide](./API_SECRET_GUIDE.md)
- [API Documentation](./api.md)

## Quick Reference

### Test Commands

```bash
# Test configuration
npm run test:config

# Test server connection
npm run test:server

# Export Railway environment variables
npm run export:railway-env
```

### Railway CLI Commands

```bash
# Login to Railway
railway login

# Link project
railway link

# Set environment variable
railway variables set VARIABLE_NAME=value

# List all variables
railway variables

# View logs
railway logs
```

### Test Endpoints

```bash
# Health check
curl https://your-app.railway.app/mj/health

# API test (with secret)
curl -X POST https://your-app.railway.app/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-secret" \
  -d '{"prompt": "test"}'
```

