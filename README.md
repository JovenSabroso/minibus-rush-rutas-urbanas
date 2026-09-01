# Minibús Rush: Rutas Urbanas

Prototipo universitario de simulación y conducción 3D para navegador, inspirado en el transporte urbano de La Paz y El Alto (Bolivia). Construido con Three.js sobre Vite, sin modelos 3D externos: toda la geometría (ciudad y vehículo) es procedural.

> ⚠️ Estado actual: **Fase 3 completada** — ciudad, minibús, cámara, movimiento, paradas, pasajeros, dinero, ruta con GPS, combustible, desgaste del vehículo, reputación, gasolinera y taller mecánico. El resto de las fases (tráfico, semáforos, policía, menús) se irán agregando de forma incremental.

## Tecnologías

- HTML5 / CSS3 / JavaScript (módulos ES6)
- [Three.js](https://threejs.org/)
- [Vite](https://vitejs.dev/)

## Instalación y ejecución

```bash
npm install
npm run dev
```

Vite abrirá automáticamente el navegador en `http://localhost:5173`. Si no se abre solo, ingresa esa URL manualmente.

Para generar una build de producción:

```bash
npm run build
npm run preview
```

## Controles (Fase 1)

| Tecla | Acción |
| --- | --- |
| `W` / `↑` | Acelerar |
| `S` / `↓` | Frenar / Reversa |
| `A` `D` / `← →` | Girar |
| `Espacio` | Freno de mano |
| `C` | Cambiar cámara (detrás / elevada / cercana) |
| `F` | Repostar en la gasolinera (si estás cerca y detenido) |
| `G` | Reparar en el taller mecánico (si estás cerca y detenido) |

## Estructura del proyecto

```
/minibus-rush
  /public/assets/{models,textures,sounds}   # preparado para recursos futuros
  /src
    /components   # UI (HUD.js) — se amplía en próximas fases
    /systems      # input, cámara, colisiones, economía, ruta, rng
    /world        # ciudad procedural (calles, edificios, montañas, teleférico) y paradas
    /vehicles     # minibús del jugador y NPCs
    game.js       # orquestador principal (escena, luces, loop)
    main.js       # punto de entrada
    style.css     # estilos globales del HUD
  index.html
  package.json
```

## Características implementadas

**Fase 1 — Base jugable**
- Ciudad procedural con grilla de manzanas, edificios coloridos, aceras, avenidas marcadas, faroles, montañas de fondo y un teleférico decorativo animado.
- Minibús construido con geometría procedural (carrocería, techo, ventanas, puertas, parachoques, luces, espejos, ruedas con giro y rodado visual) con aspecto deliberadamente desgastado.
- Conducción en tercera persona con aceleración, frenado, reversa, freno de mano y giro progresivo dependiente de la velocidad.
- Tres modos de cámara (detrás, elevada, cercana) con seguimiento suavizado.
- Colisiones básicas contra edificios y límites de la ciudad.

**Fase 2 — Paradas, pasajeros y economía**
- Ruta fija Terminal → Mercado Central → Centro → Zona Sur, con 4 paradas físicas en la ciudad (poste + letrero + anillo indicador en el piso).
- Pasajeros simples (cápsula + cabeza) esperando en cada parada, con tarifas variables: normal (2 Bs), trayecto largo (3 Bs) y especial (5 Bs).
- Embarque automático: al detenerse cerca de una parada con pasajeros esperando, suben solos tras un par de segundos, uno por uno.
- Dinero e HUD en tiempo real: contador de Bs con "popups" flotantes al cobrar, contador de pasajeros a bordo (X/8).
- Mini-mapa GPS en pantalla: muestra la ruta, todas las paradas (gris = pendiente, amarillo pulsante = destino actual, verde = ya visitada) y la posición/orientación del jugador.
- Los pasajeros suben en el camino y viajan a bordo durante todo el recorrido (nadie se baja a mitad de ruta); todos bajan juntos al llegar a la última parada.
- Al completar la ruta se muestra "RUTA COMPLETADA" con la cantidad de pasajeros que bajaron y la recompensa (25 Bs), y la ruta se reinicia automáticamente para seguir jugando.

**Fase 3 — Combustible, desgaste, reputación y garaje**
- Combustible: empieza en 100% y se consume al conducir; en 0% el motor se apaga y aparece "Te quedaste sin combustible" (el bus sigue frenando por inercia, no se detiene en seco).
- Gasolinera procedural (canopy + surtidores) donde repostar cerca y detenido con `F`, pagando según lo que falte para llenar el tanque.
- Desgaste del vehículo en 5 estadísticas (motor, frenos, neumáticos, suspensión, carrocería), todas arrancando en 60% como pide el concepto. El desgaste bajo el 40%/20% reduce de forma perceptible la aceleración, el frenado y el giro.
- Los choques dañan la suspensión y la carrocería (con un cooldown para no destruir todo de golpe si el bus queda atascado contra una pared).
- Taller mecánico (nave con cartel) donde reparar todas las estadísticas al 100% cerca y detenido con `G`, pagando según el desgaste acumulado.
- Reputación de 0 a 100 con niveles (Mal conductor → Conductor destacado): sube por transportar pasajeros y completar rutas, baja por chocar, y se recupera lentamente con buena conducción.
- HUD ampliado con combustible, reputación (con su nivel), advertencias de desgaste crítico y mensajes emergentes (repostaje, reparación, dinero insuficiente).

**Pulido visual — Fachadas "a medio construir"**
- Los edificios más altos combinan planta baja pintada de color vivo con pisos superiores en ladrillo/concreto crudo sin pintar, y varillas de fierro asomando del techo — el aspecto de autoconstrucción por etapas típico de El Alto.

**Pulido visual — Texturas y proporciones del minibús**
- La carrocería usa texturas generadas por código (Canvas2D, sin imágenes externas): pintura con variaciones sutiles de tono, costuras de chapa, una franja de acento y mugre/óxido acumulado cerca de las ruedas.
- El frente tiene una rejilla ancha (casi de esquina a esquina) con faros más grandes en las esquinas y marcadores ámbar, y el letrero de destino muestra el número de ruta ("101") en vez de quedar en blanco.
- Atrás: luces más verticales/integradas con marcador ámbar, tercera luz de freno y ventana trasera.
- Arcos/salpicaderas oscuros sobre cada rueda, para que no queden "pegadas" a un costado liso.
- Estas proporciones se ajustaron mirando referencias reales de minibuses tipo van (solo como inspiración visual, sin copiar ninguna imagen ni diseño de marca).

## Próximas fases

- **Fase 4:** tráfico NPC, semáforos, policía y eventos aleatorios.
- **Fase 5:** menú principal, mejoras, ciclo día/noche y pulido visual.

Este proyecto es un **prototipo universitario** desarrollado para la asignatura de Programación Gráfica y Multimedia I. No representa marcas comerciales reales ni pretende ser una reproducción exacta de la ciudad de La Paz/El Alto.
