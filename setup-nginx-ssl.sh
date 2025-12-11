#!/bin/bash
# Run this script on your Digital Ocean droplet as root

echo "Installing nginx and certbot..."
apt update
apt install -y nginx certbot python3-certbot-nginx

echo "Stopping nginx temporarily..."
systemctl stop nginx

echo "Obtaining SSL certificate..."
# For IP-based SSL, we'll use self-signed certificates
# Let's Encrypt doesn't support IP addresses directly

# Generate self-signed certificate
mkdir -p /etc/letsencrypt/live/64.227.126.176
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/letsencrypt/live/64.227.126.176/privkey.pem \
  -out /etc/letsencrypt/live/64.227.126.176/fullchain.pem \
  -subj "/C=ZA/ST=Gauteng/L=Johannesburg/O=EPS/CN=64.227.126.176"

echo "Copying nginx configuration..."
# Copy the nginx-ssl-setup.conf to sites-available
cp nginx-ssl-setup.conf /etc/nginx/sites-available/ssl-proxy

echo "Enabling site..."
ln -sf /etc/nginx/sites-available/ssl-proxy /etc/nginx/sites-enabled/

echo "Testing nginx configuration..."
nginx -t

echo "Starting nginx..."
systemctl start nginx
systemctl enable nginx

echo "Opening firewall ports..."
ufw allow 443/tcp
ufw allow 3001/tcp

echo "Setup complete!"
echo "Note: Using self-signed certificates. Browsers will show security warnings."
echo "For production, consider using a domain name with Let's Encrypt."
