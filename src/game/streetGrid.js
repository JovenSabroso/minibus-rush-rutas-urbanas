/**
 * streetGrid
 * Utilidad compartida para ubicar las calles "internas" de la grilla que
 * genera City (las que quedan entre manzanas, no las de borde). Tanto el
 * trafico NPC como los semaforos necesitan saber donde estan esas calles,
 * y esta es la misma formula que ya usa City para colocar los faroles.
 */

/**
 * @param {number} blocksCount - manzanas en ese eje (blocksX o blocksZ)
 * @param {number} step - blockSize + streetWidth
 * @param {number} blockSize
 * @param {number} streetWidth
 * @returns {number[]} coordenadas (en el eje perpendicular al recorrido) de
 *   cada calle interna, ordenadas de menor a mayor.
 */
export function internalStreetLines(blocksCount, step, blockSize, streetWidth) {
  const lines = [];
  // Solo las calles ENTRE manzanas (ix = 0 .. blocksCount-2): evita las
  // calles de borde para no saturar el mapa de trafico/semaforos en el
  // perimetro, que es puramente decorativo.
  for (let ix = 0; ix < blocksCount - 1; ix++) {
    const blockCenter = (ix - (blocksCount - 1) / 2) * step;
    lines.push(blockCenter + blockSize / 2 + streetWidth / 2);
  }
  return lines;
}
