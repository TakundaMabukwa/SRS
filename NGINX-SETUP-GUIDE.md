# Nginx SSL Setup Guide for Digital Ocean

## Option 1: Self-Signed Certificates (Quick Setup)

### On droplet 64.227.126.176:
```bash
# SSH into your droplet
ssh root@64.227.126.176

# Upload and run the setup script
chmod +x setup-nginx-ssl.sh
./setup-nginx-ssl.sh
```

### On droplet 64.227.138.235:
```bash
# SSH into your droplet
ssh root@64.227.138.235

# Run similar setup
apt update && apt install -y nginx
mkdir -p /etc/letsencrypt/live/64.227.138.235
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/letsencrypt/live/64.227.138.235/privkey.pem \
  -out /etc/letsencrypt/live/64.227.138.235/fullchain.pem \
  -subj "/C=ZA/ST=Gauteng/L=Johannesburg/O=EPS/CN=64.227.138.235"
```

**Note:** Self-signed certificates will show browser warnings. You'll need to accept them.

---

## Option 2: Domain Names + Let's Encrypt (Production Ready)

### Prerequisites:
1. Register domain names (e.g., api.yourcompany.com, canbus.yourcompany.com)
2. Point DNS A records to your droplet IPs

### Setup with domain:
```bash
# On droplet 64.227.126.176
apt update && apt install -y nginx certbot python3-certbot-nginx

# Get real SSL certificate
certbot --nginx -d api.yourcompany.com -d canbus.yourcompany.com

# Nginx config with domain
cat > /etc/nginx/sites-available/ssl-proxy << 'EOF'
server {
    listen 443 ssl;
    server_name api.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/api.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl;
    server_name canbus.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/canbus.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/canbus.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/ssl-proxy /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

### Update .env.local:
```env
NEXT_PUBLIC_HTTP_SERVER_ENDPOINT=https://api.yourcompany.com
NEXT_PUBLIC_CAN_BUS_ENDPOINT=https://canbus.yourcompany.com
NEXT_PUBLIC_VEHICLE_API_ENDPOINT=https://vehicles.yourcompany.com/api/eps-vehicles
NEXT_PUBLIC_CRTACK_VEHICLE_API_ENDPOINT=https://canbus.yourcompany.com/api/ctrack/data
```

---

## Option 3: Quick Fix - Use HTTP in Development

If you're testing locally, revert .env.local to HTTP and access your app via HTTP:

```env
# Use http:// instead of https://
NEXT_PUBLIC_VEHICLE_API_ENDPOINT=http://64.227.138.235:3000/api/eps-vehicles
```

Access your app at: `http://localhost:3000` (not https)

---

## Troubleshooting

### Check nginx status:
```bash
systemctl status nginx
nginx -t
```

### View logs:
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Test SSL:
```bash
curl -k https://64.227.126.176:443
openssl s_client -connect 64.227.126.176:443
```

### Firewall:
```bash
ufw status
ufw allow 443/tcp
ufw allow 3001/tcp
```
