/**
 * @fileoverview ColorWheelPicker — a custom saturation/lightness
 * rectangle + hue slider, replacing the fixed preset-swatch color
 * list. Lets the user pick any color, not just a handful of presets.
 *
 * No schema/backend change needed for this at all — binders.cover_color
 * was already a plain text column storing an arbitrary hex string; it
 * never actually enforced "must be one of these N presets", that was
 * purely a UI limitation until now.
 *
 * value/onChange work in hex (e.g. "#e8627a"), matching what's already
 * stored — HSL is only used internally, for the picker's own math.
 */

import { useState, useRef, useCallback } from 'react';

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function ColorWheelPicker({ value, onChange }) {
  const boxRef = useRef(null);
  const [hsl, setHsl] = useState(() => hexToHsl(value));

  // Adjust state during render when `value` changes from outside
  // (e.g. opening the panel on a different binder) — React's own
  // recommended pattern for exactly this "sync internal state with an
  // external prop, but don't fight our own onChange updates" case
  // (see "Adjusting some state when a prop changes" in the React
  // docs). Comparing against a tracked previous value here, rather
  // than resetting in an effect, means React can incorporate the
  // change into this same render pass instead of committing a
  // stale frame and then correcting it a tick later.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setHsl(hexToHsl(value));
  }

  const updateFromPointer = useCallback((clientX, clientY) => {
    const rect = boxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const s = Math.round(x * 100);
    const l = Math.round((1 - y) * 100);
    setHsl(prev => {
      const next = { ...prev, s, l };
      onChange(hslToHex(next.h, next.s, next.l));
      return next;
    });
  }, [onChange]);

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };
  const handlePointerMove = (e) => {
    if (e.buttons !== 1) return; // only while actually dragging
    updateFromPointer(e.clientX, e.clientY);
  };

  const handleHueChange = (e) => {
    const h = Number(e.target.value);
    setHsl(prev => {
      const next = { ...prev, h };
      onChange(hslToHex(next.h, next.s, next.l));
      return next;
    });
  };

  return (
    <div className="color-wheel-picker">
      <div
        ref={boxRef}
        className="color-wheel-sat-light-box"
        style={{ backgroundColor: `hsl(${hsl.h}, 100%, 50%)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        role="slider"
        aria-label="Saturation and lightness"
        aria-valuetext={`Saturation ${hsl.s}%, Lightness ${hsl.l}%`}
      >
        <div className="color-wheel-white-gradient" />
        <div className="color-wheel-black-gradient" />
        <div
          className="color-wheel-dot"
          style={{ left: `${hsl.s}%`, top: `${100 - hsl.l}%` }}
        />
      </div>

      <input
        type="range"
        className="color-wheel-hue-slider"
        min="0"
        max="359"
        value={hsl.h}
        onChange={handleHueChange}
        aria-label="Hue"
      />
    </div>
  );
}