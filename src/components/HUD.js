/**
 * HUD
 * Puente entre el estado del juego (GameState, RouteSystem, Minibus) y el
 * DOM. No contiene logica de juego, solo lectura y pintado de la interfaz.
 */
export class HUD {
  constructor() {
    this.moneyEl = document.getElementById('money-readout');
    this.fuelEl = document.getElementById('fuel-readout');
    this.reputationEl = document.getElementById('reputation-readout');
    this.passengersEl = document.getElementById('passengers-readout');
    this.speedEl = document.getElementById('speed-readout');
    this.moneyPopupsEl = document.getElementById('money-popups');
    this.wearWarningsEl = document.getElementById('wear-warnings');

    this.gpsStopNameEl = document.getElementById('gps-stop-name');
    this.gpsDistanceEl = document.getElementById('gps-distance');

    this.stopPromptEl = document.getElementById('stop-prompt');
    this.stopPromptDetailEl = document.getElementById('stop-prompt-detail');

    this.servicePromptEl = document.getElementById('service-prompt');
    this.servicePromptTitleEl = document.getElementById('service-prompt-title');
    this.servicePromptDetailEl = document.getElementById('service-prompt-detail');
    this.serviceToastEl = document.getElementById('service-toast');
    this._toastTimeout = null;

    this.fuelEmptyBannerEl = document.getElementById('fuel-empty-banner');

    this.routeCompleteBannerEl = document.getElementById('route-complete-banner');
    this.routeCompleteDetailEl = document.getElementById('route-complete-detail');

    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
  }

  /** Llamado una vez por frame desde el loop principal. */
  update(gameState, routeSystem, minibus, city, serviceSystem) {
    this.moneyEl.textContent = `${Math.floor(gameState.money)} Bs`;
    this.passengersEl.textContent = `${gameState.passengersOnboard}/${gameState.passengerCapacity} pasajeros`;
    this.speedEl.textContent = `${Math.round(minibus.speedKmh)} km/h`;

    this.fuelEl.textContent = `${Math.round(minibus.fuel)}%`;
    this.fuelEl.classList.toggle('low', minibus.fuel < 20);

    this.reputationEl.textContent = `${Math.round(gameState.reputation)}/100 (${gameState.reputationLevel})`;

    this.fuelEmptyBannerEl.classList.toggle('hidden', !minibus.outOfFuel);

    this._updateWearWarnings(minibus);

    const ui = routeSystem.uiState;
    this.gpsStopNameEl.textContent = ui.nextStopName;
    this.gpsDistanceEl.textContent = `${Math.round(ui.distanceToNextStop)} m`;

    this._updateStopPrompt(ui);
    this._updateServicePrompt(serviceSystem);
    this._updateRouteBanner(ui);
    this._drawMinimap(routeSystem, minibus, city);
  }

  _updateWearWarnings(minibus) {
    const labels = { motor: 'Motor', frenos: 'Frenos', neumaticos: 'Neumáticos', suspension: 'Suspensión', carroceria: 'Carrocería' };
    const warnings = Object.entries(minibus.wear)
      .filter(([, value]) => value < 30)
      .map(([key]) => labels[key]);

    this.wearWarningsEl.innerHTML = '';
    for (const label of warnings) {
      const chip = document.createElement('span');
      chip.className = 'wear-warning-chip';
      chip.textContent = `⚠ ${label}`;
      this.wearWarningsEl.appendChild(chip);
    }
  }

  _updateServicePrompt(serviceSystem) {
    if (!serviceSystem) {
      this.servicePromptEl.classList.add('hidden');
      return;
    }
    const ui = serviceSystem.uiState;
    if (ui.fuelPromptVisible) {
      this.servicePromptEl.classList.remove('hidden');
      this.servicePromptTitleEl.textContent = '⛽ Repostar';
      this.servicePromptDetailEl.textContent = `Presiona F — ${ui.fuelCost} Bs`;
    } else if (ui.garagePromptVisible) {
      this.servicePromptEl.classList.remove('hidden');
      this.servicePromptTitleEl.textContent = '🔧 Taller mecánico';
      this.servicePromptDetailEl.textContent = `Presiona G para reparar — ${ui.repairCost} Bs`;
    } else {
      this.servicePromptEl.classList.add('hidden');
    }
  }

  _updateStopPrompt(ui) {
    if (ui.promptVisible) {
      this.stopPromptEl.classList.remove('hidden');
      this.stopPromptDetailEl.textContent = `${ui.waitingAtCurrent} pasajero${ui.waitingAtCurrent === 1 ? '' : 's'} esperando`;
    } else {
      this.stopPromptEl.classList.add('hidden');
    }
  }

  _updateRouteBanner(ui) {
    if (ui.routeCompleteVisible) {
      this.routeCompleteBannerEl.classList.remove('hidden');
      const count = ui.passengersDroppedOff;
      const passengerLine = count > 0 ? `${count} pasajero${count === 1 ? '' : 's'} bajaron · ` : '';
      this.routeCompleteDetailEl.textContent = `${passengerLine}+${ui.lastBonus} Bs`;
    } else {
      this.routeCompleteBannerEl.classList.add('hidden');
    }
  }

  /** Muestra un "+X Bs" flotante junto al contador de dinero. */
  spawnMoneyPopup(amount) {
    const popup = document.createElement('div');
    popup.className = 'money-popup';
    popup.textContent = `+${amount} Bs`;
    this.moneyPopupsEl.appendChild(popup);
    setTimeout(() => popup.remove(), 1200);
  }

  /** Mensaje corto y temporal en el centro superior (repostaje, reparacion, avisos). */
  showToast(text) {
    this.serviceToastEl.textContent = text;
    this.serviceToastEl.classList.remove('hidden');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => this.serviceToastEl.classList.add('hidden'), 2200);
  }

  _drawMinimap(routeSystem, minibus, city) {
    const ctx = this.minimapCtx;
    const size = this.minimapCanvas.width;
    const range = (city ? Math.max(city.halfExtentX, city.halfExtentZ) : 90) + 15;

    const worldToMap = (x, z) => ({
      x: size / 2 + (x / range) * (size / 2),
      y: size / 2 - (z / range) * (size / 2),
    });

    ctx.clearRect(0, 0, size, size);

    // Linea de ruta conectando las paradas en orden.
    ctx.strokeStyle = 'rgba(245, 209, 66, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    routeSystem.stops.forEach((stop, i) => {
      const p = worldToMap(stop.position.x, stop.position.z);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Paradas: verdes si ya se visitaron, amarilla pulsante si es la actual, gris si falta.
    routeSystem.stops.forEach((stop, i) => {
      const p = worldToMap(stop.position.x, stop.position.z);
      let color = '#7a7f87';
      if (i < routeSystem.currentIndex) color = '#3ea66b';
      if (i === routeSystem.currentIndex) color = '#f5d142';

      ctx.beginPath();
      ctx.arc(p.x, p.y, i === routeSystem.currentIndex ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Jugador: triangulo apuntando hacia su heading actual.
    const playerPos = worldToMap(minibus.mesh.position.x, minibus.mesh.position.z);
    ctx.save();
    ctx.translate(playerPos.x, playerPos.y);
    ctx.rotate(minibus.mesh.rotation.y);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = '#e8452c';
    ctx.fill();
    ctx.restore();
  }
}
