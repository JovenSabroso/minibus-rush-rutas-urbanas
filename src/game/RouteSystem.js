import * as THREE from 'three';
import { BusStop } from './BusStop.js';

// Ruta fija de la fase 2: Terminal -> Mercado -> Centro -> Zona Sur.
// Cada parada se ubica sobre la acera de una manzana (2.5m adentro de su
// borde), no en medio del cruce de calles, para que los pasajeros esperen
// donde corresponde y el bus se detenga junto a la vereda.
const ROUTE_DEFINITIONS = [
  { name: 'TERMINAL', x: -56.5, z: -66 },
  { name: 'MERCADO CENTRAL', x: -9.5, z: -66 },
  { name: 'CENTRO', x: -9.5, z: 0 },
  { name: 'ZONA SUR', x: 56.5, z: 66 },
];

const ARRIVAL_RADIUS = 6.5; // metros, distancia para considerar "en la parada"
const MAX_BOARD_SPEED = 2.2; // m/s, el bus debe ir casi al paso para subir gente
const DWELL_TO_START = 1.0; // segundos quieto antes de empezar a embarcar
const BOARD_INTERVAL = 0.55; // segundos entre cada pasajero que sube
const ROUTE_COMPLETE_BONUS = 25; // Bs de recompensa al completar la ruta
const ROUTE_COMPLETE_BANNER_TIME = 3.5; // segundos que se muestra "RUTA COMPLETADA"

/**
 * RouteSystem
 * Controla la ruta activa: a que parada hay que llegar, cuando se activa el
 * embarque automatico de pasajeros, y que pasa al completar toda la ruta.
 */
export class RouteSystem {
  constructor(scene, gameState, rng) {
    this.gameState = gameState;

    this.stops = ROUTE_DEFINITIONS.map((def, index) => {
      const stop = new BusStop(def.name, new THREE.Vector3(def.x, 0, def.z), index, rng);
      scene.add(stop.group);
      return stop;
    });

    this.currentIndex = 0;
    this.routeCompleteTimer = 0;

    // Callbacks opcionales para que la UI reaccione a eventos puntuales
    // (en vez de tener que comparar estado cuadro a cuadro).
    this.onPassengerBoarded = null; // (fareType) => void
    this.onRouteComplete = null; // (bonusBs) => void

    this.uiState = {
      nextStopName: this.currentStop.name,
      distanceToNextStop: 0,
      waitingAtCurrent: this.currentStop.waiting.length,
      promptVisible: false,
      routeCompleteVisible: false,
      routeIndex: 0,
      routeTotal: this.stops.length,
      passengersDroppedOff: 0,
      lastBonus: ROUTE_COMPLETE_BONUS,
    };
  }

  get currentStop() {
    return this.stops[this.currentIndex];
  }

  update(delta, minibus) {
    for (const stop of this.stops) {
      stop.pulse(delta, stop === this.currentStop);
    }

    if (this.routeCompleteTimer > 0) {
      this.routeCompleteTimer -= delta;
    }
    this.uiState.routeCompleteVisible = this.routeCompleteTimer > 0;

    const stop = this.currentStop;
    const dx = minibus.mesh.position.x - stop.position.x;
    const dz = minibus.mesh.position.z - stop.position.z;
    const distance = Math.hypot(dx, dz);

    this.uiState.nextStopName = stop.name;
    this.uiState.distanceToNextStop = distance;
    this.uiState.waitingAtCurrent = stop.waiting.length;
    this.uiState.routeIndex = this.currentIndex;

    const inRange = distance <= ARRIVAL_RADIUS;
    this.uiState.promptVisible = inRange && stop.waiting.length > 0;

    const canDwell = inRange && stop.waiting.length > 0 && Math.abs(minibus.speed) <= MAX_BOARD_SPEED;
    if (!canDwell) {
      stop.dwellTimer = 0;
      return;
    }

    stop.dwellTimer += delta;
    if (stop.dwellTimer < DWELL_TO_START) return;

    if (!this.gameState.canBoard()) {
      // El minibus va lleno: no se puede subir a nadie mas en esta parada,
      // asi que se sigue de largo (evita que la ruta quede trabada para siempre).
      this._advance();
      return;
    }

    stop.boardTimer += delta;
    if (stop.boardTimer < BOARD_INTERVAL) return;
    stop.boardTimer = 0;

    const fareType = stop.boardNextPassenger();
    if (!fareType) return;

    this.gameState.boardPassenger(fareType.fare);
    this.gameState.addReputation(0.3); // transportar pasajeros correctamente mejora la reputacion
    if (this.onPassengerBoarded) this.onPassengerBoarded(fareType);

    if (stop.isDone) {
      this._advance();
    }
  }

  _advance() {
    // Los pasajeros se quedan a bordo durante todo el recorrido: nadie se
    // baja a mitad de ruta. Todos bajan juntos al llegar a la ultima parada.
    if (this.currentIndex < this.stops.length - 1) {
      this.currentIndex++;
    } else {
      this._completeRoute();
    }
  }

  _completeRoute() {
    // Guarda cuantos pasajeros bajan en esta parada final para que la UI
    // pueda mostrarlo (ej. "8 pasajeros bajaron").
    const passengersDroppedOff = this.gameState.passengersOnboard;

    this.gameState.addMoney(ROUTE_COMPLETE_BONUS);
    this.gameState.addReputation(4); // completar la ruta entera es la mejor senal de buen servicio
    this.gameState.dropOffAll();
    this.routeCompleteTimer = ROUTE_COMPLETE_BANNER_TIME;
    this.uiState.passengersDroppedOff = passengersDroppedOff;
    this.uiState.lastBonus = ROUTE_COMPLETE_BONUS;

    if (this.onRouteComplete) this.onRouteComplete(ROUTE_COMPLETE_BONUS, passengersDroppedOff);

    for (const stop of this.stops) stop.refillPassengers();
    this.currentIndex = 0;
  }
}
