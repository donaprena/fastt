# Admin Panel Setup

## Security Configuration

The admin panel is protected with an API key to prevent unauthorized access.

### Setup on EC2

1. **Create a .env file in the server root:**

```bash
cd ~/fastt
nano .env
```

2. **Add your admin API key:**

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Admin Panel Security - Generate a strong key!
ADMIN_API_KEY=your-secure-random-api-key-here

# Optional: React App API URL
# REACT_APP_API_URL=https://fastt.chat
```

3. **Generate a secure API key:**

```bash
# Generate a strong random key
openssl rand -hex 32
```

Copy the output and use it as your `ADMIN_API_KEY`.

4. **Restart the server:**

```bash
./quick-deploy.sh
```

### Accessing the Admin Panel

1. Visit: `https://fastt.chat/admin`

2. On first visit, you'll be prompted for the API key

3. Enter your `ADMIN_API_KEY` from the .env file

4. The key is stored in your browser's localStorage for future visits

5. To reset/logout: Clear your browser's localStorage or use a different browser/incognito window

### API Key Security

- ✅ **Never commit** `.env` to git (it's in .gitignore)
- ✅ **Use a strong random key** (at least 32 characters)
- ✅ **Share securely** with team members who need admin access
- ✅ **Rotate periodically** for better security

### Testing

Test that the admin endpoints are protected:

```bash
# Without API key (should return 401)
curl https://fastt.chat/admin/api/stats

# With API key (should return data)
curl -H "X-API-Key: your-api-key-here" https://fastt.chat/admin/api/stats
```

## Features Protected

All admin API endpoints now require authentication:
- `/admin/api/stats` - Overall statistics
- `/admin/api/messages` - Recent messages
- `/admin/api/rooms` - Room list
- `/admin/api/pageviews` - Page view analytics
- `/admin/api/performance` - Performance metrics

The admin HTML page (`/admin`) is still publicly accessible but cannot load data without a valid API key.

