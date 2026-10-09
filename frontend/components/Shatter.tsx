"use client";

import { useEffect } from "react";

/**
 * Tiro, como na home do tomoyo.systems: a mira dá o coice, o alvo leva um tranco, saem faíscas
 * e soa um tinido de vidro. Nada quebra. Só com mouse de verdade; campos de formulário ficam de fora.
 */

const TARGETS =
  "a[href], button, [role='button'], [role='option'], h1, h2, h3, p, dt, dd, td, th, li, img, svg, .tag, .kbd, .stat, .num, .panel__head, .panel__foot";
const EXCLUDE = "input, textarea, select, iframe, [contenteditable], .no-shatter, .scope";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
let audio: AudioContext | null = null;

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

/** Faíscas, tinido e um tranco no alvo. */
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
      const target = origin.closest(TARGETS) ?? origin;
      ricochet(target, event.clientX, event.clientY);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
