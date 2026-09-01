import * as THREE from 'three';
import { InputSystem } from './systems/InputSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { GameState } from './systems/GameState.js';
import { RouteSystem } from './systems/RouteSystem.js';
import { ServiceSystem } from './systems/ServiceSystem.js';
import { TrafficSystem } from './systems/TrafficSystem.js';
import { TrafficLightSystem } from './systems/TrafficLightSystem.js';
import { PoliceSystem } from './systems/PoliceSystem.js';
import { EventSystem } from './systems/EventSystem.js';
import { mulberry32 } from './systems/rng.js';
import { City } from './world/City.js';
import { Minibus } from './vehicles/Minibus.js';
import { HUD } from './components/HUD.js';

/**
 * Game
 * Orquesta la escena 3D, los sistemas y el bucle principal.
 * Fase 1: ciudad + minibus + camara + movimiento + colisiones basicas.
 */
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();

    this._initRenderer();
    this._initScene();
    this._initLights();

    this.input = new InputSystem();
    this.collisionSystem = new CollisionSystem();
    this.city = new City(this.scene, this.collisionSystem);

    this.gameState = new GameState();
    // Seed distinto al de la ciudad para que la cantidad/tipo de pasajeros
    // no quede correlacionada con el diseno de las manzanas.
    this.routeSystem = new RouteSystem(this.scene, this.gameState, mulberry32(4242));

    this.minibus = new Minibus();
    // Arranca en la calle junto a la primera parada (Terminal), mirando hacia ella.
    // La parada esta sobre la acera este de su manzana, asi que el bus arranca
    // en la calle al este, mirando hacia el oeste (-X) para encararla.
    const firstStop = this.routeSystem.currentStop.position;
    this.minibus.mesh.position.set(firstStop.x + 9, 0, firstStop.z);
    this.minibus.mesh.rotation.y = -Math.PI / 2;
    this.scene.add(this.minibus.mesh);

    this.cameraSystem = new CameraSystem(this.camera, this.minibus);
    this.hud = new HUD();

    this.serviceSystem = new ServiceSystem(this.scene, this.collisionSystem, this.input);
    this.serviceSystem.onToast = (text) => this.hud.showToast(text);

    this.routeSystem.onPassengerBoarded = (fareType) => this.hud.spawnMoneyPopup(fareType.fare);

    // --- Fase 4: trafico NPC, semaforos, policia y eventos aleatorios ---
    this.trafficSystem = new TrafficSystem(this.scene, this.city, mulberry32(555));
    this.trafficLightSystem = new TrafficLightSystem(this.scene, this.city, mulberry32(777));
    this.policeSystem = new PoliceSystem(this.scene, this.city, mulberry32(888));
    this.policeSystem.onFine = (text) => this.hud.showToast(text);
    // Pasar un semaforo en rojo es una infraccion de transito (la registra la policia).
    this.trafficLightSystem.onRedLightInfraction = (pos) => this.policeSystem.registerInfraction(this.gameState, pos);

    this.eventSystem = new EventSystem({
      minibus: this.minibus,
      trafficSystem: this.trafficSystem,
      policeSystem: this.policeSystem,
      routeSystem: this.routeSystem,
      rng: mulberry32(999),
      onToast: (text) => this.hud.showToast(text),
      onRainChange: (active) => this.hud.setRain(active),
    });

    // Cooldown para que un choque prolongado (bus empujado contra una pared)
    // no destruya la reputacion/carroceria cuadro a cuadro.
    this._collisionPenaltyCooldown = 0;
    // Mismo concepto pero para choques leves contra trafico NPC.
    this._trafficCollisionCooldown = 0;

    this.input.onKeyPressed('KeyC', () => this.cameraSystem.cycleMode());

    window.addEventListener('resize', () => this._onResize());

    this._onResize();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9cc4e0);
    this.scene.fog = new THREE.Fog(0x9cc4e0, 90, 420);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 800);
    this.camera.position.set(0, 5, -15);
  }

  _initLights() {
    // Luz ambiental suave para que las sombras no queden totalmente negras.
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    // Sol de mediodia altiplanico: luz fuerte y algo dura.
    const sun = new THREE.DirectionalLight(0xfff2d9, 1.15);
    sun.position.set(60, 90, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.far = 250;
    this.scene.add(sun);
    this.sun = sun;

    // Luz de relleno tenue para suavizar el lado en sombra de los edificios.
    const fill = new THREE.HemisphereLight(0xbcd8f0, 0x3a3a40, 0.4);
    this.scene.add(fill);
  }

  _onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  start() {
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _tick() {
    // Clamp del delta para evitar saltos grandes si la pestana pierde foco.
    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.minibus.update(delta, this.input);

    const collided = this.collisionSystem.resolveVehicleCollisions(this.minibus);
    this._collisionPenaltyCooldown = Math.max(0, this._collisionPenaltyCooldown - delta);
    if (collided && this._collisionPenaltyCooldown <= 0) {
      this.minibus.applyCollisionDamage();
      this.gameState.addReputation(-4);
      this._collisionPenaltyCooldown = 1.5;
    } else {
      // Manejar sin chocar recupera reputacion lentamente con el tiempo.
      this.gameState.addReputation(0.02 * delta);
    }

    // Choque leve contra trafico NPC: dano menor al de un edificio, sin
    // detener el vehiculo NPC (no tiene IA de reaccion, sigue su carril).
    const trafficCollided = this.trafficSystem.checkPlayerCollision(this.minibus);
    this._trafficCollisionCooldown = Math.max(0, this._trafficCollisionCooldown - delta);
    if (trafficCollided && this._trafficCollisionCooldown <= 0) {
      this.minibus.wear.carroceria = Math.max(0, this.minibus.wear.carroceria - 2);
      this.minibus.wear.suspension = Math.max(0, this.minibus.wear.suspension - 1);
      this.gameState.addReputation(-2);
      this._trafficCollisionCooldown = 1.2;
    }

    this.routeSystem.update(delta, this.minibus);
    this.serviceSystem.update(delta, this.minibus, this.gameState);
    this.trafficSystem.update(delta);
    this.trafficLightSystem.update(delta, this.minibus);
    this.policeSystem.update(delta);
    this.eventSystem.update(delta);
    this.cameraSystem.update(delta);
    this.city.animate(delta);

    this.hud.update(this.gameState, this.routeSystem, this.minibus, this.city, this.serviceSystem);

    this.renderer.render(this.scene, this.camera);
  }
}
