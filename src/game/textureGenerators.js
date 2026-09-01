import * as THREE from 'three';

/**
 * textureGenerators
 * Genera texturas del minibus 100% por codigo, dibujando sobre un
 * <canvas> en tiempo de ejecucion (Canvas2D). No se carga ninguna imagen
 * externa: esto mantiene el proyecto autocontenido y evita reproducir el
 * diseno de una marca/vehiculo real, cumpliendo las reglas del prototipo.
 */

function hexToRgb(hex) {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

function shadeRgba(rgb, amount, alpha) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(rgb.r + amount * 255);
  const g = clamp(rgb.g + amount * 255);
  const b = clamp(rgb.b + amount * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Textura de panel lateral/trasero: pintura con variaciones sutiles de
 * tono (no queda un color 100% plano), costuras verticales de chapa, una
 * franja de acento horizontal y mugre/oxido acumulado hacia la parte
 * inferior (cerca de ruedas y parachoques).
 */
export function createBodyPanelTexture(baseColorHex, stripeColorHex) {
  const width = 512;
  const height = 160;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColorHex);

  ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  ctx.fillRect(0, 0, width, height);

  // Variaciones sutiles de tono, como pintura desgastada por el sol y el uso.
  for (let i = 0; i < 16; i++) {
    const bx = Math.random() * width;
    const by = Math.random() * height;
    const r = 30 + Math.random() * 80;
    const shade = (Math.random() - 0.5) * 0.16;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0, shadeRgba(rgb, shade, 0.4));
    grad.addColorStop(1, shadeRgba(rgb, shade, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Costuras verticales de chapa entre paneles.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.lineWidth = 2;
  const seams = 5;
  for (let i = 1; i < seams; i++) {
    const x = (width / seams) * i;
    ctx.beginPath();
    ctx.moveTo(x, 6);
    ctx.lineTo(x, height - 6);
    ctx.stroke();
  }

  // Franja de acento horizontal, tipica de la pintura de un minibus urbano.
  if (stripeColorHex !== undefined) {
    const stripeRgb = hexToRgb(stripeColorHex);
    ctx.fillStyle = `rgb(${stripeRgb.r}, ${stripeRgb.g}, ${stripeRgb.b})`;
    ctx.fillRect(0, height * 0.56, width, height * 0.09);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, height * 0.56, width, height * 0.015);
  }

  // Mugre y oxido acumulado hacia la parte inferior (cerca de ruedas/parachoques).
  for (let i = 0; i < 45; i++) {
    const bx = Math.random() * width;
    const by = height * (0.72 + Math.random() * 0.28);
    const r = 6 + Math.random() * 20;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0, 'rgba(50, 32, 20, 0.32)');
    grad.addColorStop(1, 'rgba(50, 32, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  return makeTexture(canvas);
}

/** Textura del frente: mismo tratamiento de pintura + una rejilla simple. */
export function createGrilleTexture(baseColorHex) {
  const width = 256;
  const height = 168;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const rgb = hexToRgb(baseColorHex);

  ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 8; i++) {
    const bx = Math.random() * width;
    const by = Math.random() * height;
    const r = 20 + Math.random() * 50;
    const shade = (Math.random() - 0.5) * 0.14;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0, shadeRgba(rgb, shade, 0.35));
    grad.addColorStop(1, shadeRgba(rgb, shade, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Abertura de la rejilla: bien ancha, casi de esquina a esquina, como en
  // una van real (los faros 3D quedan justo en los bordes exteriores).
  const gx = width * 0.08;
  const gy = height * 0.4;
  const gw = width * 0.84;
  const gh = height * 0.34;
  ctx.fillStyle = '#1c1e22';
  ctx.fillRect(gx, gy, gw, gh);

  // Listones horizontales.
  ctx.strokeStyle = '#54585f';
  ctx.lineWidth = 3;
  const slats = 5;
  for (let i = 1; i <= slats; i++) {
    const y = gy + (gh / (slats + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(gx + 4, y);
    ctx.lineTo(gx + gw - 4, y);
    ctx.stroke();
  }

  // Mugre leve debajo de la rejilla.
  ctx.fillStyle = 'rgba(45, 30, 20, 0.22)';
  ctx.fillRect(0, height * 0.86, width, height * 0.14);

  return makeTexture(canvas);
}

/** Textura del letrero de destino frontal, con el numero/nombre de ruta. */
export function createRouteSignTexture(text) {
  const width = 256;
  const height = 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f2ede1';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#2c2f33';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  ctx.fillStyle = '#1c1e22';
  ctx.font = 'bold 30px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 2);

  return makeTexture(canvas);
}
