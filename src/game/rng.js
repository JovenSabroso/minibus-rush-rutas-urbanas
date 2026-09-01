/**
 * mulberry32
 * Generador de numeros pseudoaleatorios determinista y muy liviano.
 * Se usa para que la ciudad y las paradas se vean/comporten igual en cada
 * partida (mismo seed = mismo resultado), en vez de usar Math.random().
 * @param {number} seed
 * @returns {() => number} funcion que devuelve un float en [0, 1)
 */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
