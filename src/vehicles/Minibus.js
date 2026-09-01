import * as THREE from 'three';
import { createBodyPanelTexture, createGrilleTexture, createRouteSignTexture } from './textureGenerators.js';

/**
 * Minibus (jugador)
 * Vehiculo construido enteramente con geometria procedural de Three.js,
 * con apariencia de minibus urbano boliviano ya usado/desgastado.
 * Incluye un modelo de movimiento arcade simple (aceleracion, frenado,
 * reversa, freno de mano y giro progresivo dependiente de la velocidad).
 */
export class Minibus {
  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'Minibus';

    // --- Parametros fisicos (arcade, no realistas) ---
    this.speed = 0; // m/s, positivo = adelante, negativo = reversa
    this.maxSpeed = 15; // ~54 km/h
    this.reverseMaxSpeed = 5.5;
    this.acceleration = 6.2;
    this.brakeDeceleration = 13;
    this.naturalFriction = 2.6;
    this.handbrakeDeceleration = 19;
    this.turnRate = 2.35; // rad/s a velocidad de referencia

    this._steerVisualAngle = 0; // para animar giro visual de ruedas delanteras

    // Traccion efectiva (1 = normal). El evento aleatorio "lluvia" la baja
    // un rato: menos agarre al girar y al frenar. Fase 4.
    this.tractionMultiplier = 1;

    // Mitad del tamano de la caja de colision (x=ancho, y=alto, z=largo)
    this.collisionHalfExtents = new THREE.Vector3(1.15, 1.05, 2.75);

    // --- Combustible ---
    this.maxFuel = 100;
    this.fuel = 100; // % — arranca lleno, se gasta conduciendo
    this.fuelConsumptionPerMeter = 0.05; // % de combustible por metro recorrido

    // --- Desgaste del vehiculo (empieza usado, como pide el concepto del juego) ---
    this.wear = { motor: 60, frenos: 60, neumaticos: 60, suspension: 60, carroceria: 60 };
    this._wearRates = {
      motorPerMeter: 0.015,
      neumaticosPerMeter: 0.018,
      frenosPerSecondBraking: 0.8,
    };

