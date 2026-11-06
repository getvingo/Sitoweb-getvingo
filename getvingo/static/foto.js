// Moduli con foto (danni): le foto si riducono sul telefono (max 1600 px, JPEG) prima dell'invio,
// così il caricamento è veloce anche con poca rete. Uso: <form data-foto data-foto-manca="...">
// con dentro input[type=file][data-foto-input], [data-foto-anteprime] e [data-foto-stato].
(function () {
  function riduci(file) {
    return new Promise(function (ok) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { ok(b); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { ok(null); };
      img.src = url;
    });
  }

  document.querySelectorAll('form[data-foto]').forEach(function (form) {
    var input = form.querySelector('[data-foto-input]'), anteprime = form.querySelector('[data-foto-anteprime]');
    var stato = form.querySelector('[data-foto-stato]'), ridotte = [];
    function avviso(testo) { stato.textContent = testo; stato.style.color = 'var(--errore)'; }

    input.addEventListener('change', function () {
      stato.textContent = 'Preparo le foto…'; stato.style.color = '';
      Promise.all(Array.prototype.map.call(input.files, riduci)).then(function (blob) {
        blob.forEach(function (b) {
          if (!b) return;
          ridotte.push(b);
          var im = document.createElement('img'); im.src = URL.createObjectURL(b); anteprime.appendChild(im);
        });
        stato.textContent = ridotte.length + (ridotte.length === 1 ? ' foto pronta' : ' foto pronte') + '. Puoi aggiungerne altre.';
        input.value = '';
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ridotte.length) { avviso(form.dataset.fotoManca || 'Serve almeno una foto.'); return; }
      if (!form.reportValidity()) return;
      if (form.dataset.invio) return;  // niente doppio invio con un doppio tocco
      form.dataset.invio = '1';
      var dati = new FormData(form);
      ridotte.forEach(function (b, k) { dati.append('foto', b, 'foto' + k + '.jpg'); });
      stato.textContent = 'Invio in corso…'; stato.style.color = '';
      fetch(form.action || location.href, { method: 'POST', body: dati, headers: { 'X-Dovin': '1', 'X-CSRF': window.DOVIN_CSRF } })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (r.vai) { location.href = r.vai; return; }
          delete form.dataset.invio;
          avviso(r.errore || 'Invio non riuscito.');
        })
        .catch(function () { delete form.dataset.invio; avviso('Invio non riuscito: controlla la rete e riprova.'); });
    }, true);
  });
})();
