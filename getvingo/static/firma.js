// Riquadro firma col dito/mouse. Ogni .firma-pad scrive un PNG (data URL) nel suo input nascosto.
(function () {
  document.querySelectorAll('.firma-pad').forEach(function (box) {
    var canvas = box.querySelector('canvas');
    var input = box.querySelector('input[type=hidden]');
    var cancella = box.querySelector('[data-cancella]');
    var ctx = canvas.getContext('2d');
    var disegnando = false, vuota = true, ultimo = null;

    function dimensiona() {
      var r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1C1533';
      vuota = true; input.value = ''; box.classList.remove('firmata');
    }
    function punto(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointerdown', function (e) {
      disegnando = true; ultimo = punto(e); canvas.setPointerCapture(e.pointerId); e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!disegnando) return;
      var p = punto(e);
      ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ultimo = p; vuota = false;
    });
    function fine() {
      if (!disegnando) return;
      disegnando = false;
      if (!vuota) { input.value = canvas.toDataURL('image/png'); box.classList.add('firmata'); }
    }
    canvas.addEventListener('pointerup', fine);
    canvas.addEventListener('pointercancel', fine);
    if (cancella) cancella.addEventListener('click', function () { dimensiona(); });

    var form = box.closest('form');
    if (form && box.dataset.obbligatoria !== undefined) {
      form.addEventListener('submit', function (e) {
        // il bottone "predisponi" non richiede firma
        var invio = e.submitter;
        if (invio && invio.dataset.senzaFirma !== undefined) return;
        if (!input.value) {
          e.preventDefault(); e.stopImmediatePropagation();
          box.classList.add('manca');
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, true);
    }
    dimensiona();
    window.addEventListener('resize', function () { if (vuota) dimensiona(); });
  });
})();
