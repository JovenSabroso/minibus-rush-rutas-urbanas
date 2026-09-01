import * as THREE from 'three';
import { mulberry32 } from '../systems/rng.js';

const BUILDING_COLORS = [0xe8452c, 0x2b6fb3, 0x3ea66b, 0xf5b400, 0x8e44ad, 0xd35400, 0x16a085, 0xc0392b, 0xe67e22];

// Tonos de ladrillo/concreto sin pintar, para los pisos superiores "a medio
// construir" tipicos de El Alto (se sigue construyendo hacia arriba con los anios).
const RAW_FACADE_COLORS = [0xa8674a, 0x9a958c, 0xb0aa9e, 0x8c7266];

/**
 * City
 * Genera de forma procedural un barrio ficticio inspirado en La Paz / El Alto:
 * grilla de manzanas con edificios coloridos, aceras, calles, faroles,
 * montañas de fondo y un teleférico decorativo.
 *
 * Fase 1: solo geometria + colisiones estaticas basicas.
 */
export class City {
  constructor(scene, collisionSystem) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.group = new THREE.Group();
    this.group.name = 'City';

    this._rng = mulberry32(1337);
    this._cableCars = [];

    // --- Parametros de la grilla urbana ---
    this.blocksX = 5;
    this.blocksZ = 5;
    this.blockSize = 24;
    this.streetWidth = 9;
    this.step = this.blockSize + this.streetWidth;

    this.halfExtentX = (this.blocksX * this.step) / 2;
    this.halfExtentZ = (this.blocksZ * this.step) / 2;

    this._buildGround();
    this._buildBlocks();
    this._buildAvenueMarkings();
    this._buildStreetlights();
    this._buildMountains();
    this._buildCableCar();
    this._buildBoundaryColliders();