    this._buildBody();
    this._buildWheels();
  }

  _buildBody() {
    const BODY_COLOR = 0xc9a227;
    const STRIPE_COLOR = 0x8a2f22; // franja de acento, rojo ladrillo apagado

    // Pintura vieja: amarillo desgastado, poco metalico, bastante rugoso.
    // Los paneles usan texturas generadas por codigo (Canvas2D) en vez de
    // color plano: pintura con variaciones de tono, costuras de chapa,
    // franja de acento y mugre/oxido hacia abajo — nada de imagenes externas.
    const sidePanelTexture = createBodyPanelTexture(BODY_COLOR, STRIPE_COLOR);
    const sideMat = new THREE.MeshStandardMaterial({ map: sidePanelTexture, roughness: 0.85, metalness: 0.05 });
    const frontTexture = createGrilleTexture(BODY_COLOR);
    const frontMat = new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.7, metalness: 0.1 });
    const flatBodyMat = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.85, metalness: 0.05 });

    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb8951f, roughness: 0.9, metalness: 0.05 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.7, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2733, roughness: 0.35, metalness: 0.4 });
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x6b6f76, roughness: 0.6, metalness: 0.35 });
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x6b3a24, roughness: 1, metalness: 0 });

    // --- Chasis principal ---
    // BoxGeometry asigna un material por cara cuando se le pasa un arreglo:
    // [+x (derecha), -x (izquierda), +y (techo), -y (piso), +z (frente), -z (atras)].
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.35, 5.0), [
      sideMat,
      sideMat,
      flatBodyMat,
      flatBodyMat,
      frontMat,
      sideMat,
    ]);
    chassis.position.set(0, 1.05, 0);
    chassis.castShadow = true;
    this.mesh.add(chassis);

    // --- Techo (mas angosto, da la silueta clasica de minibus) ---
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.5), roofMat);
    roof.position.set(0, 2.0, -0.15);
    roof.castShadow = true;
    this.mesh.add(roof);

    // --- Parabrisas delantero (inclinado) ---
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.85, 0.08), glassMat);
    windshield.position.set(0, 1.55, 2.42);
    windshield.rotation.x = THREE.MathUtils.degToRad(-8);
    this.mesh.add(windshield);

    // --- Ventanas laterales (una franja continua por lado) ---
    const sideWindowGeo = new THREE.BoxGeometry(0.06, 0.65, 3.6);
    const leftWindow = new THREE.Mesh(sideWindowGeo, glassMat);
    leftWindow.position.set(-1.02, 1.65, -0.3);
    this.mesh.add(leftWindow);
    const rightWindow = leftWindow.clone();
    rightWindow.position.x = 1.02;
    this.mesh.add(rightWindow);

    // --- Puertas (panel + linea + manija) lado derecho, tipico de acceso de pasajeros ---
    this._addDoor(1.04, 0.35, trimMat, bumperMat);
    this._addDoor(1.04, 1.55, trimMat, bumperMat);

    // --- Parachoques ---
    const bumperGeo = new THREE.BoxGeometry(2.15, 0.35, 0.35);
    const frontBumper = new THREE.Mesh(bumperGeo, bumperMat);
    frontBumper.position.set(0, 0.55, 2.55);
    this.mesh.add(frontBumper);
    const rearBumper = new THREE.Mesh(bumperGeo, bumperMat);
    rearBumper.position.set(0, 0.55, -2.55);
    this.mesh.add(rearBumper);

    // --- Luces delanteras (mas anchas, hacia las esquinas, como una van real) ---
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff3c9, emissive: 0xffe27a, emissiveIntensity: 0.9, roughness: 0.4 });
    const headlightGeo = new THREE.BoxGeometry(0.36, 0.28, 0.08);
    const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
    headlightL.position.set(-0.82, 0.92, 2.53);
    this.mesh.add(headlightL);
    const headlightR = headlightL.clone();
    headlightR.position.x = 0.82;
    this.mesh.add(headlightR);

    // Marcadores ambar en la esquina exterior de cada faro (detalle tipico de van).
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xcc7a1a, emissiveIntensity: 0.6, roughness: 0.5 });
    const markerGeo = new THREE.BoxGeometry(0.07, 0.28, 0.08);
    const markerL = new THREE.Mesh(markerGeo, markerMat);
    markerL.position.set(-1.02, 0.92, 2.53);
    this.mesh.add(markerL);
    const markerR = markerL.clone();
    markerR.position.x = 1.02;
    this.mesh.add(markerR);

    // --- Luces traseras (mas verticales/integradas, con marcador ambar) ---
    const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xb5140c, emissiveIntensity: 0.7, roughness: 0.4 });
    const taillightGeo = new THREE.BoxGeometry(0.24, 0.42, 0.08);
    const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
    taillightL.position.set(-0.85, 0.95, -2.53);
    this.mesh.add(taillightL);
    const taillightR = taillightL.clone();
    taillightR.position.x = 0.85;
    this.mesh.add(taillightR);
    // Guarda referencia para futuras fases (frenado = luces mas intensas).
    this.taillights = [taillightL, taillightR];

    const rearMarkerL = new THREE.Mesh(markerGeo, markerMat);
    rearMarkerL.position.set(-1.0, 0.95, -2.53);
    this.mesh.add(rearMarkerL);
    const rearMarkerR = rearMarkerL.clone();
    rearMarkerR.position.x = 1.0;
    this.mesh.add(rearMarkerR);

    // --- Ventana trasera + tercera luz de freno (como en un minibus real) ---
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.08), glassMat);
    rearWindow.position.set(0, 1.6, -2.44);
    this.mesh.add(rearWindow);

    const thirdBrakeLight = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.05), taillightMat);
    thirdBrakeLight.position.set(0, 1.93, -2.46);
    this.mesh.add(thirdBrakeLight);

    // --- Espejos laterales ---
    const mirrorArmGeo = new THREE.BoxGeometry(0.06, 0.06, 0.35);
    const mirrorHeadGeo = new THREE.BoxGeometry(0.1, 0.25, 0.32);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(mirrorArmGeo, trimMat);
      arm.position.set(side * 1.08, 1.75, 2.05);
      arm.rotation.y = side * 0.3;
      this.mesh.add(arm);
      const head = new THREE.Mesh(mirrorHeadGeo, trimMat);
      head.position.set(side * 1.28, 1.75, 2.1);
      this.mesh.add(head);
    }

    // --- Letrero de destino en el frente, con el numero de ruta dibujado por codigo ---
    const signTexture = createRouteSignTexture('101');
    const signMat = new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.6, metalness: 0 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.06), signMat);
    sign.position.set(0, 2.15, 2.35);
    this.mesh.add(sign);

    // --- Un par de manchas de oxido para reforzar el aspecto "vetusto" ---
    const rustSpot1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), rustMat);
    rustSpot1.position.set(-1.04, 0.55, 1.4);
    rustSpot1.rotation.y = Math.PI / 2;
    this.mesh.add(rustSpot1);
    const rustSpot2 = rustSpot1.clone();
    rustSpot2.position.set(1.04, 0.5, -1.6);
    this.mesh.add(rustSpot2);
  }

  _addDoor(x, z, trimMat, bumperMat) {
    // Linea de separacion de la puerta.
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.1, 0.03), trimMat);
    seam.position.set(x, 1.0, z);
    this.mesh.add(seam);
    // Manija.
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.18), bumperMat);
    handle.position.set(x + 0.02, 0.95, z);
    this.mesh.add(handle);
  }

  _buildWheels() {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.0 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.5, metalness: 0.5 });
    const archMat = new THREE.MeshStandardMaterial({ color: 0x232629, roughness: 0.85, metalness: 0.1 });

    const wheelRadius = 0.45;
    const wheelThickness = 0.32;

    const wheelPositions = {
      frontLeft: new THREE.Vector3(-1.1, wheelRadius, 1.7),
      frontRight: new THREE.Vector3(1.1, wheelRadius, 1.7),
      rearLeft: new THREE.Vector3(-1.1, wheelRadius, -1.6),
      rearRight: new THREE.Vector3(1.1, wheelRadius, -1.6),
    };

    this.wheels = {};

    // Arcos/salpicaderas: medio-anillo oscuro sobre cada rueda, le da un
    // acabado mucho mas "de van real" en vez de ruedas pegadas a un costado liso.
    for (const pos of Object.values(wheelPositions)) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.14, 0.1, 8, 16, Math.PI), archMat);
      arch.rotation.y = Math.PI / 2;
      arch.rotation.z = Math.PI;
      arch.position.set(pos.x, wheelRadius, pos.z);
      this.mesh.add(arch);
    }

    for (const [key, pos] of Object.entries(wheelPositions)) {
      // Grupo "steer" permite rotar visualmente la rueda delantera al girar.
      const steerPivot = new THREE.Group();
      steerPivot.position.copy(pos);
      this.mesh.add(steerPivot);

      const rollPivot = new THREE.Group(); // este es el que rueda (rotacion X)
      steerPivot.add(rollPivot);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      rollPivot.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.45, wheelRadius * 0.45, wheelThickness + 0.02, 10), hubMat);
      hub.rotation.z = Math.PI / 2;
      rollPivot.add(hub);

      this.wheels[key] = { steerPivot, rollPivot, isFront: key.startsWith('front') };
    }
  }

  /**
   * Actualiza fisica y visuales del minibus.
   * @param {number} delta - segundos desde el ultimo frame
   * @param {InputSystem} input
   */
  update(delta, input) {
    // El desgaste reduce el rendimiento del vehiculo por debajo de ciertos
    // umbrales (motor -> aceleracion/velocidad, frenos -> frenado, neumaticos -> giro).
    const motorFactor = this._wearFactor(this.wear.motor);
    const brakeFactor = this._wearFactor(this.wear.frenos);
    const tireFactor = this._wearFactor(this.wear.neumaticos);

    const effAcceleration = this.acceleration * motorFactor;
    const effMaxSpeed = this.maxSpeed * motorFactor;
    const effBrakeDeceleration = this.brakeDeceleration * brakeFactor * this.tractionMultiplier;
    const effTurnRate = this.turnRate * tireFactor * this.tractionMultiplier;

    const engineOn = this.fuel > 0;
    let accel = 0;
    let isBraking = false;

    if (!engineOn) {
      // Sin combustible el motor no responde: solo queda la friccion natural.
      accel = -Math.sign(this.speed) * this.naturalFriction;
    } else if (input.handbrake) {
      accel = -Math.sign(this.speed) * this.handbrakeDeceleration;
    } else if (input.throttle) {
      accel = effAcceleration;
    } else if (input.brakeOrReverse) {
      // Si va hacia adelante, frenar; si ya esta detenido o en reversa, acelerar en reversa.
      if (this.speed > 0.15) {
        accel = -effBrakeDeceleration;
        isBraking = true;
      } else {
        accel = -effAcceleration * 0.7;
      }
    } else {
      // Friccion natural / motor al ralenti, hacia 0.
      accel = -Math.sign(this.speed) * this.naturalFriction;
    }

    this.speed += accel * delta;

    // Evita que la friccion haga oscilar el signo de la velocidad cerca de 0.
    if ((!engineOn || (!input.throttle && !input.brakeOrReverse)) && Math.abs(this.speed) < 0.05) {
      this.speed = 0;
    }

    this.speed = THREE.MathUtils.clamp(this.speed, -this.reverseMaxSpeed, effMaxSpeed);

    // --- Giro ---
    // Nota: el signo esta invertido a proposito respecto al calculo "teorico"
    // de rotacion en Y, para que coincida con la percepcion real del jugador
    // detras del volante (A = izquierda en pantalla, D = derecha en pantalla).
    let steerInput = 0;
    if (input.steerLeft) steerInput += 1;
    if (input.steerRight) steerInput -= 1;

    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 1.5, 0, 1);
    const turnSign = this.speed >= 0 ? 1 : -1;
    const turnDelta = steerInput * effTurnRate * delta * speedFactor * turnSign;
    this.mesh.rotation.y += turnDelta;

    // --- Traslacion segun heading actual ---
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    const frameDistance = this.speed * delta;
    this.mesh.position.addScaledVector(forward, frameDistance);

    this._updateWheelVisuals(delta, steerInput);
    this._updateFuelAndWear(delta, Math.abs(frameDistance), isBraking);
  }

  _wearFactor(value) {
    if (value >= 40) return 1;
    if (value >= 20) return 0.75;
    return 0.5;
  }

  _updateFuelAndWear(delta, distanceMeters, isBraking) {
    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - distanceMeters * this.fuelConsumptionPerMeter);
    }

    this.wear.motor = Math.max(0, this.wear.motor - distanceMeters * this._wearRates.motorPerMeter);
    this.wear.neumaticos = Math.max(0, this.wear.neumaticos - distanceMeters * this._wearRates.neumaticosPerMeter);
    if (isBraking) {
      this.wear.frenos = Math.max(0, this.wear.frenos - delta * this._wearRates.frenosPerSecondBraking);
    }
  }

  /** Llamado por el sistema de colisiones cuando el minibus choca contra algo. */
  applyCollisionDamage() {
    this.wear.suspension = Math.max(0, this.wear.suspension - 3);
    this.wear.carroceria = Math.max(0, this.wear.carroceria - 5);
  }

  refuel(amount) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  /** Reparacion completa disponible en el garaje (fase 3: todo o nada). */
  repairAll() {
    for (const key of Object.keys(this.wear)) this.wear[key] = 100;
  }

  get outOfFuel() {
    return this.fuel <= 0;
  }

  _updateWheelVisuals(delta, steerInput) {
    const wheelRadius = 0.45;
    const rollAmount = (this.speed * delta) / wheelRadius;

    const targetSteerAngle = steerInput * THREE.MathUtils.degToRad(28);
    this._steerVisualAngle = THREE.MathUtils.lerp(this._steerVisualAngle, targetSteerAngle, 1 - Math.exp(-10 * delta));

    for (const wheel of Object.values(this.wheels)) {
      wheel.rollPivot.rotation.x -= rollAmount;
      if (wheel.isFront) {
        wheel.steerPivot.rotation.y = this._steerVisualAngle;
      }
    }
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }
}
