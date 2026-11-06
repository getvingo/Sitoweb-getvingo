#!/bin/bash
# Gira SUL SERVER (Ubuntu 22.04/24.04, utente root). Lo lancia pubblica.sh dal Mac.
# Installa o aggiorna Getvingo: Python + gunicorn come servizio, Caddy davanti con HTTPS automatico.
# uso: installa-server.sh <dominio> [demo]
set -euo pipefail
DOMINIO="$1"
DEMO="${2:-}"
APP=/opt/getvingo/app

echo "== Pacchetti di sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3 python3-venv rsync curl debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

# Server installato quando il portale si chiamava MOVINTA: spegne il vecchio servizio e porta
# nella nuova cartella i dati del server (vincono su quelli appena copiati dal Mac)
if [ -d /opt/movinta ]; then
  echo "== Passaggio dal vecchio nome MOVINTA"
  systemctl disable --now movinta >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/movinta.service
  mkdir -p $APP/instance
  if [ -f /opt/movinta/app/instance/movinta.db ]; then
    cp -a /opt/movinta/app/instance/movinta.db $APP/instance/dovin.db
  fi
  if [ -d /opt/movinta/app/instance/foto ]; then
    cp -a /opt/movinta/app/instance/foto/. $APP/instance/foto/ 2>/dev/null || cp -a /opt/movinta/app/instance/foto $APP/instance/
  fi
  if [ -f /etc/movinta.env ] && [ ! -f /etc/getvingo.env ]; then
    sed 's/^MOVINTA_/DOVIN_/' /etc/movinta.env > /etc/getvingo.env && chmod 600 /etc/getvingo.env
  fi
  mv /opt/movinta /opt/movinta.vecchio   # copia di sicurezza, da cancellare a mano
fi

# Server installato quando il portale si chiamava DOVIN: spegne il vecchio servizio e porta
# nella nuova cartella i dati del server (vincono su quelli appena copiati dal Mac)
if [ -d /opt/dovin ]; then
  echo "== Passaggio dal vecchio nome DOVIN"
  systemctl disable --now dovin >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/dovin.service /etc/cron.d/dovin
  mkdir -p $APP/instance
  if [ -d /opt/dovin/app/instance ]; then
    cp -a /opt/dovin/app/instance/. $APP/instance/
  fi
  if [ -f /etc/dovin.env ] && [ ! -f /etc/getvingo.env ]; then
    cp -a /etc/dovin.env /etc/getvingo.env
  fi
  mv /opt/dovin /opt/dovin.vecchio   # copia di sicurezza, da cancellare a mano
fi

echo "== Utente e ambiente Python"
id getvingo >/dev/null 2>&1 || useradd --system --home /opt/getvingo --shell /usr/sbin/nologin getvingo
python3 -m venv /opt/getvingo/venv
/opt/getvingo/venv/bin/pip install -q --upgrade pip
/opt/getvingo/venv/bin/pip install -q -r $APP/requirements.txt gunicorn
mkdir -p $APP/instance/foto
chown -R getvingo:getvingo /opt/getvingo

echo "== Configurazione"
if [ ! -f /etc/getvingo.env ]; then
  cat > /etc/getvingo.env <<CONF
DOVIN_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
DOVIN_BASE_URL=https://$DOMINIO
DOVIN_DEMO=$([ "$DEMO" = "demo" ] && echo 1 || echo 0)
# Per l'assistente IA togli il # e incolla la chiave:
#ANTHROPIC_API_KEY=sk-ant-...
CONF
  chmod 600 /etc/getvingo.env
fi
sed -i "s#^DOVIN_BASE_URL=.*#DOVIN_BASE_URL=https://$DOMINIO#" /etc/getvingo.env
if ! grep -q DOVIN_S3_BUCKET /etc/getvingo.env; then
  cat >> /etc/getvingo.env <<CONF
# Archivio PDF dei DDT su storage S3 compatibile (vedi GUIDA-HOSTINGER.txt). Senza: cartella sul server
#DOVIN_S3_BUCKET=
#DOVIN_S3_ENDPOINT=
#DOVIN_S3_REGIONE=auto
#DOVIN_S3_CHIAVE_ID=
#DOVIN_S3_SEGRETO=
CONF
fi

# ogni ora recupera le copie dei DDT non arrivate all'archivio; ogni notte il backup
cat > /etc/cron.d/getvingo <<CRON
15 * * * * getvingo cd $APP && set -a && . /etc/getvingo.env && /opt/getvingo/venv/bin/flask --app getvingo archivia-ddt >/dev/null 2>&1
30 3 * * * getvingo cd $APP && set -a && . /etc/getvingo.env && /opt/getvingo/venv/bin/flask --app getvingo backup >/dev/null 2>&1
CRON

cat > /etc/systemd/system/getvingo.service <<UNIT
[Unit]
Description=Getvingo portale
After=network.target

[Service]
User=getvingo
WorkingDirectory=$APP
EnvironmentFile=/etc/getvingo.env
ExecStart=/opt/getvingo/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8000 --forwarded-allow-ips=127.0.0.1 "getvingo:create_app()"
Restart=always

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$DOMINIO {
    reverse_proxy 127.0.0.1:8000
}
CADDY

# primo avvio senza database: crea tabelle e dati demo
if [ ! -f $APP/instance/dovin.db ]; then
  echo "== Database demo"
  sudo -u getvingo bash -c "cd $APP && set -a && . /etc/getvingo.env && /opt/getvingo/venv/bin/flask --app getvingo demo"
fi

if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80,443/tcp >/dev/null; fi

systemctl daemon-reload
systemctl enable --now getvingo >/dev/null
systemctl restart getvingo
systemctl reload caddy || systemctl restart caddy

sleep 2
if curl -fsS -o /dev/null http://127.0.0.1:8000/login; then
  echo ""
  echo "=============================================================="
  echo " GETVINGO ONLINE:   https://$DOMINIO"
  echo " LINK ADESIVI NFC: https://$DOMINIO/admin/tag"
  echo "=============================================================="
  echo " (il certificato HTTPS può richiedere 1-2 minuti al primo avvio)"
else
  echo "ATTENZIONE: il portale non risponde. Log:"; journalctl -u getvingo -n 30 --no-pager
fi
