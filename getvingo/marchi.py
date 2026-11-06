"""Loghi delle marche auto (Stock e schede).

Precedenza: file ufficiale caricato in Gestione (sala stampa della casa) > logo preso dal sito ufficiale della casa
> catalogo aperto incluso > download automatico. Catalogo e download automatico: Simple Icons (loghi ufficiali nella versione più recente, vettoriali) e, per le marche
che non ha, il catalogo car-logos-dataset. I loghi inclusi stanno in static/marchi; quelli di marche nuove
si scaricano da soli quando entra un'auto di quella marca e finiscono in instance/marchi."""
import os
import re
import unicodedata
import urllib.request

from flask import current_app, url_for

SIMPLE_ICONS = "https://cdn.jsdelivr.net/npm/simple-icons@16.36.0/icons/{}.svg"
CAR_LOGOS = "https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@2.5.0/logos/optimized/{}.png"
ALIAS = {"vw": "volkswagen", "mercedes": "mercedes-benz", "alfa": "alfa-romeo", "range rover": "land-rover",
         "ds automobiles": "ds", "citroën": "citroen", "škoda": "skoda"}
ESTENSIONI = ("svg", "png")


def chiave(marca):
    """Nome del file del logo: 'Alfa Romeo' -> 'alfa-romeo' (senza accenti)."""
    testo = unicodedata.normalize("NFKD", (marca or "").strip().lower()).encode("ascii", "ignore").decode()
    testo = ALIAS.get(testo, testo)
    return re.sub(r"[^a-z0-9]+", "-", testo).strip("-")


# dove cercare un logo, in ordine di precedenza: (fonte, base, sottocartella)
FONTI = (("caricato", "instance", "marchi/ufficiali"),   # file ufficiale caricato in Gestione
         ("sito", "static", "marchi/ufficiali"),          # preso dal sito ufficiale della casa
         ("incluso", "static", "marchi"),                 # Simple Icons / catalogo, incluso nel portale
         ("scaricato", "instance", "marchi"))             # scaricato in automatico per una marca nuova
NOMI_FONTE = {"caricato": "Ufficiale · caricato in Gestione", "sito": "Ufficiale · dal sito della casa",
              "incluso": "Non ufficiale · catalogo aperto", "scaricato": "Non ufficiale · scaricato in automatico"}
ESTENSIONI_TUTTE = ("svg", "png", "webp", "jpg")


def _cartella(base, sotto):
    radice = current_app.instance_path if base == "instance" else os.path.join(current_app.root_path, "static")
    return os.path.join(radice, *sotto.split("/"))


def _cartelle():
    return (("static", _cartella("static", "marchi")), ("scaricati", _cartella("instance", "marchi")))


def trova(marca):
    """(fonte, url) del logo della marca, oppure (None, None)."""
    k = chiave(marca)
    if not k:
        return None, None
    for fonte, base, sotto in FONTI:
        for est in ESTENSIONI_TUTTE:
            if os.path.exists(os.path.join(_cartella(base, sotto), f"{k}.{est}")):
                if base == "static":
                    return fonte, url_for("static", filename=f"{sotto}/{k}.{est}")
                nome = f"ufficiali/{k}.{est}" if sotto.endswith("ufficiali") else f"{k}.{est}"
                return fonte, url_for("main.logo_marca", nome=nome)
    return None, None


def url(marca):
    """Indirizzo del logo della marca, oppure None (si mostrano le iniziali)."""
    return trova(marca)[1]


def salva_ufficiale(marca, dati, nome_file):
    """File ufficiale caricato in Gestione (dalla sala stampa della casa): ha la precedenza su tutti."""
    k = chiave(marca)
    est = (nome_file.rsplit(".", 1)[-1] if "." in nome_file else "").lower()
    est = "jpg" if est == "jpeg" else est
    firme = {"png": b"\x89PNG", "jpg": b"\xff\xd8", "webp": b"RIFF"}
    if not k:
        raise ValueError("Marca non valida.")
    if len(dati) > 1_000_000:
        raise ValueError("Il file è troppo grande (massimo 1 MB).")
    if est == "svg":
        testo = dati.decode("utf-8", errors="ignore").lower()
        if "<svg" not in testo or re.search(r"<script|\son\w+\s*=|javascript:|<foreignobject|href\s*=\s*[\"']https?:", testo):
            raise ValueError("Il file SVG non è valido o contiene codice: usa il file originale della casa.")
    elif est not in firme or not dati.startswith(firme[est]):
        raise ValueError("Formato non supportato: carica un file SVG, PNG, WebP o JPG.")
    rimuovi_ufficiale(marca)
    cartella = _cartella("instance", "marchi/ufficiali")
    os.makedirs(cartella, exist_ok=True)
    with open(os.path.join(cartella, f"{k}.{est}"), "wb") as f:
        f.write(dati)


def rimuovi_ufficiale(marca):
    k = chiave(marca)
    for est in ESTENSIONI_TUTTE:
        percorso = os.path.join(_cartella("instance", "marchi/ufficiali"), f"{k}.{est}")
        if os.path.exists(percorso):
            os.remove(percorso)


def _scarica(indirizzo):
    try:
        with urllib.request.urlopen(urllib.request.Request(indirizzo, headers={"User-Agent": "Getvingo"}), timeout=4) as r:
            dati = r.read(300_000)
        return dati if dati.startswith((b"<svg", b"\x89PNG")) else None
    except Exception:
        return None


def assicura(marca, forza=False):
    """Se la marca non ha ancora un logo lo scarica (Simple Icons, poi car-logos-dataset).
    Non blocca mai: senza rete o senza logo restano le iniziali. Ritorna True se il logo c'è."""
    if not current_app.config.get("MARCHI_SCARICA", True):
        return url(marca) is not None
    k = chiave(marca)
    if not k or (url(marca) and not forza):
        return bool(k and url(marca))
    for indirizzo, est in ((SIMPLE_ICONS.format(k.replace("-", "")), "svg"), (CAR_LOGOS.format(k), "png")):
        dati = _scarica(indirizzo)
        if dati:
            cartella = _cartelle()[1][1]
            os.makedirs(cartella, exist_ok=True)
            with open(os.path.join(cartella, f"{k}.{est}"), "wb") as f:
                f.write(dati)
            return True
    return False
