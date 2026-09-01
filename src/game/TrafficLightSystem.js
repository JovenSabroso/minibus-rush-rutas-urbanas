import * as THREE from 'three';
import { internalStreetLines } from './streetGrid.js';

const GREEN_TIME = 5.0;
const YELLOW_TIME = 1.3;
const RED_TIME = 4.2;
const CYCLE_TIME = GREEN_TIME + YELLOW_TIME + RED_TIME;

const INTERSECTION_HALF_SIZE = 4.6; // ~streetWidth/2, zona que cubre el cruce completo
const MIN_SPEED_TO_INFRACT = 1.2; // m/s; evita contar como infraccion estar detenido sobre el cruce

const LIT_INTENSITY = 1.4;
const DIM_INTENSITY = 0.05;

/**
 * Un semaforo individual: poste + cabezal con 3 luces (rojo/amarillo/verde).
 * Cicla en el tiempo de forma independiente (fase inicial aleatoria) para
 * que no todos cambien exactamente a la vez.
 */
class TrafficLight {
  constructor(x, z, phaseOffset) {
    this.position = new THREE.Vector3(x, 0, z);
    this._t = phaseOffset;
    this.state = 'green';

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.name = 'TrafficLight';
    this._build();

    this.zone = new THREE.Box3(
      new THREE.Vector3(x - INTERSECTION_HALF_SIZE, -1, z - INTERSECTION_HALF_SIZE),
      new THREE.Vector3(x + INTERSECTION_HALF_SIZE, 5, z + INTERSECTION_HALF_SIZE)
    );
    this.playerWasInside = false;
  }

  _build() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.7 });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 8), poleMat);
    pole.position.y = 1.8;
    this.group.add(pole);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.35), housingMat);
    housing.position.y = 3.85;
    this.group.add(housing);

    this.lightMats = {
      red: new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: DIM_INTENSITY, roughness: 0.4 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xffcc33, emissiveIntensity: DIM_INTENSITY, roughness: 0.4 }),
      green: new THREE.MeshStandardMaterial({ color: 0x3ecb6b, emissive: 0x3ecb6b, emissiveIntensity: DIM_INTENSITY, roughness: 0.4 }),
    };

    const bulbGeo = new THREE.CircleGeometry(0.12, 10);
    const redBulb = new THREE.Mesh(bulbGeo, this.lightMats.red);
    redBulb.position.set(0, 4.2, 0.18);
    this.group.add(redBulb);

    const yellowBulb = new THREE.Mesh(bulbGeo, this.lightMats.yellow);
    yellowBulb.position.set(0, 3.85, 0.18);
    this.group.add(yellowBulb);

    const greenBulb = new THREE.Mesh(bulbGeo, this.lightMats.green);
    greenBulb.position.set(0, 3.5, 0.18);
    this.group.add(greenBulb);
  }

  update(delta) {
    this._t = (this._t + delta) % CYCLE_TIME;

    let state;
    if (this._t < GREEN_TIME) state = 'green';
    else if (this._t < GREEN_TIME + YELLOW_TIME) state = 'yellow';
    else state = 'red';

    if (state !== this.state) {
      this.state = state;
      for (const key of Object.keys(this.lightMats)) {
        this.lightMats[key].emissiveIntensity = key === state ? LIT_INTENSITY : DIM_INTENSITY;
      }
    }
  }
}

/**
 * TrafficLightSystem
 * Coloca semaforos funcionales en los cruces internos de la ciudad y
 * detecta cuando el jugador cruza uno en rojo (infraccion).
 */
export class TrafficLightSystem {
  constructor(scene, city, rng) {
    this.lights = [];

    const xs = internalStreetLines(city.blocksX, city.step, city.blockSize, city.streetWidth);
    const zs = internalStreetLines(city.blocksZ, city.step, city.blockSize, city.streetWidth);

    for (const x of xs) {
      for (const z of zs) {
        const light = new TrafficLight(x, z, rng() * CYCLE_TIME);
        scene.add(light.group);
        this.lights.push(light);
      }
    }

    // (infraccionPos: THREE.Vector3) => void — lo conecta game.js con PoliceSystem.
    this.onRedLightInfraction = null;
  }

  update(delta, minibus) {
    for (const light of this.lights) light.update(delta);

    const pos = minibus.mesh.position;
    const speed = Math.abs(minibus.speed);

    for (const light of this.lights) {
      const inside = light.zone.containsPoint(pos);
      if (inside && !light.playerWasInside && light.state === 'red' && speed > MIN_SPEED_TO_INFRACT) {
        if (this.onRedLightInfraction) this.onRedLightInfraction(light.position);
      }
      light.playerWasInside = inside;
    }
  }
}
