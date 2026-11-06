"""Copia di sicurezza: database e foto dei danni in un unico zip con data e ora.
Tiene solo le ultime copie (le più vecchie vengono cancellate)."""
import os
import sqlite3
import tempfile
import zipfile
from datetime import datetime

from .models import db


def esegui(cartella, da_tenere=14):
    url = db.engine.url
    if url.get_backend_name() != "sqlite":
        raise RuntimeError("Con Postgres i backup li fa il servizio che ospita il database "
                           "(oppure: pg_dump). Questo comando copia solo database SQLite.")
    os.makedirs(cartella, exist_ok=True)
    nome = os.path.join(cartella, datetime.now().strftime("dovin-%Y%m%d-%H%M%S.zip"))
    from flask import current_app
    with tempfile.TemporaryDirectory() as tmp:
        copia = os.path.join(tmp, "dovin.db")
        # copia coerente anche mentre il portale sta scrivendo
        with sqlite3.connect(url.database) as sorgente, sqlite3.connect(copia) as dest:
            sorgente.backup(dest)
        with zipfile.ZipFile(nome, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(copia, "dovin.db")
            foto = current_app.config["FOTO_DIR"]
            for f in sorted(os.listdir(foto)):
                z.write(os.path.join(foto, f), os.path.join("foto", f))
            # archivio DDT locale (senza S3): anche le copie PDF finiscono nel backup
            archivio = current_app.config["ARCHIVIO_DIR"]
            for radice, _, file in os.walk(archivio):
                for f in sorted(file):
                    z.write(os.path.join(radice, f), os.path.join("archivio-ddt", os.path.relpath(
                        os.path.join(radice, f), archivio)))
    vecchi = sorted(f for f in os.listdir(cartella) if f.startswith("dovin-") and f.endswith(".zip"))
    for f in vecchi[:-da_tenere]:
        os.remove(os.path.join(cartella, f))
    return nome
