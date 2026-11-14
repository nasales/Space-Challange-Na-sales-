# Idea del proyecto

## Contexto
Proyecto para el **NASA Space Apps Challenge 2026**, reto **"Be an Earth System Trend"**.

## Concepto
Una herramienta para explorar tendencias del sistema terrestre planteada como un **videojuego de detectives**.

## Mecánica principal
1. **Recorrer el mundo**: el usuario maneja a un **detective noir** (fedora y gabardina) que recorre corriendo un mapa del mundo (el estilo del mundo y del mapa está por definir).
2. **Parar en un sitio**: al detenerse en una ubicación, el usuario elige las **variables** a investigar (temperatura, viento, precipitaciones, etc.).
3. **Buscar la tendencia**: con esas variables se calcula y muestra la **tendencia, si existe**.
4. **Pantalla de detective**: se abre una pantalla inspirada en el estilo del *Profesor Layton*, para que el usuario se sienta **detective**.

## Modos de resolución
- **Modo detective**: antes de ver la conclusión, el usuario propone su propia hipótesis y una **IA corrige y comenta su versión**.
- **Modo directo**: el usuario ve la conclusión directamente, sin proponer hipótesis.

## Casos destacados
Habrá **sitios fijados en el mapa** con casos concretos que han sido importantes a nivel histórico, para estudiarlos en detalle. Sus datos se guardan en un JSON local como respaldo por si falla la API.
