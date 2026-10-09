"use client";

import { useEffect } from "react";

/**
 * Coisas quebráveis, portado do tomoyo.systems: um clique estilhaça o alvo em cacos que voam,
 * caem e são puxados de volta; a identidade da marca (mon, wordmark) ricocheteia com faísca e som.
 * Só com mouse de verdade; campos de formulário e o mapa de atalhos ficam de fora.
 */

const TARGETS =
  "a[href], button, [role='button'], [role='option'], h1, h2, h3, p, dt, dd, td, th, .tag, .kbd, .stat, .num, .recharts-bar-rectangle, .recharts-line-curve, .recharts-cartesian-axis-tick-value, .map-shape";
const EXCLUDE = "input, textarea, select, iframe, [contenteditable], [download], .no-shatter, .scope";
const BRAND = "[data-brand]";
const COPY_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "filter"
];
const SVG_NS = "http://www.w3.org/2000/svg";

type Point = [number, number];
type Shard = { el: HTMLElement; x: number; y: number; vx: number; vy: number; a: number; va: number; edge: SVGElement };
type Burst = { shards: Shard[]; t0: number; pullAt: number; restore: () => void };

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const brokenNow = new WeakSet<Element>();
const bursts = new Set<Burst>();
let frame = 0;
let lastTick = 0;
let audio: AudioContext | null = null;

