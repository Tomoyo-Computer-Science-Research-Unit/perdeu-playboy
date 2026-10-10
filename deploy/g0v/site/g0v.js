/* g0v.tomoyo.systems: tema, efeitos, mira e coisas quebráveis. Porte em JS puro do que o
   tomoyo.systems faz e do que o Perdeu, Playboy usa (Fx.tsx, Scope.tsx, Shatter.tsx). */
(() => {
  const root = document.documentElement;
  const isTyping = (target) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  };
  const store = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  };

  // Teclas: T tema, F efeitos, 1 abre o primeiro projeto.
  addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (event.key === "t" || event.key === "T") {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
    } else if (event.key === "f" || event.key === "F") {
      const on = !root.classList.contains("fx");
      root.classList.toggle("fx", on);
      store("pp-fx", on ? "on" : "off");
    } else if (event.key === "1") {
      location.href = "/perdeu-playboy/";
    }
  });

  // --- Mon flutuante: arrasta pela tela; um clique sem arrastar abre o tomoyo.systems -------
  document.querySelectorAll(".mon-float").forEach((float) => {
    const link = float.querySelector(".mon-float__link");
    let startX = 0, startY = 0, left = 0, top = 0, holding = false, dragged = false;
    float.addEventListener("pointerenter", () => root.classList.add("scope-off"));
    float.addEventListener("pointerleave", () => { if (!holding) root.classList.remove("scope-off"); });
    const move = (event) => {
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      dragged = true;
      float.classList.add("is-dragging");
      const w = float.offsetWidth, h = float.offsetHeight;
      Object.assign(float.style, {
        left: `${Math.min(Math.max(left + dx, 0), innerWidth - w)}px`,
        top: `${Math.min(Math.max(top + dy, 0), innerHeight - h)}px`,
        right: "auto",
        bottom: "auto"
      });
    };
    const up = (event) => {
      holding = false;
      float.classList.remove("is-dragging", "is-holding");
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (!under || !float.contains(under)) root.classList.remove("scope-off");
    };
    float.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".float-close")) return;
      const box = float.getBoundingClientRect();
      startX = event.clientX; startY = event.clientY; left = box.left; top = box.top;
      holding = true; dragged = false;
      float.classList.add("is-holding");
      addEventListener("pointermove", move);
      addEventListener("pointerup", up);
      addEventListener("pointercancel", up);
    });
    link.addEventListener("click", (event) => { if (dragged) event.preventDefault(); });
    float.querySelector(".float-close").addEventListener("click", () => {
      root.dataset.hide = ((root.dataset.hide || "") + " mon").trim();
      root.classList.remove("scope-off");
    });
  });

  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!fine) return;

  // --- Mira --------------------------------------------------------------------------
  const scope = document.querySelector(".scope");
  if (scope) {
    const ring = scope.querySelector(".scope__ring");
    const cross = scope.querySelector(".scope__cross");
    const LOCK = "a, button, [role='button'], input, label, summary";
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, locked = null, animating = false;
    root.classList.add("has-scope");
    const settle = () => {
      let tx = x, ty = y;
      if (locked) {
        const b = locked.getBoundingClientRect();
        tx = x + (b.left + b.width / 2 - x) * 0.35;
        ty = y + (b.top + b.height / 2 - y) * 0.35;
      }
      rx += (tx - rx) * 0.2;
      ry += (ty - ry) * 0.2;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      if (Math.abs(tx - rx) + Math.abs(ty - ry) > 0.3) requestAnimationFrame(settle);
      else animating = false;
    };
    const nudge = () => {
      if (!animating) {
        animating = true;
        requestAnimationFrame(settle);
      }
    };
    addEventListener("pointermove", (event) => {
      x = event.clientX;
      y = event.clientY;
      scope.classList.add("is-live");
      cross.style.transform = `translate(${x}px, ${y}px)`;
      const target = event.target.closest ? event.target.closest(LOCK) : null;
      if (target !== locked) {
        locked = target;
        scope.classList.toggle("is-lock", Boolean(target));
      }
      nudge();
    }, { passive: true });
    document.addEventListener("pointerleave", () => scope.classList.remove("is-live"));
    addEventListener("pointerdown", () => {
      scope.classList.remove("is-fire");
      void scope.offsetWidth;
      scope.classList.add("is-fire");
    });
    addEventListener("scroll", nudge, { passive: true });
  }

  // --- Tiros, como no tomoyo.systems: marca de bala que some; a marca ricocheteia ----------
  const SKIP = "input, textarea, select, iframe, [contenteditable], [download], .no-shatter, .scope";
  const BRAND = "[data-brand]";
  const HOLE_LIFE = 9000, MAX_HOLES = 48;
  const rand = (a, b) => a + Math.random() * (b - a);
  const holes = [];
  let audio = null;
  const insideFixed = (el) => {
    for (let n = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
    return false;
  };
  function layerFor(fixed) {
    const cls = fixed ? "shatter-layer shatter-layer--fixed" : "shatter-layer";
    let layer = document.querySelector("." + cls.split(" ").join("."));
    if (!layer) {
      layer = document.createElement("div");
      layer.className = cls;
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  }
  function context() {
    try { audio ??= new AudioContext(); } catch (e) { return null; }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }
  function bang() {
    const ac = context(); if (!ac) return;
    const t = ac.currentTime + 0.005;
    const out = ac.createGain(); out.gain.value = 0.09; out.connect(ac.destination);
    const len = Math.round(ac.sampleRate * 0.14);
    const noise = ac.createBuffer(1, len, ac.sampleRate), ch = noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const crack = ac.createBufferSource(); crack.buffer = noise;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(rand(2600, 3600), t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.14);
    crack.connect(lp).connect(out); crack.start(t);
    const thump = ac.createOscillator(), tg = ac.createGain();
    thump.frequency.setValueAtTime(rand(130, 170), t); thump.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    tg.gain.setValueAtTime(0.7, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    thump.connect(tg).connect(out); thump.start(t); thump.stop(t + 0.12);
  }
  function hole(target, cx, cy) {
    bang();
    const fixed = insideFixed(target), layer = layerFor(fixed);
    const ox = cx + (fixed ? 0 : scrollX), oy = cy + (fixed ? 0 : scrollY);
    const flash = document.createElement("div");
    flash.className = "shatter-flash";
    Object.assign(flash.style, { left: `${ox}px`, top: `${oy}px` });
    layer.appendChild(flash);
    flash.animate([{ transform: "translate(-50%,-50%) scale(0)", opacity: 0.5 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0 }], { duration: 200, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => flash.remove();
    const h = document.createElement("div");
    h.className = "bullet-hole";
    const d = rand(6, 9), r = () => `${rand(42, 58).toFixed(0)}%`;
    Object.assign(h.style, { left: `${ox}px`, top: `${oy}px`, width: `${d.toFixed(1)}px`, height: `${(d * rand(0.85, 1.15)).toFixed(1)}px`, borderRadius: `${r()} ${r()} ${r()} ${r()} / ${r()} ${r()} ${r()} ${r()}`, rotate: `${rand(0, 360).toFixed(0)}deg` });
    layer.appendChild(h);
    holes.push(h);
    while (holes.length > MAX_HOLES) holes.shift().remove();
    h.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 1 }], { duration: HOLE_LIFE, easing: "ease-in", fill: "forwards" }).onfinish = () => {
      h.remove();
      const i = holes.indexOf(h); if (i >= 0) holes.splice(i, 1);
    };
  }
  function ping() {
    const ac = context(); if (!ac) return;
    const t = ac.currentTime + 0.005;
    const out = ac.createGain(); out.gain.value = 0.16; out.connect(ac.destination);
    const noise = ac.createBuffer(1, Math.round(ac.sampleRate * 0.03), ac.sampleRate), ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 2;
    const hit = ac.createBufferSource(); hit.buffer = noise;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 0.9;
    hit.connect(bp).connect(out); hit.start(t);
    const f0 = rand(1700, 2500);
    [[1, 0.5, 0.55], [2.76, 0.28, 0.35], [5.4, 0.16, 0.2], [8.93, 0.08, 0.12]].forEach(([r, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f0 * r; g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02);
    });
    const w = ac.createOscillator(), wg = ac.createGain();
    w.type = "triangle"; w.frequency.setValueAtTime(rand(3400, 4200), t + 0.02); w.frequency.exponentialRampToValueAtTime(rand(700, 1000), t + 0.4);
    wg.gain.setValueAtTime(0.0001, t); wg.gain.linearRampToValueAtTime(0.12, t + 0.04); wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    w.connect(wg).connect(out); w.start(t); w.stop(t + 0.45);
  }
  function ricochet(target, cx, cy) {
    ping();
    const fixed = insideFixed(target), layer = layerFor(fixed);
    const ox = cx + (fixed ? 0 : scrollX), oy = cy + (fixed ? 0 : scrollY), base = rand(0, Math.PI * 2);
    for (let i = 0; i < 7; i++) {
      const s = document.createElement("div");
      s.className = "ricochet-spark";
      Object.assign(s.style, { left: `${ox}px`, top: `${oy}px` });
      layer.appendChild(s);
      const ang = base + (i / 7) * Math.PI * 2 + rand(-0.3, 0.3), dist = rand(26, 64), deg = (ang * 180) / Math.PI;
      s.animate([{ transform: `translate(-50%,-50%) rotate(${deg}deg) translateX(4px) scaleX(1)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${deg}deg) translateX(${dist}px) scaleX(.3)`, opacity: 0 }], { duration: rand(220, 360), easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => s.remove();
    }
    const r = target.getBoundingClientRect(), kx = Math.sign(r.left + r.width / 2 - cx) || 1;
    target.animate && target.animate([{ translate: "0 0" }, { translate: `${kx * 3}px -1px` }, { translate: `${-kx * 2}px 1px` }, { translate: `${kx}px 0` }, { translate: "0 0" }], { duration: 220, easing: "ease-out" });
  }
  function follow(link) {
    const url = new URL(link.getAttribute("href"), location.href);
    const external = /^https?:$/.test(url.protocol) && url.origin !== location.origin;
    if (external || link.getAttribute("target") === "_blank") open(url.href, "_blank", "noopener");
    else location.href = url.href;
  }
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.detail === 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const start = event.target;
    if (!start.closest || start.closest(SKIP)) return;
    if (!start.closest("a[href]") && !getSelection().isCollapsed) return;
    const brand = start.closest(BRAND);
    if (brand) {
      ricochet(brand, event.clientX, event.clientY);
      const a = start.closest("a[href]");
      if (a) { event.preventDefault(); setTimeout(() => follow(a), 260); }
      return;
    }
    hole(start, event.clientX, event.clientY);
  });
})();
