# Configuration Updated ✅

Your `default.yaml` has been updated with the new Discord credentials.

## Updated Values

- **Guild ID**: `1437563877293428778`
- **Channel ID**: `1437563878040145943`
- **User Token**: Updated
- **User Agent**: Updated to Windows/Chrome 134
- **API Secret**: Removed (optional - add if needed)

## ⚠️ Security Warning

**Your Discord token is now in `src/config/default.yaml`!**

### For Local Development:
- This is okay for local testing
- Make sure `.gitignore` excludes this file if it contains secrets

### For Railway/Production:
**DO NOT commit secrets to Git!** Use environment variables instead:

1. **Remove secrets from `default.yaml`** before committing
2. **Set environment variables in Railway:**
   - `MJ_DISCORD_GUILD_ID`
   - `MJ_DISCORD_CHANNEL_ID`
   - `MJ_DISCORD_USER_TOKEN`

## Next Steps

### 1. Test Configuration Locally
```bash
npm run test:config
```

### 2. Generate API Secret (Optional)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Up Railway Environment Variables
Run this command to see what to set in Railway:
```bash
npm run export:railway-env
```

Then add those variables in Railway dashboard.

### 4. Before Committing to Git
**Important:** Remove the Discord token from `default.yaml` before committing:

```yaml
mj:
  discord:
    guildId: ""  # Leave empty or use environment variable
    channelId: ""  # Leave empty or use environment variable
    userToken: ""  # Leave empty - use MJ_DISCORD_USER_TOKEN environment variable
```

Or add `src/config/default.yaml` to `.gitignore` if you want to keep secrets locally.

## Railway Environment Variables

Set these in Railway dashboard:
```
MJ_DISCORD_GUILD_ID=your_guild_id
MJ_DISCORD_CHANNEL_ID=your_channel_id
MJ_DISCORD_USER_TOKEN=your_discord_token
MJ_API_SECRET=your_api_secret
```

**Note:** Use the values from `npm run export:railway-env` command output.

## Testing

1. **Test configuration:**
   ```bash
   npm run test:config
   ```

2. **Start server locally:**
   ```bash
   npm run build
   npm start
   ```

3. **Test server:**
   ```bash
   npm run test:server
   ```

## Documentation

- [Configuration Guide](./CONFIGURATION.md)
- [Railway Setup Guide](./RAILWAY_ENV_SETUP.md)
- [API Secret Guide](./API_SECRET_GUIDE.md)

