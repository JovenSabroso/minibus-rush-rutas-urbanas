import * as THREE from 'three';

// Tipos de pasajero segun el concepto del juego: la mayoria paga tarifa
// normal, algunos son de "trayecto largo" y muy pocos son "especiales".
const FARE_TYPES = [
  { type: 'normal', fare: 2, weight: 0.65, color: 0x4a90d9 },
  { type: 'largo', fare: 3, weight: 0.25, color: 0x3ea66b },
  { type: 'especial', fare: 5, weight: 0.1, color: 0xf5b400 },
];

function pickFareType(rng) {
  const roll = rng();
  let acc = 0;
  for (const fareType of FARE_TYPES) {
    acc += fareType.weight;
    if (roll <= acc) return fareType;
  }
  return FARE_TYPES[0];
}

/**
 * BusStop
 * Parada de minibus: poste + letrero + anillo indicador en el piso, mas un
 * grupo de pasajeros esperando (geometria simple). El RouteSystem decide
 * cuando se activa el embarque; esta clase solo modela la parada en si.
 */
export class BusStop {
  constructor(name, position, order, rng) {
    this.name = name;
    this.position = position.clone();
    this.order = order;
    this.rng = rng;

    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.position.y = 0.22; // altura de la acera: la parada queda sobre la vereda, no en la calle
    this.group.name = `BusStop_${name}`;

    this.waiting = []; // { mesh, fareType }
    this.dwellTimer = 0; // segundos que el bus lleva quieto y en rango
    this.boardTimer = 0; // cuenta regresiva entre embarques individuales

    this._pulseT = 0;

    this._buildMarker();
    this.refillPassengers();
  }

  _buildMarker() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.2 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 8), poleMat);
    pole.position.y = 1.3;
    this.group.add(pole);

    const signMat = new THREE.MeshStandardMaterial({ color: 0x2b6fb3, roughness: 0.5 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.06), signMat);
    sign.position.set(0, 2.5, 0);
    this.group.add(sign);

    // Techito simple sobre el letrero (comun en las paradas urbanas).
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8452c, roughness: 0.6 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), roofMat);
    roof.position.set(0, 2.35, 0.35);
    this.group.add(roof);

    // Anillo en el suelo que marca la zona de parada; su opacidad/color
    // cambia segun sea la parada activa (ver pulse()).
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.9, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);
    this.ring = ring;
  }

  _buildPassengerMesh(shirtColor) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), bodyMat);
    body.position.y = 0.68;
    body.castShadow = true;
    group.add(body);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), headMat);
    head.position.y = 1.16;
    group.add(head);

    return group;
  }

  /** Genera un nuevo grupo de pasajeros esperando (usado al iniciar y al reiniciar la ruta). */
  refillPassengers() {
    for (const passenger of this.waiting) this.group.remove(passenger.mesh);
    this.waiting = [];
    this.dwellTimer = 0;
    this.boardTimer = 0;

    const count = 2 + Math.floor(this.rng() * 4); // entre 2 y 5 personas esperando
    for (let i = 0; i < count; i++) {
      const fareType = pickFareType(this.rng);
      const mesh = this._buildPassengerMesh(fareType.color);
      const angle = (i / count) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5 - 1.8);
      this.group.add(mesh);
      this.waiting.push({ mesh, fareType });
    }
  }

  /**
   * Agrega pasajeros extra a la fila de espera actual, sin tocar a los que
   * ya estaban. Usado por el evento aleatorio "mucha demanda de pasajeros"
   * (fase 4): esa parada en particular se llena mas de lo normal.
   */
  addExtraWaiting(count) {
    const startIndex = this.waiting.length;
    for (let i = 0; i < count; i++) {
      const fareType = pickFareType(this.rng);
      const mesh = this._buildPassengerMesh(fareType.color);
      const angle = ((startIndex + i) / (startIndex + count)) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5 - 1.8);
      this.group.add(mesh);
      this.waiting.push({ mesh, fareType });
    }
  }

  /** Hace subir a un pasajero al minibus (quita su mesh de la escena). Devuelve la tarifa. */
  boardNextPassenger() {
    const passenger = this.waiting.shift();
    if (!passenger) return null;
    this.group.remove(passenger.mesh);
    return passenger.fareType;
  }

  get isDone() {
    return this.waiting.length === 0;
  }

  /** Anima el anillo de la parada: mas visible y pulsante si es la parada activa. */
  pulse(delta, isActive) {
    this._pulseT += delta;
    const baseOpacity = isActive ? 0.4 : 0.1;
    const osc = isActive ? Math.sin(this._pulseT * 3.2) * 0.15 : 0;
    this.ring.material.opacity = Math.max(0, baseOpacity + osc);
    this.ring.material.color.set(isActive ? 0xf5d142 : 0x888888);
  }
}
