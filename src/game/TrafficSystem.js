import * as THREE from 'three';
import { buildTrafficVehicle } from './TrafficVehicles.js';
import { internalStreetLines } from './streetGrid.js';

const LANE_OFFSET = 2.25; // separacion del centro de calle para cada sentido (streetWidth=9 -> 2 carriles)
const COLLISION_RADIUS = 2.5; // metros, distancia para considerar choque leve con el jugador

// Peso relativo de aparicion de cada tipo, siguiendo el orden del concepto
// (automoviles, taxis, otros minibuses, camiones).
const KIND_WEIGHTS = [
  { kind: 'car', weight: 0.45, speed: [7, 9.5] },
  { kind: 'taxi', weight: 0.25, speed: [7.5, 10] },
  { kind: 'minibus', weight: 0.2, speed: [6.5, 8.5] },
  { kind: 'truck', weight: 0.1, speed: [4.5, 6] },
];

function pickKind(rng) {
  const roll = rng();
  let acc = 0;
  for (const entry of KIND_WEIGHTS) {
    acc += entry.weight;
    if (roll <= acc) return entry;
  }
  return KIND_WEIGHTS[0];
}

/**
 * TrafficSystem
 * Vehiculos NPC (autos, taxis, otros minibuses, camiones) que circulan en
 * linea recta por las calles internas de la ciudad, en dos carriles por
 * calle (uno por sentido). Sin IA de cruces: cuando un vehiculo sale del
 * area jugable reaparece en el extremo opuesto de su mismo carril.
 * Si el jugador choca contra uno, sufre un dano leve (fase 4 del concepto).
 */
export class TrafficSystem {
  constructor(scene, city, rng) {
    this.rng = rng;
    this.halfExtentX = city.halfExtentX;
    this.halfExtentZ = city.halfExtentZ;

    this.group = new THREE.Group();
    this.group.name = 'Traffic';
    scene.add(this.group);

    this._speedMultiplier = 1;
    this._speedMultiplierTimer = 0;

    this.vehicles = this._buildLanesAndVehicles(city);

    this._playerCollisionState = new Set(); // vehiculos ya "tocando" al jugador este frame (evita re-empuje doble)
  }

  _buildLanesAndVehicles(city) {
    const xs = internalStreetLines(city.blocksX, city.step, city.blockSize, city.streetWidth);
    const zs = internalStreetLines(city.blocksZ, city.step, city.blockSize, city.streetWidth);

    const lanes = [];
    for (const x of xs) {
      lanes.push({ axis: 'z', streetCoord: x, dir: 1, offset: -LANE_OFFSET, range: this.halfExtentZ });
      lanes.push({ axis: 'z', streetCoord: x, dir: -1, offset: LANE_OFFSET, range: this.halfExtentZ });
    }
    for (const z of zs) {
      lanes.push({ axis: 'x', streetCoord: z, dir: 1, offset: -LANE_OFFSET, range: this.halfExtentX });
      lanes.push({ axis: 'x', streetCoord: z, dir: -1, offset: LANE_OFFSET, range: this.halfExtentX });
    }

    const vehicles = [];
    for (const lane of lanes) {
      const count = 1 + (this.rng() < 0.5 ? 1 : 0); // 1 o 2 vehiculos por carril
      for (let i = 0; i < count; i++) {
        vehicles.push(this._spawnVehicle(lane));
      }
    }
    return vehicles;
  }

  _spawnVehicle(lane) {
    const entry = pickKind(this.rng);
    const mesh = buildTrafficVehicle(entry.kind, this.rng);
    const speed = entry.speed[0] + this.rng() * (entry.speed[1] - entry.speed[0]);
    const travelPos = (this.rng() * 2 - 1) * lane.range;

    const vehicle = { mesh, lane, speed, travelPos, stallTimer: 0 };
    this._applyTransform(vehicle);
    this.group.add(mesh);
    return vehicle;
  }

  _applyTransform(vehicle) {
    const { lane, travelPos, mesh } = vehicle;
    if (lane.axis === 'z') {
      mesh.position.set(lane.streetCoord + lane.offset, 0, travelPos);
      mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    } else {
      mesh.position.set(travelPos, 0, lane.streetCoord + lane.offset);
      mesh.rotation.y = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  update(delta) {
    if (this._speedMultiplierTimer > 0) {
      this._speedMultiplierTimer -= delta;
      if (this._speedMultiplierTimer <= 0) this._speedMultiplier = 1;
    }

    for (const vehicle of this.vehicles) {
      if (vehicle.stallTimer > 0) {
        vehicle.stallTimer -= delta;
        continue; // vehiculo detenido (evento "accidente"): no avanza
      }

      const step = vehicle.speed * this._speedMultiplier * vehicle.lane.dir * delta;
      vehicle.travelPos += step;

      const range = vehicle.lane.range;
      if (vehicle.travelPos > range) vehicle.travelPos = -range;
      else if (vehicle.travelPos < -range) vehicle.travelPos = range;

      this._applyTransform(vehicle);
    }
  }

  /**
   * Comprueba choques leves contra el jugador. Aplica un pequeno empuje y
   * frenada al minibus (el NPC sigue su camino, como pide el concepto: sin
   * IA avanzada). Devuelve true si hubo contacto este frame.
   */
  checkPlayerCollision(minibus) {
    const playerPos = minibus.mesh.position;
    let collided = false;

    for (const vehicle of this.vehicles) {
      const dx = playerPos.x - vehicle.mesh.position.x;
      const dz = playerPos.z - vehicle.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < COLLISION_RADIUS * COLLISION_RADIUS && distSq > 0.0001) {
        collided = true;
        const dist = Math.sqrt(distSq);
        const pushX = dx / dist;
        const pushZ = dz / dist;
        playerPos.x += pushX * 0.2;
        playerPos.z += pushZ * 0.2;
        minibus.speed *= 0.4; // frenada brusca por el golpe, mas suave que contra un edificio
      }
    }

    return collided;
  }

  /** Evento "trafico pesado": reduce la velocidad de todo el trafico un rato. */
  setGlobalSpeedMultiplier(multiplier, durationSeconds) {
    this._speedMultiplier = multiplier;
    this._speedMultiplierTimer = durationSeconds;
  }

  /** Evento "accidente": detiene un vehiculo al azar durante un rato. */
  stallRandomVehicle(durationSeconds) {
    if (this.vehicles.length === 0) return;
    const vehicle = this.vehicles[Math.floor(this.rng() * this.vehicles.length)];
    vehicle.stallTimer = durationSeconds;
  }
}