/** Recorta um polígono ao retângulo [0,w]×[0,h] (Sutherland–Hodgman). */
function clipToBox(polygon: Point[], width: number, height: number): Point[] {
  const edges: Array<[(p: Point) => boolean, (a: Point, b: Point) => Point]> = [
    [(p) => p[0] >= 0, (a, b) => [0, a[1] + ((0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= width, (a, b) => [width, a[1] + ((width - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= 0, (a, b) => [a[0] + ((0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), 0]],
    [(p) => p[1] <= height, (a, b) => [a[0] + ((height - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), height]]
  ];
  let output = polygon;
  for (const [inside, intersect] of edges) {
    const input = output;
    output = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index];
      const previous = input[(index + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) {
          output.push(intersect(previous, current));
        }
        output.push(current);
      } else if (inside(previous)) {
        output.push(intersect(previous, current));
      }
    }
    if (!output.length) {
      break;
    }
  }
  return output;
}

const polygonArea = (polygon: Point[]) =>
  Math.abs(
    polygon.reduce((sum, [x, y], index) => {
      const [nx, ny] = polygon[(index + 1) % polygon.length];
      return sum + x * ny - nx * y;
    }, 0)
  ) / 2;

/** Divide um retângulo em cacos radiais a partir do ponto de impacto. */
function fragments(width: number, height: number, hitX: number, hitY: number): Point[][] {
  const count = Math.max(5, Math.min(12, Math.round(Math.sqrt(width * height) / 26)));
  const twoRings = width * height > 3000;
  const reach = Math.hypot(width, height) * 2;
  const start = rand(0, Math.PI * 2);
  const step = (Math.PI * 2) / count;
  const rays = Array.from({ length: count }, (_, index) => {
    const angle = start + index * step + rand(-0.35, 0.35) * step;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const toX = dx > 0 ? (width - hitX) / dx : dx < 0 ? -hitX / dx : Infinity;
    const toY = dy > 0 ? (height - hitY) / dy : dy < 0 ? -hitY / dy : Infinity;
    return { d: [dx, dy] as Point, r1: Math.min(toX, toY) * rand(0.3, 0.65) };
  });
  const at = (index: number, distance: number): Point => [hitX + rays[index].d[0] * distance, hitY + rays[index].d[1] * distance];
  const polygons: Point[][] = [];
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    if (twoRings) {
      polygons.push([[hitX, hitY], at(index, rays[index].r1), at(next, rays[next].r1)]);
      polygons.push([at(index, rays[index].r1), at(index, reach), at(next, reach), at(next, rays[next].r1)]);
    } else {
      polygons.push([[hitX, hitY], at(index, reach), at(next, reach)]);
    }
  }
  return polygons.map((polygon) => clipToBox(polygon, width, height)).filter((polygon) => polygon.length >= 3 && polygonArea(polygon) > 2);
}

function copyStyles(source: Element, target: Element, everything: boolean) {
  const computed = getComputedStyle(source);
  const style = (target as HTMLElement).style;
  if (everything) {
    for (let index = 0; index < computed.length; index += 1) {
      style.setProperty(computed[index], computed.getPropertyValue(computed[index]));
    }
  } else {
    for (const property of COPY_PROPS) {
      style.setProperty(property, computed.getPropertyValue(property));
    }
  }
  style.setProperty("animation", "none");
  style.setProperty("transition", "none");
}

/** Clona o elemento com os estilos congelados, para os cacos parecerem o original. */
function cloneForShards(element: Element, box: DOMRect): Element {
  const clone = element.cloneNode(true) as Element;
  const sources = [element, ...element.querySelectorAll("*")];
  const targets = [clone, ...clone.querySelectorAll("*")];
  const innerSvg = element instanceof SVGElement && !(element instanceof SVGSVGElement);
  sources.slice(0, 160).forEach((source, index) => copyStyles(source, targets[index], !innerSvg));
  targets.forEach((target) => target.removeAttribute("id"));
  if (innerSvg) {
    const parent = element.parentNode as SVGGraphicsElement;
    const matrix = new DOMMatrix().translate(-box.left, -box.top).multiply(parent.getScreenCTM() ?? new DOMMatrix());
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", String(box.width));
    svg.setAttribute("height", String(box.height));
    svg.style.overflow = "visible";
    svg.style.display = "block";
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("transform", `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    group.appendChild(clone);
    svg.appendChild(group);
    return svg;
  }
  const style = (clone as HTMLElement).style;
  const display = getComputedStyle(element).display;
  Object.assign(style, {
    margin: "0",
    position: "relative",
    left: "0",
    top: "0",
    transform: "none",
    translate: "none",
    rotate: "none",
    scale: "none",
    width: `${box.width}px`,
    height: `${box.height}px`,
    boxSizing: "border-box",
    opacity: "1"
  });
  if (display.startsWith("inline") && display !== "inline-block") {
    style.display = "inline-block";
  }
  if (display === "inline") {
    style.whiteSpace = "nowrap";
  }
  return clone;
}

function insideFixed(element: Element): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (getComputedStyle(node).position === "fixed") {
      return true;
    }
  }
  return false;
}

function layerFor(fixed: boolean): HTMLElement {
  const className = fixed ? "shatter-layer shatter-layer--fixed" : "shatter-layer";
  let layer = document.querySelector<HTMLElement>(`.${className.split(" ").join(".")}`);
  if (!layer) {
    layer = document.createElement("div");
    layer.className = className;
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function burst(element: Element, clientX: number, clientY: number, kind: "burst" | "fall"): Burst | null {
  const box = element.getBoundingClientRect();
  if (box.width < 4 || box.height < 4 || box.width * box.height > innerWidth * innerHeight * 0.6) {
    return null;
  }
  const fixed = insideFixed(element);
  const left = box.left + (fixed ? 0 : scrollX);
  const top = box.top + (fixed ? 0 : scrollY);
  const hitX = Math.min(Math.max(clientX - box.left, 1), box.width - 1);
  const hitY = Math.min(Math.max(clientY - box.top, 1), box.height - 1);
  const polygons = fragments(box.width, box.height, hitX, hitY);
  if (!polygons.length) {
    return null;
  }
  const clone = cloneForShards(element, box);
  const layer = layerFor(fixed);
  const power = Math.min(2, Math.max(0.8, Math.sqrt(box.width * box.height) / 150));

  const shards = polygons.map((polygon): Shard => {
    const [cx, cy] = polygon.reduce(([sx, sy], [px, py]) => [sx + px / polygon.length, sy + py / polygon.length], [0, 0]);
    const shard = document.createElement("div");
    shard.className = "shard";
    Object.assign(shard.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      clipPath: `polygon(${polygon.map(([px, py]) => `${px.toFixed(1)}px ${py.toFixed(1)}px`).join(",")})`,
      transformOrigin: `${cx}px ${cy}px`
    });
    shard.appendChild(clone.cloneNode(true));
    const edge = document.createElementNS(SVG_NS, "svg");
    edge.setAttribute("class", "shard__edge");
    edge.setAttribute("width", String(box.width));
    edge.setAttribute("height", String(box.height));
    const outline = document.createElementNS(SVG_NS, "polygon");
    outline.setAttribute("points", polygon.map(([px, py]) => `${px},${py}`).join(" "));
    edge.appendChild(outline);
    shard.appendChild(edge);
    layer.appendChild(shard);
    let dx = cx - hitX;
    let dy = cy - hitY;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const speed = rand(240, 560) * power * (kind === "burst" ? 1 : 0.8);
    return { el: shard, x: 0, y: 0, vx: dx * speed, vy: dy * speed - rand(60, 180), a: 0, va: rand(-1, 1) * rand(180, 520), edge };
  });

  const flash = document.createElement("div");
  flash.className = "shatter-flash";
  Object.assign(flash.style, { left: `${left + hitX}px`, top: `${top + hitY}px` });
  layer.appendChild(flash);
  flash.animate(
    [
      { transform: "translate(-50%,-50%) scale(0)", opacity: 0.6 },
      { transform: `translate(-50%,-50%) scale(${Math.min(4, Math.max(box.width, box.height) / 40)})`, opacity: 0 }
    ],
    { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" }
  ).onfinish = () => flash.remove();

  const target = element as HTMLElement;
  const saved = {
    opacity: target.style.getPropertyValue("opacity"),
    priority: target.style.getPropertyPriority("opacity"),
    transition: target.style.getPropertyValue("transition")
  };
  target.style.setProperty("transition", "none");
  target.style.setProperty("opacity", "0", "important");
  brokenNow.add(element);

  const record: Burst = {
    shards,
    t0: performance.now(),
    pullAt: Infinity,
    restore: () => {
      shards.forEach((shard) => shard.el.remove());
      target.style.removeProperty("opacity");
      if (saved.opacity) {
        target.style.setProperty("opacity", saved.opacity, saved.priority);
      }
      target.style.setProperty("transition", saved.transition);
      if (!saved.transition) {
        target.style.removeProperty("transition");
      }
      brokenNow.delete(element);
    }
  };
  bursts.add(record);
  if (!frame) {
    lastTick = performance.now();
    frame = requestAnimationFrame(tick);
  }
  return record;
}

/** Física dos cacos: gravidade, depois uma mola que os puxa de volta ao lugar e restaura o original. */
function tick(now: number) {
  const dt = Math.min(0.04, (now - lastTick) / 1000);
  lastTick = now;
  for (const record of bursts) {
    const age = (now - record.t0) / 1000;
    const pulling = now >= record.pullAt;
    const pullAge = pulling ? (now - record.pullAt) / 1000 : 0;
    const spring = pulling ? 70 * Math.min(1, (pullAge / 1.3) ** 2) : 0;
    const damping = pulling ? 2 * Math.sqrt(Math.max(spring, 4)) : 2.2;
    let settled = pulling && pullAge > 0.5;
    for (const shard of record.shards) {
      const ax = -spring * shard.x - damping * shard.vx;
      const ay = -spring * shard.y - damping * shard.vy + (pulling ? 0 : 700);
      shard.vx += ax * dt;
      shard.vy += ay * dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.va += (-spring * shard.a - damping * shard.va) * dt;
      shard.a += shard.va * dt;
      shard.el.style.transform = `translate3d(${shard.x.toFixed(2)}px,${shard.y.toFixed(2)}px,0) rotate(${shard.a.toFixed(2)}deg)`;
      shard.edge.style.opacity = String(Math.max(0, 1 - age * 2.5));
      if (Math.abs(shard.x) > 0.4 || Math.abs(shard.y) > 0.4 || Math.abs(shard.a) > 0.3) {
        settled = false;
      }
    }
    if (settled || (pulling && pullAge > 5)) {
      record.restore();
      bursts.delete(record);
    }
  }
  frame = bursts.size ? requestAnimationFrame(tick) : 0;
}

/** Tinido de vidro sintetizado: ruído curto filtrado + parciais inarmônicos + um assobio que cai. */
function tink() {
  try {
    audio ??= new AudioContext();
  } catch {
    return;
  }
  const context = audio;
  const start = context.currentTime + 0.005;
  if (context.state === "suspended") {
    void context.resume();
  }
  const master = context.createGain();
  master.gain.value = 0.16;
  master.connect(context.destination);

  const buffer = context.createBuffer(1, Math.round(context.sampleRate * 0.03), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length) ** 2;
  }
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 0.9;
  noise.connect(band).connect(master);
  noise.start(start);

  const base = rand(1700, 2500);
  for (const [ratio, gain, length] of [
    [1, 0.5, 0.55],
    [2.76, 0.28, 0.35],
    [5.4, 0.16, 0.2],
    [8.93, 0.08, 0.12]
  ]) {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.frequency.value = base * ratio;
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }
  const whistle = context.createOscillator();
  const whistleEnv = context.createGain();
  whistle.type = "triangle";
  whistle.frequency.setValueAtTime(rand(3400, 4200), start + 0.02);
  whistle.frequency.exponentialRampToValueAtTime(rand(700, 1000), start + 0.4);
  whistleEnv.gain.setValueAtTime(0.0001, start);
  whistleEnv.gain.linearRampToValueAtTime(0.12, start + 0.04);
  whistleEnv.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
  whistle.connect(whistleEnv).connect(master);
  whistle.start(start);
  whistle.stop(start + 0.45);
}

/** A marca não quebra: faíscas, tinido e um tranco. */
function ricochet(element: Element, clientX: number, clientY: number) {
  tink();
  const fixed = insideFixed(element);
  const layer = layerFor(fixed);
  const x = clientX + (fixed ? 0 : scrollX);
  const y = clientY + (fixed ? 0 : scrollY);
  const start = rand(0, Math.PI * 2);
  for (let index = 0; index < 7; index += 1) {
    const spark = document.createElement("div");
    spark.className = "ricochet-spark";
    Object.assign(spark.style, { left: `${x}px`, top: `${y}px` });
    layer.appendChild(spark);
    const angle = start + (index / 7) * Math.PI * 2 + rand(-0.3, 0.3);
    const distance = rand(26, 64);
    const degrees = (angle * 180) / Math.PI;
    spark.animate(
      [
        { transform: `translate(-50%,-50%) rotate(${degrees}deg) translateX(4px) scaleX(1)`, opacity: 1 },
        { transform: `translate(-50%,-50%) rotate(${degrees}deg) translateX(${distance}px) scaleX(.3)`, opacity: 0 }
      ],
      { duration: rand(220, 360), easing: "cubic-bezier(.1,.7,.3,1)" }
    ).onfinish = () => spark.remove();
  }
  const box = element.getBoundingClientRect();
  const side = Math.sign(box.left + box.width / 2 - clientX) || 1;
  (element as HTMLElement).animate?.(
    [{ translate: "0 0" }, { translate: `${side * 3}px -1px` }, { translate: `${-side * 2}px 1px` }, { translate: `${side}px 0` }, { translate: "0 0" }],
    { duration: 220, easing: "ease-out" }
  );
}

function restoreAll() {
  for (const record of bursts) {
    record.restore();
    bursts.delete(record);
  }
}

export function Shatter() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.detail === 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const origin = event.target as Element | null;
      if (!origin?.closest || origin.closest(EXCLUDE)) {
        return;
      }
      const target = origin.closest(TARGETS);
      const brand = origin.closest(BRAND) ?? target?.closest(BRAND) ?? target?.querySelector(BRAND);
      if (brand) {
        ricochet(target && !target.closest(BRAND) ? target : brand, event.clientX, event.clientY);
        return;
      }
      if (!target || brokenNow.has(target)) {
        return;
      }
      const link = target.closest("a[href]");
      if (!link && !getSelection()?.isCollapsed) {
        return;
      }
      const record = burst(target, event.clientX, event.clientY, link ? "fall" : "burst");
      if (record) {
        // Links navegam pelo Next normalmente; os cacos ficam um instante sobre a tela nova.
        record.pullAt = performance.now() + (link ? 900 : 550);
      }
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        restoreAll();
      }
    }
    document.addEventListener("click", onClick);
    addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick);
      removeEventListener("pageshow", onPageShow);
      restoreAll();
    };
  }, []);

  return null;
}
