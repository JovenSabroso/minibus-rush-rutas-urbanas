import * as THREE from 'three';

/**
 * GasStation
 * Estructura procedural sencilla: canopy sobre columnas + dos surtidores.
 * Colores tipicos de gasolinera (rojo/blanco) para que se reconozca a la
 * distancia. El cuerpo del canopy se usa como obstaculo de colision.
 */
export class GasStation {
  constructor(position) {
    this.position = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = 'GasStation';

    this._build();
  }

  _build() {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d4, roughness: 0.5, metalness: 0.2 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xe8452c, roughness: 0.5 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.4 });
    const pumpTopMat = new THREE.MeshStandardMaterial({ color: 0x2b6fb3, roughness: 0.4 });

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 6), canopyMat);
    canopy.position.y = 4.4;
    this.group.add(canopy);
    this.solidMesh = canopy; // referencia para registrar colision (altura suficiente para no chocar con el bus por abajo... se registra igual como precaucion)

    const pillarPositions = [
      [-3.8, -2.4],
      [3.8, -2.4],
      [-3.8, 2.4],
      [3.8, 2.4],
    ];
    for (const [x, z] of pillarPositions) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 8), pillarMat);
      pillar.position.set(x, 2.2, z);
      this.group.add(pillar);
    }

    for (const side of [-1, 1]) {
      const pumpBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.5), pumpMat);
      pumpBase.position.set(side * 1.3, 0.65, 0);
      this.group.add(pumpBase);

      const pumpTop = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.55), pumpTopMat);
      pumpTop.position.set(side * 1.3, 1.45, 0);
      this.group.add(pumpTop);
    }

    // Letrero vertical simple.
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), pillarMat);
    signPole.position.set(-5, 2.5, -3.2);
    this.group.add(signPole);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.1), canopyMat);
    signBoard.position.set(-5, 5, -3.2);
    this.group.add(signBoard);
  }
}

/**
 * Garage (taller mecanico)
 * Nave sencilla con un "porton" oscuro simulando la entrada, mas un
 * letrero. Sirve de punto de reparacion del minibus.
 */
export class Garage {
  constructor(position) {
    this.position = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = 'Garage';

    this._build();
  }

  _build() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.9 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 });
    const signMat = new THREE.MeshStandardMaterial({ color: 0xf5b400, roughness: 0.5 });

    const building = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), wallMat);
    building.position.set(0, 2.5, 0);
    this.group.add(building);
    this.solidMesh = building;

    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.4, 7.3), roofMat);
    roof.position.set(0, 5.2, 0);
    this.group.add(roof);

    // Porton abierto (hueco oscuro) en la fachada que mira hacia la calle (-Z).
    const door = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.4, 0.15), doorMat);
    door.position.set(0, 1.9, -3.53);
    this.group.add(door);

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.1), signMat);
    signBoard.position.set(0, 4.6, -3.6);
    this.group.add(signBoard);
  }
}
