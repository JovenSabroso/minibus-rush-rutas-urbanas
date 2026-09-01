/**
 * InputSystem
 * Centraliza la lectura de teclado. Otros sistemas consultan el estado
 * en vez de escuchar eventos por su cuenta, para evitar duplicar listeners.
 */
export class InputSystem {
  constructor() {
    this.keys = new Set();

    // Callbacks para teclas "de un solo disparo" (no mantenidas), como C o ESC.
    this._onKeyDownOnce = new Map();

    window.addEventListener('keydown', (event) => this._handleKeyDown(event));
    window.addEventListener('keyup', (event) => this._handleKeyUp(event));

    // Evita que el scroll de la pagina se mueva con flechas/espacio.
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
  }

  _handleKeyDown(event) {
    const code = event.code;
    if (!this.keys.has(code)) {
      const cb = this._onKeyDownOnce.get(code);
      if (cb) cb();
    }
    this.keys.add(code);
  }

  _handleKeyUp(event) {
    this.keys.delete(event.code);
  }

  /** Registra una funcion que se dispara una sola vez al presionar `code`. */
  onKeyPressed(code, callback) {
    this._onKeyDownOnce.set(code, callback);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // Helpers de alto nivel usados por el vehiculo.
  get throttle() {
    return this.isDown('KeyW') || this.isDown('ArrowUp');
  }

  get brakeOrReverse() {
    return this.isDown('KeyS') || this.isDown('ArrowDown');
  }

  get steerLeft() {
    return this.isDown('KeyA') || this.isDown('ArrowLeft');
  }

  get steerRight() {
    return this.isDown('KeyD') || this.isDown('ArrowRight');
  }

  get handbrake() {
    return this.isDown('Space');
  }
}
