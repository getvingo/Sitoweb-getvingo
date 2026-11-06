#!/bin/zsh
# Gira SUL MAC. Copia il portale sul VPS e lo installa/aggiorna.
# uso: ./deploy/pubblica.sh <ip-del-server> <dominio> [demo]
#   es. ./deploy/pubblica.sh 123.45.67.89 demo.getvingo.it demo
# Il primo invio copia anche i dati attuali (auto, DDT, foto); quelli dopo
# aggiornano solo il programma e non toccano mai i dati presenti sul server.
set -e
if [[ -z $1 || -z $2 ]]; then
  echo "uso: ./deploy/pubblica.sh <ip-del-server> <dominio> [demo]"; exit 1
fi
SERVER="root@$1"; DOMINIO="$2"; DEMO="$3"
cd "$(dirname "$0")/.."
# una sola connessione SSH per tutto: la password si chiede una volta
SSH_OPT=(-o ControlMaster=auto -o ControlPath=/tmp/getvingo-ssh-%r@%h -o ControlPersist=120 -o StrictHostKeyChecking=accept-new)

echo "== Connessione a $1 (password di root del VPS)"
ssh "${SSH_OPT[@]}" $SERVER "mkdir -p /opt/getvingo/app/instance"

echo "== Copia del programma"
rsync -az --delete -e "ssh ${SSH_OPT[*]}" \
  --exclude .venv --exclude .tools --exclude instance --exclude __pycache__ --exclude '*.pyc' --exclude tests \
  ./ $SERVER:/opt/getvingo/app/

echo "== Copia dei dati (solo se sul server non ci sono ancora)"
rsync -az --ignore-existing -e "ssh ${SSH_OPT[*]}" \
  --exclude secret_key --exclude '*.log' instance/ $SERVER:/opt/getvingo/app/instance/

echo "== Installazione sul server"
ssh "${SSH_OPT[@]}" $SERVER "bash /opt/getvingo/app/deploy/installa-server.sh $DOMINIO $DEMO"
ssh "${SSH_OPT[@]}" -O exit $SERVER 2>/dev/null || true
