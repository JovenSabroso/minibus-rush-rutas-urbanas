import * as THREE from 'three';

/**
 * CollisionSystem
 * Version simple (fase 1): mantiene una lista de cajas (Box3) estaticas
 * -edificios, limites de la ciudad- y resuelve la colision del minibus
 * empujandolo fuera del obstaculo y anulando la velocidad hacia el.
 *
 * No es fisica real: es suficiente para que el jugador "sienta" los choques
 * sin atravesar geometria, que es el objetivo de un prototipo.
 */
export class CollisionSystem {
  constructor() {
    this.staticBoxes = [];
    this._vehicleBox = new THREE.Box3();
    this._prevPosition = new THREE.Vector3();
  }

  /** Registra un Object3D como obstaculo estatico (usa su bounding box actual). */
  addStaticObstacle(object3D) {
    const box = new THREE.Box3().setFromObject(object3D);
    this.staticBoxes.push(box);
  }

  addStaticBox(box3) {
    this.staticBoxes.push(box3);
  }

  /**
   * Comprueba y resuelve colisiones del vehiculo contra los obstaculos.
   * @param {Vehicle} vehicle - debe tener .mesh y .speed
   * @returns {boolean} true si hubo colision este frame
   */
  resolveVehicleCollisions(vehicle) {
    const halfSize = vehicle.collisionHalfExtents;
    const pos = vehicle.mesh.position;

    this._vehicleBox.min.set(pos.x - halfSize.x, pos.y, pos.z - halfSize.z);
    this._vehicleBox.max.set(pos.x + halfSize.x, pos.y + halfSize.y * 2, pos.z + halfSize.z);

    let collided = false;

    for (const box of this.staticBoxes) {
      if (this._vehicleBox.intersectsBox(box)) {
        collided = true;

        // Empuje simple: calcula el vector desde el centro del obstaculo
        // hacia el vehiculo y lo aleja lo minimo necesario.
        const boxCenter = box.getCenter(new THREE.Vector3());
        const pushDir = new THREE.Vector3(pos.x - boxCenter.x, 0, pos.z - boxCenter.z);
        if (pushDir.lengthSq() < 0.0001) pushDir.set(0, 0, 1);
        pushDir.normalize();

        pos.x += pushDir.x * 0.25;
        pos.z += pushDir.z * 0.25;

        // Frena bruscamente el vehiculo en un choque (danio leve implicito).
        vehicle.speed *= -0.15;
      }
    }

    return collided;
  }
}
