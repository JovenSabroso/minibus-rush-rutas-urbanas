import * as THREE from 'three';

/**
 * CameraSystem
 * Camara en tercera persona que sigue al minibus con suavizado (lerp).
 * Ofrece 3 modos que se ciclan con la tecla C:
 *   0 - Detras (clasica, media altura)
 *   1 - Elevada (mas alta y alejada, buena para ver la ciudad)
 *   2 - Cercana (pegada al vehiculo, sensacion de velocidad)
 */
export class CameraSystem {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target; // objeto con .mesh (Object3D) del vehiculo

    this.modes = [
      { name: 'Detras del minibús', offset: new THREE.Vector3(0, 3.2, -7.5), lookOffset: new THREE.Vector3(0, 1.2, 3), fov: 60 },
      { name: 'Vista elevada', offset: new THREE.Vector3(0, 6.5, -11), lookOffset: new THREE.Vector3(0, 1, 2), fov: 55 },
      { name: 'Vista cercana', offset: new THREE.Vector3(0, 1.9, -3.2), lookOffset: new THREE.Vector3(0, 1.3, 4), fov: 68 },
    ];
    this.currentModeIndex = 0;

    this._desiredPos = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._currentLookAt = new THREE.Vector3();

    this.positionSmoothing = 6; // mas alto = sigue mas rapido
    this.lookSmoothing = 8;
  }

  cycleMode() {
    this.currentModeIndex = (this.currentModeIndex + 1) % this.modes.length;
    this.camera.fov = this.modes[this.currentModeIndex].fov;
    this.camera.updateProjectionMatrix();
    return this.modes[this.currentModeIndex].name;
  }

  update(delta) {
    const mode = this.modes[this.currentModeIndex];
    const vehicle = this.target.mesh;

    // Convierte el offset local del modo actual a coordenadas de mundo
    // segun la orientacion actual del vehiculo.
    this._desiredPos.copy(mode.offset).applyQuaternion(vehicle.quaternion).add(vehicle.position);
    this._lookAt.copy(mode.lookOffset).applyQuaternion(vehicle.quaternion).add(vehicle.position);

    const posAlpha = 1 - Math.exp(-this.positionSmoothing * delta);
    const lookAlpha = 1 - Math.exp(-this.lookSmoothing * delta);

    this.camera.position.lerp(this._desiredPos, posAlpha);
    this._currentLookAt.lerp(this._lookAt, lookAlpha);
    this.camera.lookAt(this._currentLookAt);
  }
}
