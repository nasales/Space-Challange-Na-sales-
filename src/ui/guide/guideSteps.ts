// Script of the map tutorial: what the guide robot says, where it hovers and what ends each step.
// To change the tutorial, edit this list only (GuideTour.tsx plays whatever is here).
import type { GuideCue } from '../../shared/events'
import { L } from '../../shared/i18n'

/** Name on the robot's dialogue box. */
export const GUIDE_NAME = 'Wattson'
export const GUIDE_ROLE = L('Field robot', 'Robot de campo')

/**
 * What ends a step:
 * - enter: the player reads and presses Enter (or clicks Next)
 * - move: the detective has run a short distance
 * - wheel: the mouse wheel was used (Enter also works, for players without a wheel)
 * - travelOpen / travelClose: the travel map (M) was opened / is closed again and he has landed
 * - lensOpen / lensClose: the magnifier (Space) was opened / is closed again
 */
export type GuideGoal = 'enter' | 'move' | 'wheel' | 'travelOpen' | 'travelClose' | 'lensOpen' | 'lensClose'

export interface GuideStep {
  id: string
  /** Short heading of the step */
  title: string
  text: string
  /** Shown instead of `text` while the detective stands inside a featured-case ring (magnifier step) */
  textInCaseRing?: string
  /** Keys the step asks for, drawn as key caps */
  keys?: string[]
  /** What to do, in a few words (next to the key caps) */
  action?: string
  at: GuideCue['at']
  /** The detective stands still and turns towards what the robot shows */
  hold?: boolean
  goal: GuideGoal
  /** The box moves to the top of the screen (a panel is open in the middle) */
  dock?: 'top'
  /** HUD part that pulses during the step */
  highlight?: 'corner'
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: L('Welcome, detective', 'Bienvenido, detective'),
    text: L(
      `Beep! I am ${GUIDE_NAME}, your field robot. This is a map of Spain you can run across: real mountains, real rivers, real towns. Let me show you around. It takes one minute.`,
      `¡Bip! Soy ${GUIDE_NAME}, tu robot de campo. Este es un mapa de España que puedes recorrer corriendo: montañas reales, ríos reales, pueblos reales. Te lo enseño. Solo es un minuto.`,
    ),
    at: 'detective',
    goal: 'enter',
  },
  {
    id: 'move',
    title: L('Run', 'Corre'),
    text: L('First, your legs. Run with W, A, S and D. Hold Shift to sprint. Go on, take a few steps!', 'Primero, las piernas. Corre con W, A, S y D. Mantén Shift para esprintar. ¡Venga, da unos pasos!'),
    keys: ['W', 'A', 'S', 'D'],
    action: L('Run a few steps', 'Da unos pasos'),
    at: 'detective',
    goal: 'move',
  },
  {
    id: 'zoom',
    title: L('Look from above', 'Mira desde arriba'),
    text: L('Good. Now roll the mouse wheel to zoom out. Far enough and you see the whole country. Roll it back to come down again.', 'Bien. Ahora gira la rueda del ratón para alejarte. Si te alejas lo bastante, verás todo el país. Gírala al revés para volver a bajar.'),
    keys: [L('Wheel', 'Rueda')],
    action: L('Roll the mouse wheel', 'Gira la rueda del ratón'),
    at: 'detective',
    goal: 'wheel',
  },
  {
    id: 'location',
    title: L('Where am I?', '¿Dónde estoy?'),
    text: L('Top right: the minimap shows where you are in Spain, and the panel under it names the nearest town and its region.', 'Arriba a la derecha: el minimapa te muestra dónde estás en España, y el panel de debajo te dice el pueblo más cercano y su región.'),
    at: 'detective',
    goal: 'enter',
    highlight: 'corner',
  },
  {
    id: 'monuments',
    title: L('Monuments', 'Monumentos'),
    text: L('See this? It is a monument. Spain is full of them on this map: cathedrals, castles, bridges. They are your landmarks. You can spot them from far away, and you can even climb them.', '¿Ves esto? Es un monumento. En este mapa España está llena de ellos: catedrales, castillos, puentes. Son tus puntos de referencia. Se ven desde lejos, y hasta puedes subirte a ellos.'),
    at: 'landmark',
    hold: true,
    goal: 'enter',
  },
  {
    id: 'travel-open',
    title: L('Travel map', 'Mapa de viaje'),
    text: L('Spain is big. Press M to open the travel map.', 'España es grande. Pulsa M para abrir el mapa de viaje.'),
    keys: ['M'],
    action: L('Open the travel map', 'Abre el mapa de viaje'),
    at: 'detective',
    goal: 'travelOpen',
  },
  {
    id: 'travel-close',
    title: L('Travel map', 'Mapa de viaje'),
    text: L('Every dot is a monument. Click one to fly there by plane, or press Esc to stay here.', 'Cada punto es un monumento. Haz clic en uno para volar allí en avión, o pulsa Esc para quedarte aquí.'),
    keys: ['Esc'],
    action: L('Close the map, or fly', 'Cierra el mapa o vuela'),
    at: 'detective',
    goal: 'travelClose',
    dock: 'top',
  },
  {
    id: 'lens-open',
    title: L('The magnifier', 'La lupa'),
    text: L('Now the real detective work. Stand still: your magnifier comes out after a moment. Then press Space to look through it.', 'Ahora, el trabajo de detective de verdad. Quédate quieto: al momento sacarás la lupa. Luego pulsa Espacio para mirar a través de ella.'),
    textInCaseRing: L('You are inside a glowing case ring. Step out of it first, then stand still and press Space.', 'Estás dentro de un anillo brillante de caso. Sal primero de él, luego quédate quieto y pulsa Espacio.'),
    keys: ['Space'],
    action: L('Stand still, then press Space', 'Quédate quieto y pulsa Espacio'),
    at: 'detective',
    goal: 'lensOpen',
  },
  {
    id: 'lens-close',
    title: L('Six clues', 'Seis pistas'),
    text: L('Six clues: temperature, rain, wind and more. Each one opens decades of NASA data for the exact spot you stand on. Click a clue to read its trend. Press Esc when you are done.', 'Seis pistas: temperatura, lluvia, viento y más. Cada una abre décadas de datos de la NASA del punto exacto donde estás. Haz clic en una pista para leer su tendencia. Pulsa Esc cuando acabes.'),
    keys: ['Esc'],
    action: L('Close the magnifier', 'Cierra la lupa'),
    at: 'detective',
    goal: 'lensClose',
    dock: 'top',
  },
  {
    id: 'cases',
    title: L('Featured cases', 'Casos destacados'),
    text: L('A glowing ring with a floating symbol is a featured case. A witness waits inside with a claim about the climate. Stop in the ring and press Space: hear the claim, read the evidence, and decide if the data backs it. Solved cases turn green.', 'Un anillo brillante con un símbolo flotando es un caso destacado. Dentro te espera un testigo con una afirmación sobre el clima. Párate en el anillo y pulsa Espacio: escucha la afirmación, lee las pruebas y decide si los datos le dan la razón. Los casos resueltos se ponen en verde.'),
    at: 'case',
    hold: true,
    goal: 'enter',
  },
  {
    id: 'end',
    title: L('Case open', 'Caso abierto'),
    text: L('That is all you need. Press Esc any time to pause; you can call me again from there. Good luck, detective!', 'Eso es todo lo que necesitas. Pulsa Esc cuando quieras para pausar; desde ahí puedes volver a llamarme. ¡Suerte, detective!'),
    at: 'detective',
    goal: 'enter',
  },
]
