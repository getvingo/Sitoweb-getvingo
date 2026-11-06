(function () {
  function postJson(url, corpo) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF': window.DOVIN_CSRF || '' },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      return r.json().catch(function () { return { errore: 'Risposta non valida dal server.' }; });
    }).catch(function () { return { errore: 'Connessione assente.' }; });
  }

  // ---------------- assistente che compila il DDT ----------------
  var box = document.getElementById('assistente-ddt');
  if (box) {
    var area = box.querySelector('textarea');
    var mic = box.querySelector('[data-mic]');
    var vai = box.querySelector('[data-compila]');
    var esito = box.querySelector('.esito');
    var form = document.getElementById('form-partenza');
    function imposta(nome, valore) {
      var el = form.querySelector('[name=' + nome + ']');
      if (!el || valore === undefined || valore === null || valore === '' || valore === 0) return false;
      el.value = String(valore);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      var campo = el.closest('.campo');
      if (campo) campo.classList.add('compilato');
      return true;
    }
    function compila() {
      var testo = area.value.trim();
      if (!testo) { area.focus(); return; }
      vai.disabled = true; esito.textContent = 'Sto compilando…';
      postJson('/api/assistente/ddt', { veicolo_id: box.dataset.veicolo, testo: testo }).then(function (r) {
        vai.disabled = false;
        if (r.errore) { esito.innerHTML = ''; esito.textContent = r.errore; esito.style.color = 'var(--errore)'; return; }
        var c = r.campi;
        ['a_sede_id', 'lavorazione', 'causale', 'vettore_id', 'conducente', 'lavorazione_note'].forEach(function (k) { imposta(k, c[k]); });
        esito.style.color = '';
        esito.innerHTML = '';
        var p = document.createElement('div'); p.textContent = '✓ ' + c.riepilogo; esito.appendChild(p);
        if (c.dubbi) { var d = document.createElement('div'); d.style.color = 'var(--viaggio)'; d.textContent = 'Da controllare: ' + c.dubbi; esito.appendChild(d); }
        var dettagli = document.getElementById('dettagli-partenza'); if (dettagli) dettagli.open = true;
        var firma = form.querySelector('.firma-pad'); if (firma) firma.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    vai.addEventListener('click', compila);
    mic.addEventListener('click', function () {
      DovinVoce.ascolta(mic, function (testo, finale) { area.value = testo; if (finale) compila(); });
    });
  }

  // ---------------- chat nella barra della panoramica ----------------
  var contenitore = document.getElementById('chiedi');
  if (!contenitore) return;
  // tocco o clic fuori dalla chat: si richiude da sola
  document.addEventListener('pointerdown', function (e) {
    if (contenitore.classList.contains('aperta') && !contenitore.contains(e.target)) contenitore.classList.remove('aperta');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') contenitore.classList.remove('aperta'); });
  if (!contenitore.dataset.ia) {
    // assistente non attivo: il pannello spiega perché, la barra cerca le auto (anche a voce)
    var barra = document.getElementById('chat-form'), campo = document.getElementById('chat-testo');
    var micRicerca = document.getElementById('chat-mic');
    campo.addEventListener('focus', function () { contenitore.classList.add('aperta'); });
    document.getElementById('chat-chiudi').addEventListener('click', function () { contenitore.classList.remove('aperta'); });
    micRicerca.addEventListener('click', function () {
      contenitore.classList.add('aperta');
      DovinVoce.ascolta(micRicerca, function (testo, finale) { campo.value = testo; if (finale) barra.submit(); });
    });
    return;
  }
  var lista = document.getElementById('chat-msg');
  var formChat = document.getElementById('chat-form');
  var input = document.getElementById('chat-testo');
  var micChat = document.getElementById('chat-mic');
  var voce = document.getElementById('chat-voce');
  var leggiAdAltaVoce = false;
  var storia = [];
  try { leggiAdAltaVoce = localStorage.getItem('dovin-voce') === '1'; } catch (e) {}
  function aggiornaVoce() { voce.classList.toggle('attivo', leggiAdAltaVoce); }
  aggiornaVoce();

  function apri() { contenitore.classList.add('aperta'); }
  function aggiungi(classe, testo) {
    var m = document.createElement('div'); m.className = 'm ' + classe; m.textContent = testo;
    lista.appendChild(m); lista.scrollTop = lista.scrollHeight; return m;
  }
  function chiedi(domanda) {
    domanda = (domanda || '').trim(); if (!domanda) return;
    apri();
    var sug = lista.querySelector('.suggerimenti'); if (sug) sug.remove();
    aggiungi('utente', domanda);
    storia.push({ ruolo: 'utente', testo: domanda });
    var attesa = aggiungi('assistente', '…');
    postJson('/api/assistente/chat', { messaggi: storia }).then(function (r) {
      if (r.errore) { attesa.className = 'm assistente errore'; attesa.textContent = r.errore; storia.pop(); return; }
      attesa.textContent = r.risposta;
      storia.push({ ruolo: 'assistente', testo: r.risposta });
      if (r.veicoli && r.veicoli.length) {
        var riga = document.createElement('div'); riga.className = 'auto-link';
        r.veicoli.forEach(function (v) {
          var a = document.createElement('a'); a.className = 'chip'; a.href = v.url; a.textContent = v.descrizione + ' · ' + v.vin; riga.appendChild(a);
        });
        attesa.appendChild(riga);
      }
      if (leggiAdAltaVoce) DovinVoce.leggi(r.risposta);
      lista.scrollTop = lista.scrollHeight;
    });
  }
  input.addEventListener('focus', apri);
  document.getElementById('chat-chiudi').addEventListener('click', function () { contenitore.classList.remove('aperta'); input.blur(); });
  voce.addEventListener('click', function () {
    leggiAdAltaVoce = !leggiAdAltaVoce; aggiornaVoce();
    try { localStorage.setItem('dovin-voce', leggiAdAltaVoce ? '1' : '0'); } catch (e) {}
  });
  formChat.addEventListener('submit', function (e) { e.preventDefault(); var t = input.value; input.value = ''; chiedi(t); });
  lista.addEventListener('click', function (e) { var b = e.target.closest('[data-domanda]'); if (b) chiedi(b.dataset.domanda); });
  micChat.addEventListener('click', function () {
    apri();
    DovinVoce.ascolta(micChat, function (testo, finale) {
      input.value = testo;
      if (finale) { leggiAdAltaVoce = true; aggiornaVoce(); input.value = ''; chiedi(testo); }
    });
  });
})();
