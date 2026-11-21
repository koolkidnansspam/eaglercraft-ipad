(function () {
  if (window.__eaglerTouch) return;
  window.__eaglerTouch = true;

  var params = new URLSearchParams(location.search);
  var enabled = params.get('touch') === '1' || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  if (!enabled) return;

  var SENS_KEY = 'eaglerTouchSens';
  var sens = 1.6;
  try {
    var saved = parseFloat(localStorage.getItem(SENS_KEY));
    if (saved > 0) sens = saved;
  } catch (e) {}

  var vp = document.querySelector('meta[name=viewport]');
  if (!vp) {
    vp = document.createElement('meta');
    vp.name = 'viewport';
    document.head.appendChild(vp);
  }
  vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  var cap = document.createElement('meta');
  cap.name = 'apple-mobile-web-app-capable';
  cap.content = 'yes';
  document.head.appendChild(cap);

  var fakeLock = null;
  function fireLockChange() {
    setTimeout(function () {
      document.dispatchEvent(new Event('pointerlockchange'));
      refresh();
    }, 0);
  }
  if (!Element.prototype.requestPointerLock) {
    Element.prototype.requestPointerLock = function () {
      fakeLock = this;
      fireLockChange();
    };
    Document.prototype.exitPointerLock = function () {
      if (fakeLock) {
        fakeLock = null;
        fireLockChange();
      }
    };
    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      get: function () { return fakeLock; },
      configurable: true
    });
  } else {
    document.addEventListener('pointerlockchange', function () { refresh(); });
  }

  function define(o, n, v) {
    try { Object.defineProperty(o, n, { value: v }); } catch (e) {}
  }

  var KEYS = {
    w: [87, 'KeyW', 'w'],
    a: [65, 'KeyA', 'a'],
    s: [83, 'KeyS', 's'],
    d: [68, 'KeyD', 'd'],
    space: [32, 'Space', ' '],
    shift: [16, 'ShiftLeft', 'Shift', 1],
    ctrl: [17, 'ControlLeft', 'Control', 1],
    e: [69, 'KeyE', 'e'],
    q: [81, 'KeyQ', 'q'],
    t: [84, 'KeyT', 't'],
    esc: [27, 'Escape', 'Escape'],
    f5: [116, 'F5', 'F5'],
    enter: [13, 'Enter', 'Enter'],
    slash: [191, 'Slash', '/']
  };
  for (var n = 1; n <= 9; n++) KEYS['n' + n] = [48 + n, 'Digit' + n, String(n)];

  function keyEvent(type, k, shift) {
    var ev = new KeyboardEvent(type, {
      key: k[2],
      code: k[1],
      location: k[3] || 0,
      shiftKey: !!shift,
      bubbles: true,
      cancelable: true
    });
    define(ev, 'keyCode', k[0]);
    define(ev, 'which', k[0]);
    if (type === 'keypress') define(ev, 'charCode', k[2].length === 1 ? k[2].charCodeAt(0) : 0);
    window.dispatchEvent(ev);
  }

  var held = {};
  function press(name) {
    if (held[name]) return;
    held[name] = true;
    keyEvent('keydown', KEYS[name]);
  }
  function release(name) {
    if (!held[name]) return;
    held[name] = false;
    keyEvent('keyup', KEYS[name]);
  }
  function tap(name) {
    keyEvent('keydown', KEYS[name]);
    setTimeout(function () { keyEvent('keyup', KEYS[name]); }, 40);
  }
  function releaseAll() {
    for (var k in held) if (held[k]) release(k);
    mouseUp(0);
    mouseUp(2);
  }

  function canvas() {
    return document.querySelector('#game_frame canvas') || document.querySelector('canvas');
  }

  function mouseEvent(type, button, mx, my) {
    var c = canvas();
    if (!c) return;
    var r = c.getBoundingClientRect();
    var ev = new MouseEvent(type, {
      button: button || 0,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      bubbles: true,
      cancelable: true
    });
    define(ev, 'movementX', mx || 0);
    define(ev, 'movementY', my || 0);
    define(ev, 'offsetX', r.width / 2);
    define(ev, 'offsetY', r.height / 2);
    c.dispatchEvent(ev);
  }
  var mouseHeld = { 0: false, 2: false };
  function mouseDown(b) {
    if (mouseHeld[b]) return;
    mouseHeld[b] = true;
    mouseEvent('mousedown', b);
  }
  function mouseUp(b) {
    if (!mouseHeld[b]) return;
    mouseHeld[b] = false;
    mouseEvent('mouseup', b);
  }
  function look(dx, dy) {
    mouseEvent('mousemove', 0, dx, dy);
  }

  var SHIFTED = {
    '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
    '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/', '~': '`'
  };
  var PUNCT = {
    '/': [191, 'Slash'], '.': [190, 'Period'], ',': [188, 'Comma'], '-': [189, 'Minus'], '=': [187, 'Equal'],
    ';': [186, 'Semicolon'], "'": [222, 'Quote'], '[': [219, 'BracketLeft'], ']': [221, 'BracketRight'],
    '\\': [220, 'Backslash'], '`': [192, 'Backquote']
  };

  function charKey(ch) {
    var lc = ch.toLowerCase();
    if (lc >= 'a' && lc <= 'z') return { k: [lc.charCodeAt(0) - 32, 'Key' + lc.toUpperCase(), ch], shift: ch !== lc };
    if (ch >= '0' && ch <= '9') return { k: [ch.charCodeAt(0), 'Digit' + ch, ch], shift: false };
    if (ch === ' ') return { k: [32, 'Space', ' '], shift: false };
    if (PUNCT[ch]) return { k: [PUNCT[ch][0], PUNCT[ch][1], ch], shift: false };
    if (SHIFTED[ch] && SHIFTED[ch] !== ch) {
      var base = SHIFTED[ch];
      var info = PUNCT[base] || (base >= '0' && base <= '9' ? [base.charCodeAt(0), 'Digit' + base] : null);
      if (info) return { k: [info[0], info[1], ch], shift: true };
    }
    return { k: [ch.charCodeAt(0), 'Unidentified', ch], shift: false };
  }

  function typeChar(ch) {
    var c = charKey(ch);
    keyEvent('keydown', c.k, c.shift);
    keyEvent('keypress', c.k, c.shift);
    keyEvent('keyup', c.k, c.shift);
  }

  function sendText(text, enter) {
    var chars = text.split('');
    var steps = [];
    if (document.pointerLockElement) {
      if (chars[0] === '/') {
        chars.shift();
        steps.push(function () { tap('slash'); });
      } else {
        steps.push(function () { tap('t'); });
      }
      steps.push(180);
    }
    chars.forEach(function (ch) {
      steps.push(function () { typeChar(ch); });
    });
    if (enter) {
      steps.push(60);
      steps.push(function () { tap('enter'); });
    }
    (function next() {
      var s = steps.shift();
      if (s === undefined) return;
      if (typeof s === 'number') return setTimeout(next, s);
      s();
      setTimeout(next, 12);
    })();
  }

  var css = document.createElement('style');
  css.textContent =
    'html,body{touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
    '#etc-hud{position:fixed;inset:0;z-index:2147483000;pointer-events:none;display:none;-webkit-user-select:none;user-select:none;touch-action:none;font-family:system-ui,-apple-system,sans-serif}' +
    '#etc-hud.on{display:block}' +
    '#etc-hud .zone{position:absolute;pointer-events:auto;touch-action:none}' +
    '#etc-left{left:0;top:18%;bottom:0;width:42%}' +
    '#etc-right{right:0;top:12%;bottom:0;width:58%}' +
    '.etc-btn{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.45);border-radius:50%;text-shadow:0 1px 2px #000;-webkit-tap-highlight-color:transparent;box-sizing:border-box}' +
    '.etc-btn.sq{border-radius:10px}' +
    '.etc-btn.down,.etc-btn.on{background:rgba(255,255,255,.5)}' +
    '#etc-stick{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.4);display:none;pointer-events:none}' +
    '#etc-knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.5)}' +
    '#etc-mini{position:fixed;z-index:2147483001;left:calc(8px + env(safe-area-inset-left,0px));top:calc(8px + env(safe-area-inset-top,0px));display:flex;gap:6px}' +
    '#etc-mini .etc-btn{position:static;width:40px;height:40px;font-size:18px;opacity:.7}' +
    '#etc-panel,#etc-text{position:fixed;z-index:2147483002;display:none;background:rgba(20,20,20,.92);color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:12px;padding:12px;font:14px system-ui,-apple-system,sans-serif;-webkit-user-select:auto;user-select:auto}' +
    '#etc-panel{left:calc(8px + env(safe-area-inset-left,0px));top:calc(56px + env(safe-area-inset-top,0px));width:240px}' +
    '#etc-panel label{display:block;margin-bottom:6px}' +
    '#etc-panel input[type=range]{width:100%}' +
    '#etc-panel button,#etc-text button{margin-top:8px;margin-right:6px;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.15);color:#fff;font-size:14px}' +
    '#etc-text{left:50%;transform:translateX(-50%);top:calc(8px + env(safe-area-inset-top,0px));width:min(560px,92vw);align-items:center;gap:6px;flex-wrap:wrap}' +
    '#etc-text input{flex:1 1 100%;font-size:16px;padding:8px;border-radius:8px;border:1px solid #888;background:#111;color:#fff;-webkit-user-select:text;user-select:text}';
  document.head.appendChild(css);

  function el(tag, id, cls, html) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  var hud = el('div', 'etc-hud');
  var left = el('div', 'etc-left', 'zone');
  var right = el('div', 'etc-right', 'zone');
  var stick = el('div', 'etc-stick');
  var knob = el('div', 'etc-knob');
  stick.appendChild(knob);
  hud.appendChild(left);
  hud.appendChild(right);
  hud.appendChild(stick);

  function hold(btn, down, up) {
    function s(e) {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('down');
      down();
    }
    function f(e) {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove('down');
      up();
    }
    btn.addEventListener('touchstart', s, { passive: false });
    btn.addEventListener('touchend', f, { passive: false });
    btn.addEventListener('touchcancel', f, { passive: false });
  }

  function button(label, style, cls, down, up) {
    var b = el('div', null, 'etc-btn ' + (cls || ''), label);
    b.style.cssText = style;
    hold(b, down, up || function () {});
    hud.appendChild(b);
    return b;
  }

  var SA_R = 'env(safe-area-inset-right,0px)';
  var SA_B = 'env(safe-area-inset-bottom,0px)';

  button('JUMP', 'width:88px;height:88px;right:calc(36px + ' + SA_R + ');bottom:calc(150px + ' + SA_B + ')',
    '', function () { press('space'); }, function () { release('space'); });
  button('USE', 'width:76px;height:76px;right:calc(140px + ' + SA_R + ');bottom:calc(90px + ' + SA_B + ')',
    '', function () { mouseDown(2); }, function () { mouseUp(2); });

  var sneakOn = false;
  var sneakBtn = button('SNEAK', 'width:72px;height:72px;right:calc(36px + ' + SA_R + ');bottom:calc(40px + ' + SA_B + ')',
    '', function () {
      sneakOn = !sneakOn;
      sneakBtn.classList.toggle('on', sneakOn);
      if (sneakOn) press('shift'); else release('shift');
    });

  var topRow = [
    ['INV', function () { tap('e'); }],
    ['DROP', function () { tap('q'); }],
    ['VIEW', function () { tap('f5'); }],
    ['CHAT', function () { tap('t'); }],
    ['PAUSE', function () { tap('esc'); }]
  ];
  topRow.forEach(function (t, i) {
    button(t[0], 'width:52px;height:40px;top:calc(8px + env(safe-area-inset-top,0px));right:calc(' + (8 + i * 58) + 'px + ' + SA_R + ')',
      'sq', t[1]);
  });

  var slotBtns = [];
  for (var i = 1; i <= 9; i++) {
    (function (i) {
      var b = button(String(i),
        'width:38px;height:34px;bottom:calc(66px + ' + SA_B + ');left:calc(50% + ' + ((i - 5) * 42 - 19) + 'px);font-size:12px',
        'sq',
        function () {
          tap('n' + i);
          slotBtns.forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        });
      slotBtns.push(b);
    })(i);
  }

  var stickId = null;
  var sx = 0;
  var sy = 0;
  var R = 55;
  function setStick(dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > R) {
      dx = dx / len * R;
      dy = dy / len * R;
      len = R;
    }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    var th = R * 0.35;
    if (dy < -th) press('w'); else release('w');
    if (dy > th) press('s'); else release('s');
    if (dx < -th) press('a'); else release('a');
    if (dx > th) press('d'); else release('d');
    if (dy < -R * 0.92) press('ctrl'); else release('ctrl');
  }
  function endStick() {
    stickId = null;
    stick.style.display = 'none';
    knob.style.transform = '';
    ['w', 'a', 's', 'd', 'ctrl'].forEach(release);
  }
  left.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (stickId !== null) return;
    var t = e.changedTouches[0];
    stickId = t.identifier;
    sx = t.clientX;
    sy = t.clientY;
    stick.style.left = sx + 'px';
    stick.style.top = sy + 'px';
    stick.style.display = 'block';
    setStick(0, 0);
  }, { passive: false });
  left.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === stickId) setStick(t.clientX - sx, t.clientY - sy);
    }
  }, { passive: false });
  function leftEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickId) endStick();
    }
  }
  left.addEventListener('touchend', leftEnd, { passive: false });
  left.addEventListener('touchcancel', leftEnd, { passive: false });

  var lookId = null;
  var lx = 0;
  var ly = 0;
  var lt = 0;
  var lmoved = false;
  var lmoveDist = 0;
  var lmining = false;
  var lhold = null;
  right.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (lookId !== null) return;
    var t = e.changedTouches[0];
    lookId = t.identifier;
    lx = t.clientX;
    ly = t.clientY;
    lt = Date.now();
    lmoved = false;
    lmoveDist = 0;
    lmining = false;
    lhold = setTimeout(function () {
      if (!lmoved) {
        lmining = true;
        mouseDown(0);
      }
    }, 350);
  }, { passive: false });
  right.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== lookId) continue;
      var dx = t.clientX - lx;
      var dy = t.clientY - ly;
      lx = t.clientX;
      ly = t.clientY;
      lmoveDist += Math.abs(dx) + Math.abs(dy);
      if (lmoveDist > 12 && !lmining) {
        lmoved = true;
        clearTimeout(lhold);
      }
      look(dx * sens, dy * sens);
    }
  }, { passive: false });
  function rightEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== lookId) continue;
      clearTimeout(lhold);
      lookId = null;
      if (lmining) {
        mouseUp(0);
        lmining = false;
      } else if (!lmoved && Date.now() - lt < 300) {
        mouseDown(0);
        setTimeout(function () { mouseUp(0); }, 50);
      }
    }
  }
  right.addEventListener('touchend', rightEnd, { passive: false });
  right.addEventListener('touchcancel', rightEnd, { passive: false });

  var mini = el('div', 'etc-mini');
  var kbdBtn = el('div', null, 'etc-btn', '&#9000;');
  var gearBtn = el('div', null, 'etc-btn', '&#9881;');
  mini.appendChild(kbdBtn);
  mini.appendChild(gearBtn);

  var panel = el('div', 'etc-panel');
  panel.innerHTML =
    '<label>Look sensitivity: <span id="etc-sv"></span></label>' +
    '<input type="range" id="etc-sr" min="0.4" max="4" step="0.1">' +
    '<button id="etc-fs">Fullscreen</button><button id="etc-hide">Hide controls</button>';

  var textBar = el('div', 'etc-text');
  textBar.innerHTML =
    '<input type="text" id="etc-ti" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="Type here">' +
    '<button id="etc-send">Send + Enter</button><button id="etc-type">Type only</button><button id="etc-close">Close</button>';

  function toggle(node, display) {
    node.style.display = node.style.display === display ? 'none' : display;
  }
  function tapEl(node, fn) {
    node.addEventListener('touchend', function (e) {
      e.preventDefault();
      fn();
    }, { passive: false });
    node.addEventListener('click', fn);
  }

  var controlsHidden = false;
  function refresh() {
    var locked = !!document.pointerLockElement;
    hud.classList.toggle('on', locked && !controlsHidden);
    if (!locked) {
      endStick();
      releaseAll();
      sneakOn = false;
      sneakBtn.classList.remove('on');
    }
  }

  function mount() {
    document.body.appendChild(hud);
    document.body.appendChild(mini);
    document.body.appendChild(panel);
    document.body.appendChild(textBar);

    var sr = panel.querySelector('#etc-sr');
    var sv = panel.querySelector('#etc-sv');
    sr.value = sens;
    sv.textContent = sens.toFixed(1);
    sr.addEventListener('input', function () {
      sens = parseFloat(sr.value);
      sv.textContent = sens.toFixed(1);
      try { localStorage.setItem(SENS_KEY, String(sens)); } catch (e) {}
    });
    tapEl(panel.querySelector('#etc-fs'), function () {
      var d = document.documentElement;
      var f = d.requestFullscreen || d.webkitRequestFullscreen;
      if (f) {
        try { f.call(d); } catch (e) {}
      }
    });
    var hideBtn = panel.querySelector('#etc-hide');
    tapEl(hideBtn, function () {
      controlsHidden = !controlsHidden;
      hideBtn.textContent = controlsHidden ? 'Show controls' : 'Hide controls';
      refresh();
    });
    tapEl(gearBtn, function () { toggle(panel, 'block'); });

    var ti = textBar.querySelector('#etc-ti');
    ['keydown', 'keyup', 'keypress'].forEach(function (t) {
      ti.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    tapEl(kbdBtn, function () {
      toggle(textBar, 'flex');
      if (textBar.style.display === 'flex') ti.focus();
    });
    function submit(enter) {
      var v = ti.value;
      if (!v) return;
      ti.value = '';
      ti.blur();
      sendText(v, enter);
    }
    tapEl(textBar.querySelector('#etc-send'), function () { submit(true); });
    tapEl(textBar.querySelector('#etc-type'), function () { submit(false); });
    tapEl(textBar.querySelector('#etc-close'), function () {
      textBar.style.display = 'none';
      ti.blur();
    });
    ti.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit(true);
      }
    });
    refresh();
  }

  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) releaseAll();
  });

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
