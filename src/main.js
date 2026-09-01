import './style.css';
import { Game } from './game.js';

/**
 * Punto de entrada del prototipo.
 * Fase 1: crea el juego directamente sobre el canvas (sin menu principal
 * todavia; el menu llega en la Fase 5). Muestra una pantalla de carga breve
 * mientras se genera la ciudad procedural.
 */
function boot() {
  const canvas = document.getElementById('game-canvas');
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBarFill = document.getElementById('loading-bar-fill');

  const game = new Game(canvas);
  game.start();

  // La generacion de la ciudad es sincronica y rapida, pero dejamos una
  // pequena animacion de carga para dar sensacion de "arranque" de app.
  requestAnimationFrame(() => {
    loadingBarFill.style.width = '100%';
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
    }, 500);
  });

  // Expuesto para depuracion rapida desde la consola del navegador.
  window.__game = game;
}

boot();
