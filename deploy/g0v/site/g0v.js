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

  // --- Tiro, como na home do tomoyo.systems ------------------------------------------
  const TARGETS = "a[href], button, h1, h2, h3, p, li, kbd, code, img, svg, .caption, .banner__title";
  const EXCLUDE = "input, textarea, select, iframe, [contenteditable], .no-shatter, .scope";
  const rand = (a, b) => a + Math.random() * (b - a);
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

  function tink() {
    try { audio ??= new AudioContext(); } catch (e) { return; }
    const ctx = audio, t = ctx.currentTime + 0.005;
    if (ctx.state === "suspended") ctx.resume();
    const master = ctx.createGain(); master.gain.value = 0.16; master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.03), ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 3200; band.Q.value = 0.9;
    noise.connect(band).connect(master); noise.start(t);
    const base = rand(1700, 2500);
    for (const [ratio, gain, len] of [[1, 0.5, 0.55], [2.76, 0.28, 0.35], [5.4, 0.16, 0.2], [8.93, 0.08, 0.12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = base * ratio; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(1e-4, t + len);
      o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.02);
    }
    const w = ctx.createOscillator(), wg = ctx.createGain();
    w.type = "triangle"; w.frequency.setValueAtTime(rand(3400, 4200), t + 0.02); w.frequency.exponentialRampToValueAtTime(rand(700, 1000), t + 0.4);
    wg.gain.setValueAtTime(1e-4, t); wg.gain.linearRampToValueAtTime(0.12, t + 0.04); wg.gain.exponentialRampToValueAtTime(1e-4, t + 0.42);
    w.connect(wg).connect(master); w.start(t); w.stop(t + 0.45);
  }


  /** Marca de bala no ponto do tiro: um furo irregular que fica na página (as 40 últimas). */
  function bulletHole(layer, x, y) {
    const hole = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hole.setAttribute("class", "bullet-hole");
    hole.setAttribute("viewBox", "-10 -10 20 20");
    hole.style.left = `${x}px`;
    hole.style.top = `${y}px`;
    const points = [];
    for (let index = 0; index < 11; index += 1) {
      const angle = (index / 11) * Math.PI * 2;
      const radius = rand(5.5, 9.5);
      points.push(`${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`);
    }
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    ring.setAttribute("class", "ring");
    ring.setAttribute("points", points.join(" "));
    const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    core.setAttribute("class", "core");
    core.setAttribute("r", rand(2.2, 3.4).toFixed(2));
    core.setAttribute("cx", rand(-0.8, 0.8).toFixed(2));
    core.setAttribute("cy", rand(-0.8, 0.8).toFixed(2));
    hole.appendChild(ring);
    hole.appendChild(core);
    layer.appendChild(hole);
    const holes = layer.querySelectorAll(".bullet-hole");
    if (holes.length > 40) {
      holes[0].remove();
    }
  }
  function ricochet(el, cx, cy) {
    tink();
    const fixed = insideFixed(el), layer = layerFor(fixed);
    const x = cx + (fixed ? 0 : scrollX), y = cy + (fixed ? 0 : scrollY), start = rand(0, Math.PI * 2);
    bulletHole(layer, x, y);
    for (let i = 0; i < 7; i++) {
      const spark = document.createElement("div");
      spark.className = "ricochet-spark";
      Object.assign(spark.style, { left: `${x}px`, top: `${y}px` });
      layer.appendChild(spark);
      const ang = start + (i / 7) * Math.PI * 2 + rand(-0.3, 0.3), dist = rand(26, 64), deg = (ang * 180) / Math.PI;
      spark.animate([{ transform: `translate(-50%,-50%) rotate(${deg}deg) translateX(4px) scaleX(1)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${deg}deg) translateX(${dist}px) scaleX(.3)`, opacity: 0 }], { duration: rand(220, 360), easing: "cubic-bezier(.1,.7,.3,1)" }).onfinish = () => spark.remove();
    }
    const box = el.getBoundingClientRect(), side = Math.sign(box.left + box.width / 2 - cx) || 1;
    el.animate && el.animate([{ translate: "0 0" }, { translate: `${side * 3}px -1px` }, { translate: `${-side * 2}px 1px` }, { translate: `${side}px 0` }, { translate: "0 0" }], { duration: 220, easing: "ease-out" });
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.detail === 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const origin = event.target;
    if (!origin.closest || origin.closest(EXCLUDE)) return;
    ricochet(origin.closest(TARGETS) || origin, event.clientX, event.clientY);
  });
})();
