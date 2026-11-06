# Contenitore del portale getVINgo (Google Cloud Run o qualsiasi servizio che avvia container).
# Dati, foto e segreti NON sono qui dentro: arrivano da variabili d'ambiente e dalla cartella DOVIN_DATI.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FLASK_APP=getvingo
WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY getvingo ./getvingo

# Cloud Run indica la porta in $PORT (8080 se assente)
CMD exec gunicorn --bind ":${PORT:-8080}" --workers 2 --threads 4 --timeout 120 "getvingo:create_app()"
