import * as THREE from 'three';
import { GasStation, Garage } from '../world/ServiceStations.js';

const INTERACT_RADIUS = 7.5;
const MAX_INTERACT_SPEED = 1.5; // m/s, hay que estar casi detenido para interactuar
const FUEL_PRICE_PER_PERCENT = 0.5; // Bs por cada % de combustible repuesto
const REPAIR_PRICE_PER_POINT = 0.4; // Bs por cada punto de desgaste reparado (sumado en las 5 estadisticas)

/**
 * ServiceSystem
 * Gestiona la gasolinera (tecla F) y el garaje/taller (tecla G): detecta
 * cercania del minibus, calcula costos y aplica el repostaje/reparacion
 * cuando el jugador presiona la tecla correspondiente con dinero suficiente.
 */
export class ServiceSystem {
  constructor(scene, collisionSystem, input) {
    this.gasStation = new GasStation(new THREE.Vector3(-16.5, 0, 49.5));
    this.garage = new Garage(new THREE.Vector3(49.5, 0, -16.5));

    scene.add(this.gasStation.group, this.garage.group);

    // El canopy de la gasolinera es intencionalmente atravesable (se puede
    // conducir por debajo, como en la vida real); el taller si es solido.
    collisionSystem.addStaticObstacle(this.garage.solidMesh);

    this._fPressed = false;
    this._gPressed = false;
    input.onKeyPressed('KeyF', () => { this._fPressed = true; });
    input.onKeyPressed('KeyG', () => { this._gPressed = true; });

    this.uiState = {
      fuelPromptVisible: false,
      fuelCost: 0,
      garagePromptVisible: false,
      repairCost: 0,
    };

    this.onToast = null; // (text) => void, lo conecta el HUD
  }

  update(delta, minibus, gameState) {
    this._updateFuelPrompt(minibus, gameState);
    this._updateGaragePrompt(minibus, gameState);

    // Consume los flags de tecla presionada una sola vez por frame,
    // incluso si el jugador presiono lejos de cualquier estacion.
    this._fPressed = false;
    this._gPressed = false;
  }

  _horizontalDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  _updateFuelPrompt(minibus, gameState) {
    const dist = this._horizontalDistance(minibus.mesh.position, this.gasStation.position);
    const missing = minibus.maxFuel - minibus.fuel;
    const near = dist <= INTERACT_RADIUS && Math.abs(minibus.speed) <= MAX_INTERACT_SPEED;

    this.uiState.fuelPromptVisible = near && missing > 0.5;
    this.uiState.fuelCost = Math.ceil(missing * FUEL_PRICE_PER_PERCENT);

    if (this.uiState.fuelPromptVisible && this._fPressed) {
      if (gameState.money >= this.uiState.fuelCost) {
        gameState.addMoney(-this.uiState.fuelCost);
        minibus.refuel(missing);
        this._toast(`Tanque lleno (-${this.uiState.fuelCost} Bs)`);
      } else {
        this._toast('Dinero insuficiente para repostar');
      }
    }
  }

  _updateGaragePrompt(minibus, gameState) {
    const dist = this._horizontalDistance(minibus.mesh.position, this.garage.position);
    const totalWearMissing = Object.values(minibus.wear).reduce((sum, v) => sum + (100 - v), 0);
    const near = dist <= INTERACT_RADIUS && Math.abs(minibus.speed) <= MAX_INTERACT_SPEED;

    this.uiState.garagePromptVisible = near && totalWearMissing > 1;
    this.uiState.repairCost = Math.ceil(totalWearMissing * REPAIR_PRICE_PER_POINT);

    if (this.uiState.garagePromptVisible && this._gPressed) {
      if (gameState.money >= this.uiState.repairCost) {
        gameState.addMoney(-this.uiState.repairCost);
        minibus.repairAll();
        this._toast(`Minibús reparado (-${this.uiState.repairCost} Bs)`);
      } else {
        this._toast('Dinero insuficiente para reparar');
      }
    }
  }

  _toast(text) {
    if (this.onToast) this.onToast(text);
  }
}
