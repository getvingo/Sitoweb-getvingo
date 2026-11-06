#!/bin/zsh
# Avvia il portale e un tunnel HTTPS pubblico (Cloudflare) per provare la demo
# dal telefono anche in rete mobile. Chiudi con Ctrl+C: si fermano entrambi.
cd "$(dirname "$0")"

lsof -ti tcp:5050 | xargs kill 2>/dev/null
DOVIN_DEMO=1 .venv/bin/flask --app getvingo run --port 5050 > instance/portale.log 2>&1 &
PORTALE=$!
trap 'kill $PORTALE 2>/dev/null' EXIT INT TERM

echo "Avvio in corso…"
.tools/cloudflared tunnel --url http://127.0.0.1:5050 2>&1 | while read -r riga; do
  url=$(echo "$riga" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com')
  if [[ -n $url ]]; then
    echo ""
    echo "=============================================================="
    echo " PORTALE ONLINE:    $url"
    echo " LINK ADESIVI NFC:  $url/admin/tag"
    echo "=============================================================="
    echo " Lascia aperta questa finestra. Ctrl+C per chiudere tutto."
    echo " Ogni riavvio cambia indirizzo: gli adesivi vanno riscritti."
    echo ""
  fi
  [[ $riga == *ERR* ]] && echo "$riga"
done
