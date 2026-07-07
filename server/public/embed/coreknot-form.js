(function () {
  var script = document.currentScript;
  if (!script) return;

  var formKey = script.getAttribute('data-form-key');
  var targetSel = script.getAttribute('data-target');
  var apiBase = script.getAttribute('data-api-base');
  if (!formKey) {
    console.error('[CoreKnot] data-form-key is required');
    return;
  }

  if (!apiBase) {
    try {
      apiBase = new URL(script.src).origin;
    } catch (e) {
      apiBase = '';
    }
  }
  apiBase = apiBase.replace(/\/$/, '');

  var form = targetSel ? document.querySelector(targetSel) : null;
  if (!form) {
    form = document.createElement('form');
    form.innerHTML =
      '<label>Name <input name="name" required /></label>' +
      '<label>Email <input name="email" type="email" /></label>' +
      '<label>Phone <input name="phone" type="tel" /></label>' +
      '<label>Message <textarea name="message"></textarea></label>' +
      '<button type="submit">Send</button>';
    script.parentNode.insertBefore(form, script);
  }

  var honeypot = document.createElement('input');
  honeypot.type = 'text';
  honeypot.name = '_gotcha';
  honeypot.tabIndex = -1;
  honeypot.autocomplete = 'off';
  honeypot.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;width:0;';
  form.appendChild(honeypot);

  var status = document.createElement('div');
  status.setAttribute('data-coreknot-status', '1');
  status.style.marginTop = '8px';
  status.style.fontSize = '14px';
  form.appendChild(status);

  function setStatus(msg, ok) {
    status.textContent = msg;
    status.style.color = ok ? '#0a7a4b' : '#b42318';
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (honeypot.value) return;

    var fd = new FormData(form);
    var payload = {};
    fd.forEach(function (value, key) {
      if (key === '_gotcha') return;
      payload[key] = value;
    });

    setStatus('Sending…', true);
    fetch(apiBase + '/api/public/forms/' + encodeURIComponent(formKey) + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CoreKnot-Form-Key': formKey },
      body: JSON.stringify(payload),
      mode: 'cors',
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error((data && data.error) || 'Submit failed');
          return data;
        });
      })
      .then(function () {
        setStatus('Thanks — we received your message.', true);
        form.reset();
      })
      .catch(function (err) {
        setStatus(err.message || 'Could not submit form.', false);
      });
  });
})();
