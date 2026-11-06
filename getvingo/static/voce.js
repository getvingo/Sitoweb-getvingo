// Dettatura vocale con il riconoscimento del browser (Chrome, Safari su iPhone).
// Uso: DovinVoce.ascolta(bottone, function (testo, finale) {...})
window.DovinVoce = (function () {
  var Riconoscimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  var attivo = null;
  function supportato() { return !!Riconoscimento; }
  function ascolta(bottone, quandoTesto) {
    if (!Riconoscimento) {
      alert('La dettatura vocale non è disponibile su questo browser: usa la tastiera (anche il microfono della tastiera del telefono funziona).');
      return;
    }
    if (attivo) { attivo.stop(); return; }
    var r = new Riconoscimento();
    r.lang = 'it-IT';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = function (e) {
      var testo = '', finale = false;
      for (var k = 0; k < e.results.length; k++) {
        testo += e.results[k][0].transcript;
        finale = e.results[k].isFinal;
      }
      quandoTesto(testo, finale);
    };
    r.onend = function () { attivo = null; bottone.classList.remove('ascolto'); };
    r.onerror = function () { attivo = null; bottone.classList.remove('ascolto'); };
    attivo = r;
    bottone.classList.add('ascolto');
    r.start();
  }
  function leggi(testo) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(testo);
    u.lang = 'it-IT';
    window.speechSynthesis.speak(u);
  }
  return { ascolta: ascolta, leggi: leggi, supportato: supportato };
})();
