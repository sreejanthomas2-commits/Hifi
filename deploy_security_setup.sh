#!/bin/bash

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)."
  exit
fi

echo "=========================================="
echo " Optimizing & Securing 'Trending' Web "
echo "=========================================="

# 1. Update the System
echo "🔄 Updating system packages..."
apt update && apt upgrade -y

# 2. Tighten Server Security (Firewall)
echo "🛡️ Configuring Uncomplicated Firewall (UFW)..."
apt install ufw -y
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
# Open ports for encrypted real-time communication (WebRTC/WebSockets for calls/chats)
ufw allow 3000/tcp
ufw allow 5000:5100/udp
echo "y" | ufw enable

# 3. Prevent DDoS & Brute Force Attacks
echo "🛑 Installing Fail2Ban to block malicious IP addresses..."
apt install fail2ban -y
systemctl start fail2ban
systemctl enable fail2ban

# 4. Enforce Encryption (SSL/TLS for Chats & Calls)
# Replace 'yourdomain.com' with the actual domain of Trending
DOMAIN="yourdomain.com"
echo "🔐 Setting up Let's Encrypt SSL for $DOMAIN..."
apt install certbot python3-certbot-nginx -y
# Note: Un-comment the line below and add your actual email/domain to automate SSL
# certbot --nginx -d $DOMAIN --non-interactive --agree-tos --m admin@$DOMAIN

# 5. Speed Optimization (Gzip & Browser Caching via Nginx)
echo "⚡ Optimizing Nginx performance config..."
cat <<EOF > /etc/nginx/conf.d/trending_perf.conf
# Enable Gzip Compression
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;

# Security Headers to prevent hacking (XSS, Clickjacking)
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
EOF

systemctl restart nginx

echo "=========================================="
echo " ✅ Setup Complete! Trending is now faster and more secure. "
echo "=========================================="
