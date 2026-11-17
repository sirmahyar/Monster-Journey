import { useEffect, useRef } from "react";
import { ENEMY_TYPES } from "../../game/enemies.js";
import { creatureSprite } from "../render/creatures.js";
import { pickupSprite, shipSprite } from "../render/items.js";

function source(type, kind) {
  if (type === "creature") return creatureSprite(kind, 0, 1, false, ENEMY_TYPES[kind].r);
  if (type === "pickup") return pickupSprite(kind, kind === "crate" ? "laser" : undefined);
  return shipSprite(kind);
}

/**
 * Paints one in-game sprite into a small canvas so menus can reuse the game art.
 * @param {{ type?: "creature"|"pickup"|"ship", kind: string, size?: number }} props
 */
export function Icon({ type = "creature", kind, size = 48 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const g = canvas.getContext("2d");
    const image = source(type, kind).canvas;
    const k = Math.min(canvas.width / image.width, canvas.height / image.height);
    const w = image.width * k;
    const h = image.height * k;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }, [type, kind, size]);

  return <canvas ref={ref} className="icon" style={{ width: size, height: size }} aria-hidden="true" />;
}
