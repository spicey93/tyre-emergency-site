// Quote wizard runtime. Loaded by /quote/.
// Config (phone, pricing, origin coords, blocked dates etc.) is injected
// by quote.astro as a JSON blob in <script id="qw-config">.
(function () {
  var __cfgEl = document.getElementById('qw-config');
  if (!__cfgEl) return;
  var __cfg;
  try { __cfg = JSON.parse(__cfgEl.textContent); } catch (e) { return; }
  var phone = __cfg.phone;
  var telHref = __cfg.telHref;
  var origin = __cfg.origin;
  var pricing = __cfg.pricing;
  var blockedDates = __cfg.blockedDates;
  var bookingDaysAhead = __cfg.bookingDaysAhead;

  var POSTCODE_RE = /^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})$/i;
  var OUTCODE_RE  = /^([A-Z]{1,2}\d{1,2}[A-Z]?)$/i;

  var wiz = document.getElementById('qw-wizard');
  if (!wiz) return;

  // GTM/dataLayer instrumentation. Events are passive — they fire into
  // window.dataLayer where GTM tags pick them up. No PII (postcodes,
  // names, regs etc.) is sent — only service / step / price.
  function track(name, params) {
    try {
      (window.dataLayer = window.dataLayer || []).push(
        Object.assign({ event: name }, params || {})
      );
    } catch (e) {}
  }
  track('quote_started');

  var state = {
    service: '',
    postcode: '',
    miles: 0,
    vrm: '',
    lockers: '',
    total: 0,
    breakdown: [],
    slots: [],   // ['YYYY-MM-DD|AM', ...] max 2
    sameDay: false,
  };

  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || wiz).querySelectorAll(sel)); }

  // ---- Step navigation -------------------------------------------------
  var progressBar = $('qw-progress-bar');
  var progressMap = {
    'service-select': 5,
    'e-form': 50,
    'mf-postcode': 35,
    'mf-fee-warning': 70,
    'mf-out-of-area': 60,
    'caravan-redirect': 50,
    'p-postcode': 25,
    'p-quote': 60,
    'p-booking': 85,
    'p-contact': 95,
    'l-postcode': 20,
    'l-lockers': 40,
    'l-quote': 65,
    'l-booking': 85,
    'l-contact': 95,
  };

  function show(stepName) {
    $$('.qw-step').forEach(function (el) {
      var match = el.getAttribute('data-step') === stepName;
      el.hidden = !match;
      el.classList.toggle('is-active', match);
    });
    var pct = progressMap[stepName];
    if (pct == null) pct = 100;
    if (progressBar) progressBar.style.width = pct + '%';

    // Move focus to first input/button on the active step.
    var active = wiz.querySelector('.qw-step.is-active');
    if (active) {
      var first = active.querySelector('input, button[type="submit"], a.btn');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    }

    // Scroll the wizard top into view if user is well below it.
    var rect = wiz.getBoundingClientRect();
    if (rect.top < -20) {
      wiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function showError(id, msg) {
    var el = $(id);
    if (!el) return;
    if (msg) { el.textContent = msg; el.hidden = false; }
    else { el.textContent = ''; el.hidden = true; }
  }

  // ---- Distance helper -------------------------------------------------
  function milesBetween(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async function lookupPostcode(raw, errorElId, submitBtn) {
    showError(errorElId);
    raw = (raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!raw) { showError(errorElId, 'Please enter your postcode.'); return null; }
    var m = raw.match(POSTCODE_RE);
    if (!m) {
      if (OUTCODE_RE.test(raw)) {
        showError(errorElId, 'We need the full postcode (e.g. NG18 1AA), not just the first part.');
      } else {
        showError(errorElId, 'That doesn’t look like a UK postcode. Try something like NG18 1AA.');
      }
      return null;
    }
    var pretty = (m[1] + ' ' + m[2]).toUpperCase();
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Checking…'; }
    try {
      var res = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(pretty));
      if (res.status === 404) { showError(errorElId, 'We couldn’t find that postcode — double-check the spelling.'); return null; }
      if (!res.ok) { showError(errorElId, 'Couldn’t check your postcode just now. Try again, or ring us on ' + phone + '.'); return null; }
      var data = await res.json();
      var r = data && data.result;
      if (!r || typeof r.latitude !== 'number') { showError(errorElId, 'We couldn’t find that postcode — double-check the spelling.'); return null; }
      return { postcode: r.postcode || pretty, miles: milesBetween(origin.lat, origin.lon, r.latitude, r.longitude) };
    } catch (err) {
      showError(errorElId, 'Couldn’t check your postcode just now. Try again, or ring us on ' + phone + '.');
      return null;
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Next'; }
    }
  }

  // ---- Service select --------------------------------------------------
  $$('.qw-service').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var svc = btn.getAttribute('data-service');
      startService(svc);
    });
  });

  function startService(svc) {
    state.service = svc;
    track('quote_service_selected', { service: svc });
    if (svc === 'emergency') return show('e-form');
    if (svc === 'mobile-fitting' || svc === 'caravan') {
      updateMfPostcodeEyebrow();
      return show('mf-postcode');
    }
    if (svc === 'puncture') return show('p-postcode');
    if (svc === 'lwnr') return show('l-postcode');
  }

  // Honour ?service= deep-link, but only after the page has settled.
  (function applyDeepLink() {
    try {
      var params = new URLSearchParams(window.location.search);
      var svc = params.get('service');
      var valid = ['emergency','mobile-fitting','caravan','puncture','lwnr'];
      if (svc && valid.indexOf(svc) !== -1) startService(svc);
    } catch (e) {}
  })();

  // ---- Back / start-again ---------------------------------------------
  $$('.qw-back').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var to = btn.getAttribute('data-back');
      if (to) show(to);
    });
  });

  $$('.qw-back-to-start').forEach(function (btn) {
    btn.addEventListener('click', function () {
      resetState();
      show('service-select');
    });
  });

  function resetState() {
    state = { service: '', postcode: '', miles: 0, vrm: '', lockers: '', total: 0, breakdown: [], slots: [], sameDay: false };
    $$('input[type="text"], input[type="tel"], input[type="email"], textarea').forEach(function (i) { i.value = ''; });
    $$('input[type="radio"], input[type="checkbox"]').forEach(function (i) { i.checked = false; });
    $$('.qw-slot-btn.is-selected').forEach(function (b) { b.classList.remove('is-selected'); });
  }

  // ---- Mobile fitting + Caravan: shared postcode → fee-warning flow ----
  // Both services use the same external booking system and the same
  // distance-based mobile fee tiers, so they share these steps. The
  // service-specific labels are swapped in when the step is shown.
  function isBookingFlow() {
    return state.service === 'mobile-fitting' || state.service === 'caravan';
  }

  function serviceCopy() {
    if (state.service === 'caravan') {
      return {
        label: 'Caravan tyres',
        ooaService: 'Caravan tyre fitting (out of area)',
      };
    }
    return {
      label: 'Mobile tyre fitting',
      ooaService: 'Mobile tyre fitting (out of area)',
    };
  }

  var mfPcForm = $('qw-mf-postcode-form');
  if (mfPcForm) {
    mfPcForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var raw = $('qw-mf-postcode').value;
      var result = await lookupPostcode(raw, 'qw-mf-postcode-error', $('qw-mf-postcode-submit'));
      if (!result) return;
      state.postcode = result.postcode;
      state.miles = result.miles;
      var copy = serviceCopy();
      if (state.miles > pricing.mobileFitting.maxMiles) {
        $('qw-mf-ooa-postcode').value = state.postcode;
        $('qw-mf-ooa-miles').value = state.miles.toFixed(2);
        $('qw-mf-ooa-service').value = copy.ooaService;
        track('quote_postcode_out_of_area', { service: state.service });
        show('mf-out-of-area');
        return;
      }
      track('quote_postcode_in_area', { service: state.service });
      renderFeeWarning();
      show('mf-fee-warning');
    });
  }

  // Populate the eyebrow on the postcode step when entering it.
  function updateMfPostcodeEyebrow() {
    var el = $('qw-mf-postcode-eyebrow');
    if (!el) return;
    el.textContent = serviceCopy().label + ' · Step 1 of 2';
  }

  function renderFeeWarning() {
    var copy = serviceCopy();
    var eyebrow = $('qw-mf-warn-eyebrow');
    var dist = $('qw-mf-warn-distance');
    if (eyebrow) eyebrow.textContent = copy.label + ' · Step 2 of 2';
    if (dist) dist.textContent = 'You’re about ' + state.miles.toFixed(1) + ' miles from us.';
  }

  // ---- Puncture: postcode ---------------------------------------------
  var pPcForm = $('qw-p-postcode-form');
  if (pPcForm) {
    pPcForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var raw = $('qw-p-postcode').value;
      var result = await lookupPostcode(raw, 'qw-p-postcode-error', $('qw-p-postcode-submit'));
      if (!result) return;
      state.postcode = result.postcode;
      state.miles = result.miles;
      if (state.miles > pricing.puncture.maxMiles) {
        var pcEl = $('qw-p-ooa-postcode');
        var mEl = $('qw-p-ooa-miles');
        if (pcEl) pcEl.value = state.postcode;
        if (mEl) mEl.value = state.miles.toFixed(2);
        track('quote_postcode_out_of_area', { service: 'puncture' });
        show('p-out-of-area');
        return;
      }
      track('quote_postcode_in_area', { service: 'puncture' });
      buildPunctureQuote();
      show('p-quote');
    });
  }

  // ---- Puncture: build quote -----------------------------------------
  function calloutFor(miles, tiers) {
    for (var i = 0; i < tiers.length; i++) {
      if (miles <= tiers[i].maxMiles) return tiers[i];
    }
    return tiers[tiers.length - 1];
  }

  function fmt(n) {
    return '£' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
  }

  function buildPunctureQuote() {
    var repair = pricing.puncture.repair;
    var co = calloutFor(state.miles, pricing.puncture.callout);
    state.total = repair + co.amount;
    state.breakdown = [
      { label: 'Puncture repair', amount: repair },
      { label: 'Callout (' + state.miles.toFixed(1) + ' miles)', amount: co.amount },
    ];
    renderBreakdown('qw-p-breakdown', state.breakdown);
    var totalEl = $('qw-p-total');
    if (totalEl) totalEl.textContent = fmt(state.total);
    // Show the actual callout amount in the caveat + acknowledgment.
    var caveatEl = $('qw-p-callout-caveat');
    if (caveatEl) caveatEl.textContent = fmt(co.amount) + ' callout fee';
    var ackEl = $('qw-p-callout-ack');
    if (ackEl) ackEl.textContent = fmt(co.amount) + ' callout fee';
    track('quote_price_shown', { service: 'puncture', total: state.total });
  }

  function renderBreakdown(id, lines) {
    var el = $(id);
    if (!el) return;
    el.innerHTML = lines.map(function (l) {
      return '<li><span>' + l.label + '</span><span class="qw-quote-amount">' + fmt(l.amount) + '</span></li>';
    }).join('');
  }

  // ---- LWNR: postcode -------------------------------------------------
  var lPcForm = $('qw-l-postcode-form');
  if (lPcForm) {
    lPcForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var raw = $('qw-l-postcode').value;
      var result = await lookupPostcode(raw, 'qw-l-postcode-error', $('qw-l-postcode-submit'));
      if (!result) return;
      state.postcode = result.postcode;
      state.miles = result.miles;
      if (state.miles > pricing.lwnr.maxMiles) {
        var pcEl = $('qw-l-ooa-postcode');
        var mEl = $('qw-l-ooa-miles');
        if (pcEl) pcEl.value = state.postcode;
        if (mEl) mEl.value = state.miles.toFixed(2);
        track('quote_postcode_out_of_area', { service: 'lwnr' });
        show('l-out-of-area');
        return;
      }
      track('quote_postcode_in_area', { service: 'lwnr' });
      show('l-lockers');
    });
  }

  // ---- LWNR: lockers + quote -----------------------------------------
  var lLockersForm = $('qw-l-lockers-form');
  if (lLockersForm) {
    lLockersForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var checked = lLockersForm.querySelector('input[name="lockers"]:checked');
      if (!checked) return;
      state.lockers = checked.value;
      buildLwnrQuote();
      show('l-quote');
    });
  }

  function buildLwnrQuote() {
    var n = parseInt(state.lockers, 10) || 0;
    var perLocker = pricing.lwnr.perLocker;
    var lockerCost = n * perLocker;
    var co = calloutFor(state.miles, pricing.lwnr.callout);
    state.total = lockerCost + co.amount;
    state.breakdown = [
      { label: n + ' ' + (n === 1 ? 'locker' : 'lockers') + ' removed', amount: lockerCost },
      { label: 'Callout (' + state.miles.toFixed(1) + ' miles)', amount: co.amount },
    ];
    renderBreakdown('qw-l-breakdown', state.breakdown);
    var totalEl = $('qw-l-total');
    if (totalEl) totalEl.textContent = fmt(state.total);
    track('quote_price_shown', { service: 'lwnr', total: state.total });
  }

  // ---- Booking step: build slot list & wire same-day -----------------
  function isoDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function dayLabel(d) {
    var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
  }

  function nextWeekdays(n, blocked) {
    var out = [];
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    // Start from tomorrow; weekend bookings aren't offered.
    while (out.length < n) {
      d.setDate(d.getDate() + 1);
      var dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      var iso = isoDate(d);
      if (blocked.indexOf(iso) !== -1) continue;
      out.push({ iso: iso, label: dayLabel(d) });
    }
    return out;
  }

  function renderSlots(containerId, prefix) {
    var c = $(containerId);
    if (!c) return;
    var days = nextWeekdays(bookingDaysAhead, blockedDates);
    var rows = days.map(function (day) {
      return ''
        + '<div class="qw-slot-row">'
        +   '<span class="qw-slot-date">' + day.label + '</span>'
        +   '<button type="button" class="qw-slot-btn" data-slot="' + day.iso + '|AM">AM</button>'
        +   '<button type="button" class="qw-slot-btn" data-slot="' + day.iso + '|PM">PM</button>'
        + '</div>';
    });
    c.innerHTML = rows.join('');

    $$('.qw-slot-btn', c).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slot = btn.getAttribute('data-slot');
        var sameDayBox = $(prefix + '-sameday');
        if (btn.classList.contains('is-selected')) {
          btn.classList.remove('is-selected');
          state.slots = state.slots.filter(function (s) { return s !== slot; });
        } else {
          if (state.slots.length >= 2) {
            // Drop the oldest selection to make room.
            var oldest = state.slots.shift();
            var oldBtn = c.querySelector('.qw-slot-btn[data-slot="' + oldest + '"]');
            if (oldBtn) oldBtn.classList.remove('is-selected');
          }
          btn.classList.add('is-selected');
          state.slots.push(slot);
          if (sameDayBox && sameDayBox.checked) {
            sameDayBox.checked = false;
            state.sameDay = false;
          }
        }
      });
    });
  }

  function isBlockedToday() {
    var today = isoDate(new Date());
    return blockedDates.indexOf(today) !== -1;
  }

  function setupSameDay(prefix, wrapId) {
    var wrap = $(wrapId);
    var box = $(prefix + '-sameday');
    if (!wrap || !box) return;
    if (isBlockedToday()) {
      wrap.hidden = true;
      return;
    }
    box.addEventListener('change', function () {
      state.sameDay = box.checked;
      if (box.checked) {
        // Clear scheduled slots if user opts for same-day.
        state.slots = [];
        $$('.qw-slot-btn.is-selected').forEach(function (b) { b.classList.remove('is-selected'); });
        track('quote_same_day_selected', { service: state.service });
      }
    });
  }

  renderSlots('qw-p-slots', 'qw-p');
  renderSlots('qw-l-slots', 'qw-l');
  setupSameDay('qw-p', 'qw-p-sameday-wrap');
  setupSameDay('qw-l', 'qw-l-sameday-wrap');

  // ---- Quote → booking transition -------------------------------------
  $$('.qw-to-booking').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.getAttribute('data-next');
      var flow = btn.getAttribute('data-flow');
      if (flow === 'puncture') {
        var ack = $('qw-p-ack');
        if (!ack || !ack.checked) {
          showError('qw-p-ack-error', 'Please tick the box to confirm you understand the callout terms.');
          track('quote_ack_blocked', { service: 'puncture' });
          return;
        }
        showError('qw-p-ack-error');
      }
      if (next) {
        track('quote_booking_shown', { service: state.service });
        show(next);
      }
    });
  });

  // ---- Booking → contact transition -----------------------------------
  $$('.qw-to-contact').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var flow = btn.getAttribute('data-flow');
      var next = btn.getAttribute('data-next');
      var errId = flow === 'puncture' ? 'qw-p-booking-error' : 'qw-l-booking-error';
      if (!state.sameDay && state.slots.length < 2) {
        showError(errId, 'Pick two time windows, or tick "I need this today".');
        track('quote_booking_validation_failed', { service: flow, slots: state.slots.length });
        return;
      }
      showError(errId);
      // Populate hidden fields for the contact form.
      if (flow === 'puncture') {
        $('qw-p-cb-postcode').value = state.postcode;
        $('qw-p-cb-miles').value = state.miles.toFixed(2);
        $('qw-p-cb-price').value = fmt(state.total);
        $('qw-p-cb-breakdown').value = state.breakdown.map(function (l) { return l.label + ': ' + fmt(l.amount); }).join(' | ');
        $('qw-p-cb-slots').value = state.slots.join(', ');
        $('qw-p-cb-sameday').value = state.sameDay ? 'yes' : 'no';
      } else {
        $('qw-l-cb-postcode').value = state.postcode;
        $('qw-l-cb-miles').value = state.miles.toFixed(2);
        $('qw-l-cb-lockers').value = state.lockers;
        $('qw-l-cb-price').value = fmt(state.total);
        $('qw-l-cb-breakdown').value = state.breakdown.map(function (l) { return l.label + ': ' + fmt(l.amount); }).join(' | ');
        $('qw-l-cb-slots').value = state.slots.join(', ');
        $('qw-l-cb-sameday').value = state.sameDay ? 'yes' : 'no';
      }
      show(next);
    });
  });

  // Map the Netlify form name to a submission type for analytics.
  var formTypeByName = {
    'quote-puncture': 'booking',
    'quote-lwnr': 'booking',
    'quote-out-of-area': 'out-of-area',
    'quote-emergency': 'emergency',
  };

  // ---- Form submissions (Netlify, fetch-based) ------------------------
  function wireForm(formId) {
    var form = $(formId);
    if (!form) return;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.querySelector('.btn-label') : null;
      var sending = btn ? btn.querySelector('.btn-sending') : null;
      if (btn) btn.disabled = true;
      if (label) label.style.display = 'none';
      if (sending) sending.style.display = '';
      var formName = form.getAttribute('name') || '';
      track('quote_submitted', {
        service: state.service || formName,
        type: formTypeByName[formName] || 'other',
      });
      try {
        await fetch('/quote/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        window.location.href = '/thank-you/';
      } catch (err) {
        if (btn) btn.disabled = false;
        if (label) label.style.display = '';
        if (sending) sending.style.display = 'none';
        alert('Something went wrong sending that. Please ring us on ' + phone + ' or try again.');
      }
    });
  }
  wireForm('qw-p-form');
  wireForm('qw-l-form');
  wireForm('qw-p-ooa-form');
  wireForm('qw-l-ooa-form');
  wireForm('qw-mf-ooa-form');
  wireForm('qw-e-form');

  // External booking-site link (mobile fitting + caravan share this)
  var mfContinue = $('qw-mf-continue');
  if (mfContinue) {
    mfContinue.addEventListener('click', function () {
      track('quote_redirect_external', {
        service: state.service,
        miles: Math.round(state.miles * 10) / 10,
      });
    });
  }

  // ---- Emergency: share-my-location button ----------------------------
  var locateBtn = $('qw-e-locate');
  var locateStatus = $('qw-e-locate-status');
  if (locateBtn && locateStatus && 'geolocation' in navigator) {
    locateBtn.addEventListener('click', function () {
      locateBtn.disabled = true;
      locateStatus.textContent = 'Locating…';
      locateStatus.className = 'qw-e-locate-status';
      navigator.geolocation.getCurrentPosition(async function (pos) {
        track('quote_geolocation_used');
        var lat = pos.coords.latitude;
        var lon = pos.coords.longitude;
        var latEl = $('qw-e-lat');
        var lonEl = $('qw-e-lon');
        if (latEl) latEl.value = lat.toFixed(6);
        if (lonEl) lonEl.value = lon.toFixed(6);
        // Reverse-geocode for a postcode label; fall back to lat,lon.
        try {
          var res = await fetch('https://api.postcodes.io/postcodes?lon=' + lon + '&lat=' + lat);
          if (res.ok) {
            var data = await res.json();
            var first = data && data.result && data.result[0];
            if (first && first.postcode) {
              $('qw-e-postcode').value = first.postcode;
              locateStatus.textContent = 'Got it — nearest postcode ' + first.postcode + '.';
              locateBtn.disabled = false;
              return;
            }
          }
        } catch (e) {}
        // No nearby postcode (or lookup failed) — put the coords in.
        $('qw-e-postcode').value = lat.toFixed(5) + ', ' + lon.toFixed(5);
        locateStatus.textContent = 'Got your coordinates. We&rsquo;ll work out the address from these.';
        locateBtn.disabled = false;
      }, function (err) {
        locateBtn.disabled = false;
        locateStatus.className = 'qw-e-locate-status qw-e-locate-status--err';
        if (err && err.code === 1) {
          locateStatus.textContent = 'Location permission was blocked — pop your postcode in instead.';
        } else {
          locateStatus.textContent = 'Couldn’t get your location — pop your postcode in instead.';
        }
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
    });
  } else if (locateBtn) {
    // No geolocation in this browser — hide the button entirely.
    locateBtn.style.display = 'none';
  }
})();
