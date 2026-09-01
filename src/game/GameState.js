// Umbrales de reputacion segun el concepto del juego.
const REPUTATION_LEVELS = [
  { max: 20, label: 'Mal conductor' },
  { max: 40, label: 'Conductor novato' },
  { max: 60, label: 'Conductor regular' },
  { max: 80, label: 'Buen conductor' },
  { max: 100, label: 'Conductor destacado' },
];

/**
 * GameState
 * Estado economico/progreso del jugador: dinero, ocupacion del minibus y
 * reputacion. Combustible y desgaste viven en el propio Minibus, ya que
 * son propiedades del vehiculo, no del conductor.
 */
export class GameState {
  constructor() {
    this.money = 15; // el jugador arranca con poco dinero, como pide el concepto
    this.passengersOnboard = 0;
    // Capacidad generosa a proposito: los pasajeros suben en el camino y
    // viajan hasta la ultima parada (nadie se baja a mitad de ruta), asi
    // que el bus debe poder llevar a casi todos los de las 4 paradas juntos.
    this.passengerCapacity = 18;
    this.reputation = 50; // arranca como "conductor regular"
  }

  addMoney(amount) {
    this.money += amount;
  }

  canBoard() {
    return this.passengersOnboard < this.passengerCapacity;
  }

  boardPassenger(fare) {
    this.passengersOnboard = Math.min(this.passengerCapacity, this.passengersOnboard + 1);
    this.money += fare;
  }

  /** Al completar la ruta se asume que todos los pasajeros llegaron a destino. */
  dropOffAll() {
    this.passengersOnboard = 0;
  }

  addReputation(amount) {
    this.reputation = Math.min(100, Math.max(0, this.reputation + amount));
  }

  get reputationLevel() {
    const level = REPUTATION_LEVELS.find((l) => this.reputation <= l.max);
    return level ? level.label : REPUTATION_LEVELS[REPUTATION_LEVELS.length - 1].label;
  }
}
