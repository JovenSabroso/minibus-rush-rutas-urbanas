import * as THREE from 'three';

/**
 * TrafficVehicles
 * Fabrica de vehiculos NPC (autos, taxis, camiones y otros minibuses).
 * A diferencia del minibus del jugador, estos usan geometria y materiales
 * compartidos entre instancias (misma BoxGeometry/CylinderGeometry para
 * todos) para mantener el conteo de memoria bajo, tal como pide el
 * concepto ("geometrias reutilizables, evitar objetos innecesarios").
 */

// --- Geometrias compartidas (una sola instancia para todo el trafico) ---
const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 10);
const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

const CAR_PALETTE = [0xd8d8d8, 0xb03028, 0x2b5c8a, 0x2c2f33, 0xf2f0eb, 0x5a6270];
const TRUCK_CAB_COLOR = 0x3a6b8a;
const TRUCK_BOX_COLOR = 0xd9d4c4;
const NPC_MINIBUS_COLORS = [0x3ea66b, 0x2b6fb3, 0xc0392b];

function addWheels(group, halfWidth, wheelY, frontZ, rearZ) {
  const positions = [
    [-halfWidth, wheelY, frontZ],
    [halfWidth, wheelY, frontZ],
    [-halfWidth, wheelY, rearZ],
    [halfWidth, wheelY, rearZ],
  ];
  for (const [x, y, z] of positions) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  }
}

function buildCar(rng) {
  const group = new THREE.Group();
  const color = CAR_PALETTE[Math.floor(rng() * CAR_PALETTE.length)];
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x202832, roughness: 0.3, metalness: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 3.9), bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 2.0), glassMat);
  cabin.position.set(0, 1.15, -0.1);
  group.add(cabin);

  addWheels(group, 0.82, 0.35, 1.25, -1.25);
  return group;
}

function buildTaxi(rng) {
  // Un auto normal pero pintado de amarillo con techo distintivo, para que
  // se reconozca como taxi a la distancia sin necesitar geometria nueva.
  const group = buildCar(rng);
  const bodyMesh = group.children[0];
  bodyMesh.material = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.5, metalness: 0.1 });

  const roofSignMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5 });
  const roofSign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.55), roofSignMat);
  roofSign.position.set(0, 1.5, -0.1);
  group.add(roofSign);
  return group;
}

function buildTruck(rng) {
  const group = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color: TRUCK_CAB_COLOR, roughness: 0.55, metalness: 0.2 });
  const boxMat = new THREE.MeshStandardMaterial({ color: TRUCK_BOX_COLOR, roughness: 0.8 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x202832, roughness: 0.3, metalness: 0.3 });

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 1.7), cabMat);
  cab.position.set(0, 0.95, 2.2);
  cab.castShadow = true;
  group.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 0.08), glassMat);
  windshield.position.set(0, 1.35, 3.0);
  group.add(windshield);

  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.1, 4.3), boxMat);
  cargo.position.set(0, 1.35, -1.0);
  cargo.castShadow = true;
  group.add(cargo);

  addWheels(group, 0.95, 0.42, 2.0, -0.3);
  addWheels(group, 0.95, 0.42, -1.9, -2.7);
  return group;
}

function buildNpcMinibus(rng) {
  // Version simplificada del minibus del jugador: misma silueta general
  // pero sin las texturas Canvas2D (mas barata de instanciar varias veces).
  const group = new THREE.Group();
  const color = NPC_MINIBUS_COLORS[Math.floor(rng() * NPC_MINIBUS_COLORS.length)];
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.35, metalness: 0.4 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 4.8), bodyMat);
  chassis.position.y = 1.0;
  chassis.castShadow = true;
  group.add(chassis);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.5, 4.3), roofMat);
  roof.position.set(0, 1.9, -0.1);
  group.add(roof);

  const windowStrip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.55, 3.4), glassMat);
  windowStrip.position.set(0, 1.55, -0.2);
  group.add(windowStrip);

  addWheels(group, 1.05, 0.42, 1.65, -1.55);
  return group;
}

const BUILDERS = { car: buildCar, taxi: buildTaxi, truck: buildTruck, minibus: buildNpcMinibus };
export const TRAFFIC_VEHICLE_KINDS = Object.keys(BUILDERS);

/**
 * Construye un vehiculo NPC del tipo pedido.
 * @param {'car'|'taxi'|'truck'|'minibus'} kind
 * @param {() => number} rng
 */
export function buildTrafficVehicle(kind, rng) {
  const builder = BUILDERS[kind] ?? buildCar;
  const mesh = builder(rng);
  mesh.name = `Traffic_${kind}`;
  return mesh;
}
