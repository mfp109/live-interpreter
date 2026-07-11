#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID}" -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
: "${GATEWAY_DOMAIN:?Set GATEWAY_DOMAIN}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL}"
: "${GATEWAY_ENV_FILE:?Set GATEWAY_ENV_FILE}"
[[ "$GATEWAY_DOMAIN" =~ ^[a-z0-9.-]+$ ]] || { echo "Invalid gateway domain." >&2; exit 1; }
[[ "$CERTBOT_EMAIL" == *@* ]] || { echo "Invalid Certbot email." >&2; exit 1; }
[[ -f "$GATEWAY_ENV_FILE" ]] || { echo "Gateway env file not found." >&2; exit 1; }
SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io nginx certbot python3-certbot-nginx
systemctl enable --now docker nginx
install -d -m 0755 /opt/live-interpreter-gateway
install -m 0644 "$SOURCE_ROOT/Dockerfile" "$SOURCE_ROOT/package.json" "$SOURCE_ROOT/package-lock.json" /opt/live-interpreter-gateway/
rm -rf /opt/live-interpreter-gateway/src
cp -R "$SOURCE_ROOT/src" /opt/live-interpreter-gateway/src
install -m 0600 "$GATEWAY_ENV_FILE" /etc/live-interpreter-gateway.env
install -m 0644 "$SOURCE_ROOT/deploy/live-interpreter-gateway.service" /etc/systemd/system/live-interpreter-gateway.service
sed "s/__GATEWAY_DOMAIN__/$GATEWAY_DOMAIN/g" "$SOURCE_ROOT/deploy/nginx.conf" > /etc/nginx/sites-available/live-interpreter-gateway
ln -sfn /etc/nginx/sites-available/live-interpreter-gateway /etc/nginx/sites-enabled/live-interpreter-gateway
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
systemctl daemon-reload
systemctl enable --now live-interpreter-gateway
certbot --nginx --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" -d "$GATEWAY_DOMAIN"
curl --fail --silent --show-error "https://$GATEWAY_DOMAIN/health"
echo
echo "Gateway installation complete."
