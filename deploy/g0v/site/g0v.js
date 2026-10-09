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
      store("pp-theme", next);
    } else if (event.key === "f" || event.key === "F") {
      const on = !root.classList.contains("fx");
      root.classList.toggle("fx", on);
      store("pp-fx", on ? "on" : "off");
    } else if (event.key === "1") {
      location.href = "/perdeu-playboy/";
    }
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

  // --- Coisas quebráveis ---------------------------------------------------------------
  const TARGETS = "a[href], button, h1, h2, h3, p, li, kbd, code, img, .caption, .banner__sub";
  const EXCLUDE = "input, textarea, select, iframe, [contenteditable], .no-shatter, .scope";
  const BRAND = "[data-brand]";
  const COPY = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "opacity", "color", "font-family", "font-size", "font-style", "font-weight", "letter-spacing", "text-anchor", "filter"];
  const NS = "http://www.w3.org/2000/svg";
  const rand = (a, b) => a + Math.random() * (b - a);
  const broken = new WeakSet();
  const bursts = new Set();
  let frame = 0, lastTick = 0, audio = null;

  function clipToBox(poly, w, h) {
    const edges = [
      [(p) => p[0] >= 0, (a, b) => [0, a[1] + ((0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
      [(p) => p[0] <= w, (a, b) => [w, a[1] + ((w - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
      [(p) => p[1] >= 0, (a, b) => [a[0] + ((0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), 0]],
      [(p) => p[1] <= h, (a, b) => [a[0] + ((h - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), h]]
    ];
    let out = poly;
    for (const [inside, cut] of edges) {
      const input = out;
      out = [];
      for (let i = 0; i < input.length; i++) {
        const cur = input[i], prev = input[(i + input.length - 1) % input.length];
        if (inside(cur)) {
          if (!inside(prev)) out.push(cut(prev, cur));
          out.push(cur);
        } else if (inside(prev)) out.push(cut(prev, cur));
      }
      if (!out.length) break;
    }
    return out;
  }
  const area = (poly) => Math.abs(poly.reduce((s, [x, y], i) => {
    const [nx, ny] = poly[(i + 1) % poly.length];
    return s + x * ny - nx * y;
  }, 0)) / 2;

  function fragments(w, h, hx, hy) {
    const n = Math.max(5, Math.min(12, Math.round(Math.sqrt(w * h) / 26)));
    const two = w * h > 3000;
    const reach = Math.hypot(w, h) * 2;
    const start = rand(0, Math.PI * 2), step = (Math.PI * 2) / n;
    const rays = Array.from({ length: n }, (_, i) => {
      const a = start + i * step + rand(-0.35, 0.35) * step;
      const dx = Math.cos(a), dy = Math.sin(a);
      const tx = dx > 0 ? (w - hx) / dx : dx < 0 ? -hx / dx : Infinity;
      const ty = dy > 0 ? (h - hy) / dy : dy < 0 ? -hy / dy : Infinity;
      return { d: [dx, dy], r1: Math.min(tx, ty) * rand(0.3, 0.65) };
    });
    const at = (i, dist) => [hx + rays[i].d[0] * dist, hy + rays[i].d[1] * dist];
    const polys = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (two) {
        polys.push([[hx, hy], at(i, rays[i].r1), at(j, rays[j].r1)]);
        polys.push([at(i, rays[i].r1), at(i, reach), at(j, reach), at(j, rays[j].r1)]);
      } else polys.push([[hx, hy], at(i, reach), at(j, reach)]);
    }
    return polys.map((p) => clipToBox(p, w, h)).filter((p) => p.length >= 3 && area(p) > 2);
  }

  function copyStyles(src, dst, all) {
    const cs = getComputedStyle(src), st = dst.style;
    if (all) for (let i = 0; i < cs.length; i++) st.setProperty(cs[i], cs.getPropertyValue(cs[i]));
    else for (const prop of COPY) st.setProperty(prop, cs.getPropertyValue(prop));
    st.setProperty("animation", "none");
    st.setProperty("transition", "none");
  }

  function cloneFor(el, box) {
    const clone = el.cloneNode(true);
    const srcs = [el, ...el.querySelectorAll("*")], dsts = [clone, ...clone.querySelectorAll("*")];
    const inner = el instanceof SVGElement && !(el instanceof SVGSVGElement);
    srcs.slice(0, 160).forEach((s, i) => copyStyles(s, dsts[i], !inner));
    dsts.forEach((d) => d.removeAttribute("id"));
    if (inner) {
      const m = new DOMMatrix().translate(-box.left, -box.top).multiply(el.parentNode.getScreenCTM());
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", box.width);
      svg.setAttribute("height", box.height);
      svg.style.overflow = "visible";
      svg.style.display = "block";
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
      g.appendChild(clone);
      svg.appendChild(g);
      return svg;
    }
    const st = clone.style, display = getComputedStyle(el).display;
    Object.assign(st, { margin: "0", position: "relative", left: "0", top: "0", transform: "none", translate: "none", rotate: "none", scale: "none", width: `${box.width}px`, height: `${box.height}px`, boxSizing: "border-box", opacity: "1" });
    if (display.startsWith("inline") && display !== "inline-block") st.display = "inline-block";
    if (display === "inline") st.whiteSpace = "nowrap";
    return clone;
  }

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

  function burst(el, cx, cy, kind) {
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4 || box.width * box.height > innerWidth * innerHeight * 0.6) return null;
    const fixed = insideFixed(el);
    const left = box.left + (fixed ? 0 : scrollX), top = box.top + (fixed ? 0 : scrollY);
    const hx = Math.min(Math.max(cx - box.left, 1), box.width - 1), hy = Math.min(Math.max(cy - box.top, 1), box.height - 1);
    const polys = fragments(box.width, box.height, hx, hy);
    if (!polys.length) return null;
    const clone = cloneFor(el, box), layer = layerFor(fixed);
    const power = Math.min(2, Math.max(0.8, Math.sqrt(box.width * box.height) / 150));
    const shards = polys.map((poly) => {
      const [px, py] = poly.reduce(([sx, sy], [qx, qy]) => [sx + qx / poly.length, sy + qy / poly.length], [0, 0]);
      const shard = document.createElement("div");
      shard.className = "shard";
      Object.assign(shard.style, { left: `${left}px`, top: `${top}px`, width: `${box.width}px`, height: `${box.height}px`, clipPath: `polygon(${poly.map(([a, b]) => `${a.toFixed(1)}px ${b.toFixed(1)}px`).join(",")})`, transformOrigin: `${px}px ${py}px` });
      shard.appendChild(clone.cloneNode(true));
      const edge = document.createElementNS(NS, "svg");
      edge.setAttribute("class", "shard__edge");
      edge.setAttribute("width", box.width);
      edge.setAttribute("height", box.height);
      const outline = document.createElementNS(NS, "polygon");
      outline.setAttribute("points", poly.map(([a, b]) => `${a},${b}`).join(" "));
      edge.appendChild(outline);
      shard.appendChild(edge);
      layer.appendChild(shard);
      let dx = px - hx, dy = py - hy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const speed = rand(240, 560) * power * (kind === "burst" ? 1 : 0.8);
      return { el: shard, x: 0, y: 0, vx: dx * speed, vy: dy * speed - rand(60, 180), a: 0, va: rand(-1, 1) * rand(180, 520), edge };
    });
    const flash = document.createElement("div");
    flash.className = "shatter-flash";
    Object.assign(flash.style, { left: `${left + hx}px`, top: `${top + hy}px` });
    layer.appendChild(flash);
    flash.animate([{ transform: "translate(-50%,-50%) scale(0)", opacity: 0.6 }, { transform: `translate(-50%,-50%) scale(${Math.min(4, Math.max(box.width, box.height) / 40)})`, opacity: 0 }], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => flash.remove();
    const saved = { o: el.style.getPropertyValue("opacity"), op: el.style.getPropertyPriority("opacity"), t: el.style.getPropertyValue("transition") };
    el.style.setProperty("transition", "none");
    el.style.setProperty("opacity", "0", "important");
    broken.add(el);
    const rec = {
      shards, t0: performance.now(), pullAt: Infinity,
      restore: () => {
        shards.forEach((s) => s.el.remove());
        el.style.removeProperty("opacity");
        if (saved.o) el.style.setProperty("opacity", saved.o, saved.op);
        el.style.setProperty("transition", saved.t);
        if (!saved.t) el.style.removeProperty("transition");
        broken.delete(el);
      }
    };
    bursts.add(rec);
    if (!frame) {
      lastTick = performance.now();
      frame = requestAnimationFrame(tick);
    }
    return rec;
  }

  function tick(now) {
    const dt = Math.min(0.04, (now - lastTick) / 1000);
    lastTick = now;
    for (const rec of bursts) {
      const age = (now - rec.t0) / 1000, pulling = now >= rec.pullAt, pa = pulling ? (now - rec.pullAt) / 1000 : 0;
      const spring = pulling ? 70 * Math.min(1, (pa / 1.3) ** 2) : 0, damp = pulling ? 2 * Math.sqrt(Math.max(spring, 4)) : 2.2;
      let settled = pulling && pa > 0.5;
      for (const s of rec.shards) {
        s.vx += (-spring * s.x - damp * s.vx) * dt;
        s.vy += (-spring * s.y - damp * s.vy + (pulling ? 0 : 700)) * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.va += (-spring * s.a - damp * s.va) * dt; s.a += s.va * dt;
        s.el.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0) rotate(${s.a.toFixed(2)}deg)`;
        s.edge.style.opacity = String(Math.max(0, 1 - age * 2.5));
        if (Math.abs(s.x) > 0.4 || Math.abs(s.y) > 0.4 || Math.abs(s.a) > 0.3) settled = false;
      }
      if (settled || (pulling && pa > 5)) {
        rec.restore();
        bursts.delete(rec);
      }
    }
    frame = bursts.size ? requestAnimationFrame(tick) : 0;
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

  function ricochet(el, cx, cy) {
    tink();
    const fixed = insideFixed(el), layer = layerFor(fixed);
    const x = cx + (fixed ? 0 : scrollX), y = cy + (fixed ? 0 : scrollY), start = rand(0, Math.PI * 2);
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

  const navigate = (link) => {
    const url = new URL(link.getAttribute("href"), location.href);
    const newTab = (/^https?:$/.test(url.protocol) && url.origin !== location.origin) || link.getAttribute("target") === "_blank";
    if (newTab) open(url.href, "_blank", "noopener");
    else location.href = url.href;
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.detail === 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const origin = event.target;
    if (!origin.closest || origin.closest(EXCLUDE)) return;
    const target = origin.closest(TARGETS);
    const brand = origin.closest(BRAND) || (target && (target.closest(BRAND) || target.querySelector(BRAND)));
    if (brand) {
      ricochet(target && !target.closest(BRAND) ? target : brand, event.clientX, event.clientY);
      const link = origin.closest("a[href]");
      if (link) {
        event.preventDefault();
        setTimeout(() => navigate(link), 260);
      }
      return;
    }
    if (!target || broken.has(target)) return;
    const link = target.closest("a[href]");
    if (!link && !getSelection().isCollapsed) return;
    const rec = burst(target, event.clientX, event.clientY, link ? "fall" : "burst");
    if (!rec) return;
    const now = performance.now();
    if (!link) {
      rec.pullAt = now + 550;
      return;
    }
    event.preventDefault();
    setTimeout(() => navigate(link), 340);
    rec.pullAt = now + 1600;
  });
  addEventListener("pageshow", (event) => {
    if (event.persisted) for (const rec of bursts) { rec.restore(); bursts.delete(rec); }
  });
})();