    scene.add(this.group);
  }

  _buildGround() {
    const margin = 400;
    const groundGeo = new THREE.PlaneGeometry(this.halfExtentX * 2 + margin, this.halfExtentZ * 2 + margin);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  _buildBlocks() {
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.95 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x555a5f, roughness: 0.6, metalness: 0.3 });
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.85, metalness: 0.3 });
    const rawFacadeMats = RAW_FACADE_COLORS.map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.97, metalness: 0 })
    );

    for (let ix = 0; ix < this.blocksX; ix++) {
      for (let iz = 0; iz < this.blocksZ; iz++) {
        const cx = (ix - (this.blocksX - 1) / 2) * this.step;
        const cz = (iz - (this.blocksZ - 1) / 2) * this.step;

        // Acera / plataforma de la manzana, ligeramente elevada sobre la calle.
        const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(this.blockSize, 0.22, this.blockSize), sidewalkMat);
        sidewalk.position.set(cx, 0.11, cz);
        sidewalk.receiveShadow = true;
        this.group.add(sidewalk);

        this._buildBuildingOnBlock(cx, cz, tankMat, rebarMat, rawFacadeMats);
      }
    }
  }

  _buildBuildingOnBlock(cx, cz, tankMat, rebarMat, rawFacadeMats) {
    const rng = this._rng;
    const margin = 3.5; // deja espacio de acera visible alrededor del edificio
    const maxFootprint = this.blockSize - margin * 2;

    const width = maxFootprint * (0.55 + rng() * 0.4);
    const depth = maxFootprint * (0.55 + rng() * 0.4);
    const height = 6 + rng() * 17;
    const color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.9 });

    const offsetX = (rng() - 0.5) * (this.blockSize - width - margin);
    const offsetZ = (rng() - 0.5) * (this.blockSize - depth - margin);
    const baseX = cx + offsetX;
    const baseZ = cz + offsetZ;
    const groundY = 0.22;

    // Los edificios mas altos se ven "a medio construir": planta baja pintada
    // y pisos superiores en ladrillo/concreto crudo, como si algun dia fueran
    // a seguir construyendo hacia arriba (muy tipico de El Alto).
    const isUnfinished = height > 9;
    let paintedHeight = height;

    if (isUnfinished) {
      paintedHeight = height * (0.28 + rng() * 0.15);
      const rawHeight = height - paintedHeight;
      const rawMat = rawFacadeMats[Math.floor(rng() * rawFacadeMats.length)];

      const rawFloor = new THREE.Mesh(new THREE.BoxGeometry(width * 0.985, rawHeight, depth * 0.985), rawMat);
      rawFloor.position.set(baseX, groundY + paintedHeight + rawHeight / 2, baseZ);
      rawFloor.castShadow = true;
      rawFloor.receiveShadow = true;
      this.group.add(rawFloor);
    }

    const paintedFloor = new THREE.Mesh(new THREE.BoxGeometry(width, paintedHeight, depth), bodyMat);
    paintedFloor.position.set(baseX, groundY + paintedHeight / 2, baseZ);
    paintedFloor.castShadow = true;
    paintedFloor.receiveShadow = true;
    this.group.add(paintedFloor);

    // Capa/losa superior mas oscura, comun en azoteas de La Paz/El Alto.
    const topY = groundY + height;
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.02, 0.4, depth * 1.02), roofMat);
    roofCap.position.set(baseX, topY + 0.2, baseZ);
    this.group.add(roofCap);

    // Tanque de agua en la azotea (detalle tipico del skyline paceno/alteno).
    if (rng() > 0.35) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 8), tankMat);
      tank.position.set(baseX + width * 0.25, topY + 1.1, baseZ - depth * 0.25);
      this.group.add(tank);
    }

    // Varillas de fierro asomando del techo: senial de que la construccion
    // "seguira" en algun momento. Solo en los edificios sin terminar.
    if (isUnfinished) {
      this._addRebar(baseX, baseZ, width, depth, topY + 0.4, rebarMat);
    }

    // Registrar solo la planta baja como obstaculo: el vehiculo nunca llega
    // a la altura de los pisos superiores, asi que alcanza con la base.
    this.collisionSystem.addStaticObstacle(paintedFloor);
  }

  _addRebar(baseX, baseZ, width, depth, startY, rebarMat) {
    const rng = this._rng;
    const count = 3 + Math.floor(rng() * 5); // entre 3 y 7 varillas
    for (let i = 0; i < count; i++) {
      const rodHeight = 0.6 + rng() * 1.0;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, rodHeight, 5), rebarMat);
      rod.position.set(
        baseX + (rng() - 0.5) * width * 0.7,
        startY + rodHeight / 2,
        baseZ + (rng() - 0.5) * depth * 0.7
      );
      // Ligera inclinacion aleatoria: nunca quedan perfectamente rectas.
      rod.rotation.x = (rng() - 0.5) * 0.25;
      rod.rotation.z = (rng() - 0.5) * 0.25;
      this.group.add(rod);
    }
  }

  _buildAvenueMarkings() {
    // Lineas centrales amarillas discontinuas en las dos avenidas principales
    // que cruzan el centro de la ciudad (una en X, una en Z).
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf5d142, roughness: 0.6 });
    const stripeLength = 1.6;
    const gap = 1.4;
    const totalLength = Math.max(this.halfExtentX, this.halfExtentZ) * 2;
    const count = Math.floor(totalLength / (stripeLength + gap));

    for (let i = 0; i < count; i++) {
      const pos = -totalLength / 2 + i * (stripeLength + gap);

      const stripeH = new THREE.Mesh(new THREE.BoxGeometry(stripeLength, 0.02, 0.25), stripeMat);
      stripeH.position.set(pos, 0.02, 0);
      this.group.add(stripeH);

      const stripeV = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, stripeLength), stripeMat);
      stripeV.position.set(0, 0.02, pos);
      this.group.add(stripeV);
    }
  }

  _buildStreetlights() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c9, emissive: 0xffe27a, emissiveIntensity: 0.4, roughness: 0.5 });

    // Coloca faroles solo en algunas esquinas para no saturar la escena.
    for (let ix = 0; ix < this.blocksX; ix++) {
      for (let iz = 0; iz < this.blocksZ; iz++) {
        if ((ix + iz) % 2 !== 0) continue;

        const cx = (ix - (this.blocksX - 1) / 2) * this.step + this.blockSize / 2 + this.streetWidth / 2;
        const cz = (iz - (this.blocksZ - 1) / 2) * this.step + this.blockSize / 2 + this.streetWidth / 2;

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), poleMat);
        pole.position.set(cx, 2.1, cz);
        this.group.add(pole);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), lampMat);
        lamp.position.set(cx, 4.25, cz);
        this.group.add(lamp);
      }
    }
  }

  _buildMountains() {
    // Cordillera de fondo: conos grandes y de baja poligonizacion, muy alejados,
    // puramente decorativos (no forman parte del area jugable).
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x6b5b57, roughness: 1, flatShading: true });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.9, flatShading: true });

    const peaks = [
      { x: -220, z: -420, r: 90, h: 190, snow: false },
      { x: -60, z: -460, r: 130, h: 260, snow: true }, // pico nevado, evoca al Illimani
      { x: 150, z: -430, r: 100, h: 210, snow: false },
      { x: 320, z: -400, r: 80, h: 170, snow: false },
      { x: -350, z: -380, r: 75, h: 150, snow: false },
    ];

    for (const peak of peaks) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(peak.r, peak.h, 6), mountainMat);
      cone.position.set(peak.x, peak.h / 2, peak.z);
      this.group.add(cone);

      if (peak.snow) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(peak.r * 0.32, peak.h * 0.3, 6), snowCapMat);
        cap.position.set(peak.x, peak.h * 0.87, peak.z);
        this.group.add(cap);
      }
    }
  }

  _buildCableCar() {
    // Teleferico decorativo: dos torres y cabinas que se deslizan por un cable,
    // como elemento visual distintivo de La Paz/El Alto. No es jugable en fase 1.
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x777d85, roughness: 0.6, metalness: 0.3 });
    const cabinColors = [0xe8452c, 0xf5b400, 0x3ea66b];

    const towerA = new THREE.Vector3(-this.halfExtentX + 20, 0, this.halfExtentZ - 10);
    const towerB = new THREE.Vector3(this.halfExtentX - 30, 0, -this.halfExtentZ + 40);
    const cableHeight = 38;

    for (const base of [towerA, towerB]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, cableHeight, 1.4), towerMat);
      tower.position.set(base.x, cableHeight / 2, base.z);
      this.group.add(tower);
    }

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(towerA.x, cableHeight, towerA.z),
      new THREE.Vector3(towerB.x, cableHeight, towerB.z),
    ]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x1a1a1a }));
    this.group.add(line);

    // Cabinas que avanzan lentamente a lo largo del cable (ver animate()).
    for (let i = 0; i < cabinColors.length; i++) {
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshStandardMaterial({ color: cabinColors[i], roughness: 0.5 })
      );
      cabin.position.set(towerA.x, cableHeight - 0.6, towerA.z);
      this.group.add(cabin);
      this._cableCars.push({ mesh: cabin, t: i / cabinColors.length, from: towerA, to: towerB, height: cableHeight });
    }
  }

  _buildBoundaryColliders() {
    // Muros invisibles en el perimetro jugable para que el jugador no se
    // aleje indefinidamente hacia las montanas decorativas.
    const margin = this.streetWidth; // deja la ultima calle transitable
    const outerX = this.halfExtentX + margin;
    const outerZ = this.halfExtentZ + margin;
    const thickness = 4;
    const wallHeight = 10;

    const walls = [
      new THREE.Box3(new THREE.Vector3(-outerX, 0, outerZ), new THREE.Vector3(outerX, wallHeight, outerZ + thickness)),
      new THREE.Box3(new THREE.Vector3(-outerX, 0, -outerZ - thickness), new THREE.Vector3(outerX, wallHeight, -outerZ)),
      new THREE.Box3(new THREE.Vector3(outerX, 0, -outerZ), new THREE.Vector3(outerX + thickness, wallHeight, outerZ)),
      new THREE.Box3(new THREE.Vector3(-outerX - thickness, 0, -outerZ), new THREE.Vector3(-outerX, wallHeight, outerZ)),
    ];

    for (const wall of walls) {
      this.collisionSystem.addStaticBox(wall);
    }
  }

  animate(delta) {
    // Desplaza lentamente las cabinas del teleferico entre ambas torres.
    for (const car of this._cableCars) {
      car.t += delta * 0.03;
      if (car.t > 1) car.t = 0;
      car.mesh.position.lerpVectors(car.from, car.to, car.t);
      car.mesh.position.y = car.height - 0.6;
    }
  }
}
