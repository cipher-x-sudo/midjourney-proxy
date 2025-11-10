# API Secret Configuration Guide

This guide explains how to create and use an API secret for authentication.

## What is an API Secret?

The API secret is an optional authentication mechanism that protects your Midjourney Proxy API endpoints. When configured, all API requests must include the secret in the request header.

## How to Generate an API Secret

You can generate a secure random secret using various methods:

### Method 1: Using Node.js (Recommended)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This generates a 64-character hexadecimal string (256 bits of entropy).

### Method 2: Using OpenSSL

```bash
openssl rand -hex 32
```

### Method 3: Using Python

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Method 4: Online Generator

You can also use online tools like:
- https://www.random.org/strings/
- https://www.lastpass.com/features/password-generator

**Recommended length:** At least 32 characters (256 bits) for security.

### Example Generated Secret

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

## Configuration Methods

### Option 1: Environment Variable (Recommended for Production)

```bash
export MJ_API_SECRET="your-generated-secret-here"
```

**Docker:**
```bash
docker run -p 8080:8080 \
  -e MJ_DISCORD_GUILD_ID=your_guild_id \
  -e MJ_DISCORD_CHANNEL_ID=your_channel_id \
  -e MJ_DISCORD_USER_TOKEN=your_token \
  -e MJ_API_SECRET="your-generated-secret-here" \
  midjourney-proxy
```

**Docker Compose:**
```yaml
services:
  app:
    environment:
      - MJ_API_SECRET=your-generated-secret-here
```

**Railway/Railway:**
Set `MJ_API_SECRET` in your platform's environment variables.

### Option 2: YAML Configuration File (For Local Development)

Edit `src/config/default.yaml`:

```yaml
mj:
  apiSecret: "your-generated-secret-here"
```

⚠️ **Warning:** Never commit secrets to Git! Use environment variables in production.

## How to Use the API Secret

Once configured, include the secret in all API requests using the `mj-api-secret` header.

### cURL Example

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-generated-secret-here" \
  -d '{
    "prompt": "a beautiful landscape",
    "notifyHook": "https://your-webhook.com"
  }'
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:8080/mj/submit/imagine', {
  prompt: 'a beautiful landscape',
  notifyHook: 'https://your-webhook.com'
}, {
  headers: {
    'mj-api-secret': 'your-generated-secret-here',
    'Content-Type': 'application/json'
  }
});
```

### Python Example

```python
import requests

headers = {
    'mj-api-secret': 'your-generated-secret-here',
    'Content-Type': 'application/json'
}

data = {
    'prompt': 'a beautiful landscape',
    'notifyHook': 'https://your-webhook.com'
}

response = requests.post(
    'http://localhost:8080/mj/submit/imagine',
    json=data,
    headers=headers
)
```

### Postman Example

1. Create a new request
2. Go to the "Headers" tab
3. Add header:
   - Key: `mj-api-secret`
   - Value: `your-generated-secret-here`

## Security Best Practices

### 1. Use Strong Secrets

- Minimum 32 characters (256 bits)
- Use cryptographically secure random generators
- Avoid predictable patterns or words

### 2. Never Commit Secrets to Git

❌ **Don't do this:**
```yaml
# default.yaml (committed to Git)
mj:
  apiSecret: "my-secret-key-123"  # ❌ Exposed in repository
```

✅ **Do this instead:**
```bash
# Use environment variables
export MJ_API_SECRET="my-secret-key-123"
```

Add to `.gitignore`:
```
src/config/default.yaml
.env
.env.local
```

### 3. Rotate Secrets Regularly

- Change your API secret periodically
- Update all clients when rotating
- Use secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)

### 4. Use Different Secrets for Different Environments

- Development: `dev-secret-xxx`
- Staging: `staging-secret-xxx`
- Production: `prod-secret-xxx`

### 5. Protect Secrets in Client Applications

- Store secrets securely (environment variables, key management services)
- Never expose secrets in client-side code
- Use HTTPS for all API requests

## Testing Authentication

### Test Without Secret (Should Work if Secret Not Configured)

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

### Test With Correct Secret (Should Work)

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: your-correct-secret" \
  -d '{"prompt": "test"}'
```

### Test With Wrong Secret (Should Return 401 Unauthorized)

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: wrong-secret" \
  -d '{"prompt": "test"}'
```

Expected response:
```json
{
  "error": "Unauthorized"
}
```

## Disabling Authentication

To disable API authentication, simply don't set the `apiSecret`:

```yaml
mj:
  apiSecret:   # Leave empty or remove this line
```

Or don't set the `MJ_API_SECRET` environment variable.

When `apiSecret` is not configured, all API endpoints are accessible without authentication.

## Troubleshooting

### Issue: Getting 401 Unauthorized Error

**Possible causes:**
1. API secret is configured but header is missing
2. API secret in header doesn't match configured secret
3. Header name is incorrect (should be `mj-api-secret`)

**Solution:**
1. Check that `mj-api-secret` header is included in request
2. Verify the secret value matches exactly (case-sensitive)
3. Check server logs for authentication errors

### Issue: Authentication Not Working

**Possible causes:**
1. Secret not configured on server
2. Header name typo
3. Secret contains special characters that need encoding

**Solution:**
1. Verify `MJ_API_SECRET` environment variable is set
2. Check header name is exactly `mj-api-secret`
3. Ensure secret doesn't contain newlines or special characters

## Example: Complete Setup

### 1. Generate Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 2. Configure in Docker

```bash
docker run -d -p 8080:8080 \
  --name midjourney-proxy \
  -e MJ_DISCORD_GUILD_ID=your_guild_id \
  -e MJ_DISCORD_CHANNEL_ID=your_channel_id \
  -e MJ_DISCORD_USER_TOKEN=your_token \
  -e MJ_API_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2" \
  midjourney-proxy
```

### 3. Test API Call

```bash
curl -X POST http://localhost:8080/mj/submit/imagine \
  -H "Content-Type: application/json" \
  -H "mj-api-secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2" \
  -d '{
    "prompt": "a beautiful sunset over mountains",
    "notifyHook": "https://your-webhook.com/notify"
  }'
```

## Additional Resources

- [Configuration Guide](./CONFIGURATION.md)
- [API Documentation](./api.md)
- [Security Best Practices](./CONFIGURATION.md#security-best-practices)

