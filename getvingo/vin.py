import re

# 17 caratteri, lettere I, O, Q escluse dallo standard ISO 3779
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")


def normalizza(vin):
    """Pulisce un VIN letto da OCR o digitato: maiuscolo, senza spazi/trattini,
    e corregge le confusioni tipiche (O->0, I->1, Q->0) visto che quelle
    lettere non possono comparire in un VIN."""
    vin = re.sub(r"[\s\-\.]", "", (vin or "").upper())
    return vin.translate(str.maketrans({"O": "0", "I": "1", "Q": "0"}))


def valido(vin):
    return bool(VIN_RE.match(vin or ""))
