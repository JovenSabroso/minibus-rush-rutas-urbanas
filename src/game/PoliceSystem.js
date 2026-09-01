import * as THREE from 'three';
import { internalStreetLines } from './streetGrid.js';

const CHECKPOINT_RADIUS = 20; // metros: dentro de este radio un policia "puede" verte infringir
const FINE_BASE = 15; // Bs
const FINE_PER_REPEAT = 5; // Bs adicionales por cada infraccion previa acumulada
const REPEAT_OFFENDER_THRESHOLD = 3; // "demasiadas infracciones" segun el concepto
const REPUTATION_PER_INFRACTION = -3;
const REPUTATION_PER_FINE = -5;

// Mensajes satiricos para el momento de la multa. Nada de sobornos: la
// unica salida es pagar (o quedar advertido si no tienes plata), tal como
// pide el concepto ("no premiar sobornos ni corrupcion").
const FINE_MESSAGES = [
  '🚓 "Documentos, por favor..." El agente ya tenia la libreta de multas lista.',
  '🚓 "Ese semáforo no es decorativo, causa." Multa aplicada.',
  '🚓 "La ley es la ley, aunque lleguemos tarde al Mercado Central."',
  '🚓 El agente silba fuerte y hace señas de detenerse. Multa aplicada.',
  '🚓 "A la próxima me lo llevo con auto y todo." Multa aplicada.',
];
const WARNING_NO_MONEY_MESSAGE = '🚓 "Hoy te salvas, no tienes ni para la multa." Advertencia registrada.';

function buildCheckpointGroup() {
  const group = new THREE.Group();

  // Cono de senalizacion.
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xe8452c, roughness: 0.6 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 8), coneMat);
  cone.position.set(-0.9, 0.28, 0);
  group.add(cone);

  // Policia: figura simple (cuerpo capsula uniforme azul + cabeza + gorra + paleta "PARE").
  const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1f3a5f, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.6 });
  const paddleMat = new THREE.MeshStandardMaterial({ color: 0xe8452c, roughness: 0.5 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.75, 4, 8), uniformMat);
  body.position.y = 0.78;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), skinMat);
  head.position.y = 1.35;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 10), capMat);
  cap.position.y = 1.47;
  group.add(cap);

  const paddleStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), capMat);
  paddleStick.position.set(0.32, 0.95, 0);
  paddleStick.rotation.z = Math.PI / 2.4;
  group.add(paddleStick);

  const paddle = new THREE.Mesh(new THREE.CircleGeometry(0.16, 8), paddleMat);
  paddle.position.set(0.58, 1.15, 0);
  paddle.rotation.y = Math.PI / 2;
  group.add(paddle);

  return group;
}

/**
 * PoliceSystem
 * Puntos de control fijos en la ciudad + contador de infracciones del
 * jugador. Las infracciones (semaforo en rojo, choques de transito) restan
 * reputacion siempre; ademas, si ocurren cerca de un control (o el jugador
 * acumula demasiadas), hay una multa real en dinero. Sin opcion de soborno.
 */
export class PoliceSystem {
  constructor(scene, city, rng) {
    this.rng = rng;
    this.infractions = 0;
    this._vigilanceTimer = 0;

    this.onFine = null; // (message: string) => void, lo conecta el HUD via toast

    this.checkpoints = this._buildCheckpoints(scene, city);
  }

  _buildCheckpoints(scene, city) {
    const xs = internalStreetLines(city.blocksX, city.step, city.blockSize, city.streetWidth);
    const zs = internalStreetLines(city.blocksZ, city.step, city.blockSize, city.streetWidth);

    // Dos puntos de control fijos, cerca de cruces internos pero corridos
    // hacia la vereda para no quedar parados en medio de la calle.
    const spots = [
      { x: xs[1] + 6, z: zs[1] - 6 },
      { x: xs[2] - 6, z: zs[2] + 6 },
    ];

    return spots.map(({ x, z }) => {
      const group = buildCheckpointGroup();
      group.position.set(x, 0, z);
      scene.add(group);
      return { position: new THREE.Vector3(x, 0, z), group };
    });
  }

  update(delta) {
    if (this._vigilanceTimer > 0) {
      this._vigilanceTimer -= delta;
    }
  }

  _nearestCheckpointDistance(pos) {
    let min = Infinity;
    for (const cp of this.checkpoints) {
      const d = cp.position.distanceTo(pos);
      if (d < min) min = d;
    }
    return min;
  }

  /**
   * Registra una infraccion de transito (semaforo en rojo, choque, etc.).
   * Siempre resta reputacion; puede o no derivar en multa segun cercania a
   * un control y cuantas infracciones lleva acumuladas el jugador.
   */
  registerInfraction(gameState, playerPos) {
    this.infractions++;
    gameState.addReputation(REPUTATION_PER_INFRACTION);

    const nearCheckpoint = this._nearestCheckpointDistance(playerPos) <= CHECKPOINT_RADIUS;
    const repeatOffender = this.infractions >= REPEAT_OFFENDER_THRESHOLD;

    let fineChance = 0.05; // patrulla al azar, aun lejos de un control
    if (nearCheckpoint) fineChance = this._vigilanceTimer > 0 ? 0.8 : 0.45;
    if (repeatOffender) fineChance = Math.max(fineChance, 0.9);

    if (this.rng() <= fineChance) {
      this._issueFine(gameState);
    }
  }

  _issueFine(gameState) {
    const rawAmount = FINE_BASE + (this.infractions - 1) * FINE_PER_REPEAT;
    const amount = Math.min(rawAmount, Math.max(0, Math.floor(gameState.money)));

    this.infractions = 0;

    if (amount <= 0) {
      if (this.onFine) this.onFine(WARNING_NO_MONEY_MESSAGE);
      return;
    }

    gameState.addMoney(-amount);
    gameState.addReputation(REPUTATION_PER_FINE);

    const message = FINE_MESSAGES[Math.floor(this.rng() * FINE_MESSAGES.length)];
    if (this.onFine) this.onFine(`${message} (-${amount} Bs)`);
  }

  /** Evento "control de transito": mas probabilidad de multa un rato. */
  boostVigilance(durationSeconds) {
    this._vigilanceTimer = durationSeconds;
  }
}
