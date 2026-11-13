# CONTEXTO DEL PROYECTO — NASA Space Apps Challenge 2026 (Salamanca)

> **Para cualquier Claude (o persona) que lea esto:** este archivo es la referencia común del equipo. Antes de proponer algo, comprueba que encaja con la sección 2 (qué se nos pide), con la sección 3 (cómo nos evalúan) y con la sección 4 (qué es obligatorio y qué está prohibido). Si una duda no se resuelve aquí, **no la rellenes inventando**: dilo y consulta la fuente oficial enlazada.
>
> **Verificación:** última revisión el 13/11/2026, leyendo directamente las páginas oficiales. Cada dato lleva su fuente. *(según el equipo)* = viene de nosotros. **No encontrado en fuentes oficiales** = no se ha podido confirmar.

---

## ⚠️ Lo más importante (resumen en 30 segundos)

1. **Entrega:** del **sáb 14/11 a las 09:00** al **dom 15/11 a las 23:59, hora de Salamanca**. Se puede editar y reenviar hasta el cierre. [S2]
2. **Pitch local en Salamanca: dom 15/11 a las 17:30.** [S6]
3. **Demo:** vídeo de **30 s como máximo** (subtítulos en inglés) **o 7 diapositivas como máximo** en inglés. Si nos pasamos, quedamos fuera del juicio global. [S2]
4. **Todo en inglés**, con enlaces públicos sin login. [S2]
5. **Datos de NASA obligatorios** para premios globales, y deben ser el núcleo del proyecto, no un adorno. [S2][S3]
6. **El reto exige análisis estadístico:** tasa de cambio y test de significancia (t-test, Mann-Kendall o intervalos de confianza). **Nuestra idea aún no lo incluye** (ver §1). [S1]
7. **IA** (en 2026 se llama oficialmente "SI", *Super Intelligence*): permitida, pero **no para idear la solución**. Hay que declarar dónde se usa y nunca puede generar ni modificar marca de NASA. [S2][S5]
8. **No se puede empezar a trabajar en el reto antes del hackathon.** [S5]

---

## 1. Qué queremos hacer *(según el equipo)*

**Reto:** *"Be An Earth System Trend Detective!"* [S1]

### Resumen
Un **juego de detectives**. El jugador lleva un **coche de policía americano** por un **mapa 3D inclinado del mundo**. Cuando para en un sitio (un **caso destacado** o **cualquier otro punto**), elige una **variable** (temperatura, agua, viento…) y se abre una **pantalla estilo Sherlock con gráficos sin conclusiones**. El jugador escribe **su propia conclusión** y una **IA la corrige**.

### Reparto
- **Yeipi:** interfaz.
- Resto del equipo: por definir.

### Ideas descartadas
Una web por niveles y un videojuego de plataformas retro.

### Encaje con los objetivos del reto [S1]
| Objetivo del reto | ¿Lo cubre la idea? |
|---|---|
| 1. Identificar variables de misiones o modelos de NASA | ✅ Parcial: falta decidir cuáles y de qué dataset |
| 2. Obtener los datos de una región concreta | ✅ Parar en un punto del mapa = región |
| 3. Generar y visualizar una serie temporal larga | ✅ Pantalla Sherlock |
| 4. **Tasa de cambio y significancia** | ❌ **Falta.** Opción: revelar el análisis tras la conclusión del jugador o que la IA lo use para corregir |
| Opcional: público de secundaria, universidad y con algo de base científica | ✅ Encaja con el formato de juego |
| Opcional: definiciones sencillas de las variables | ⏳ Por decidir |
| Opcional: ejemplos de demostración | ✅ Los "casos destacados" |
| Opcional: idea de "data detectives" | ✅ Es literalmente nuestro concepto |

### Por decidir
- Stack: librería del mapa 3D, frontend, backend y plataforma (web u otra).
- Datasets de NASA, su cobertura temporal y espacial, y lista cerrada de variables.
- Qué IA corrige, con qué criterio y si usa el resultado estadístico.
- Qué son exactamente los "casos destacados" y qué tipos de gráfico.
- Quién hace el resto de tareas.

---

## 2. Qué se nos pide

### 2.1 El reto (enunciado oficial) [S1]
- **Dificultad:** Advanced. **Temas:** Earth Science y Software.
- **Problema:** hay muchísimas variables de ciencias de la Tierra, así que cuesta elegir cuáles indican cambio y analizarlas. Además, una variable puede subir en una región y bajar en otra aunque el proceso de fondo sea el mismo.
- **Tarea:** una herramienta que permita **seleccionar variables** de misiones o modelos, **visualizar cómo cambian** y determinar **qué cambia, dónde, cuánto y si es "significativo"**. Los cuatro objetivos están en la tabla de §1. Una respuesta que hace **la visualización y el análisis** cubre todo el reto.
- **Consideraciones opcionales:**
  - Una serie corta de preguntas sobre qué o dónde investigar.
  - La IA podría ayudar a encontrar datos con potencial de mostrar tendencias.
  - Los datos diarios o mensuales son los más fáciles de procesar.
  - Una tendencia no significativa también es interesante.
  - Basta con tendencias lineales; puede hacer falta quitar el ciclo estacional.
  - Sugiere herramientas de hidrología de CUAHSI.
- **Instrumentos y modelos que cita:** MODIS, OMI, AIRS, GPM, MERRA-2 y GLDAS.
- **Recursos oficiales (pestaña Resources)** [S1b]:
  - **Sección NASA:** Giovanni (series temporales y descarga), Hydrology Time Series, AppEEARS, Climate Data Online (CDO) y un artículo sobre series de clorofila de SeaWiFS con test de significancia. *Ojo: CDO es de NOAA (NCDC), no de NASA; no basta como "dato de NASA".*
  - **Sección agencias socias:** KNMI Climate Explorer, dos artículos sobre tests de tendencia y significancia, y recursos de la CSA (RCM, Geo.ca, SWOT, ecosistemas, tutorial de SAR en Python). *KNMI no es una de las agencias socias oficiales; los de la CSA sí.*

### 2.2 Qué hay que entregar [S2]
Se entrega en spaceappschallenge.org: perfil → *My Team* → pestaña *Project* (aparece el 14/11 a las 09:00). **La página de entrega es lo que más pesa** en la nota; la demo cuenta sobre todo en *Presentation*.

**Campos del formulario:**
1. **Project Name**.
2. **High-Level Project Summary**: qué hemos hecho, cómo responde al reto y por qué importa.
3. **Link to Project Demo**: alojada fuera (YouTube, Drive, GitHub…).
4. **Link to Final Project**: sin contraseña ni registro.
5. **Detailed Project Description**: qué hace, cómo funciona, beneficios, objetivos, herramientas y lenguajes.
6. **Use of SI**: no la ven los jueces, pero sí ven las marcas de IA dentro del proyecto.
7. **NASA Data**: qué datos y recursos de NASA hemos usado.
8. **Space Agency Partner Data and Other References**: **todo** lo usado (código, texto, imágenes, aunque sean open source). Se recomienda usar datos de agencias socias; entre ellas están la **Agencia Espacial Española** y la **ESA**.

**Otros puntos:**
- Se pueden subir imágenes (JPG, PNG o GIF de hasta 10 MB), no vídeos ni documentos.
- Guardar a menudo ("Save Progress") y usar el "Lock" para no pisarnos. Solo cuenta lo último guardado.
- Si hacemos una web, se recomienda pedir la clasificación de FortiGuard para que los jueces puedan abrirla (no obligatorio).
- **Para enviar:** marcar las dos casillas (Terms and Conditions y "Confirm All Work is Original") y pulsar **"Submit for Judging"**.
- **Guion de vídeo sugerido:** 0:00 equipo · 0:02 reto · 0:05 nombre y eslogan · 0:10 cómo funciona y uso de datos NASA · 0:20–0:30 visión de futuro.
- **Las diapositivas deben incluir:** nombre del equipo, nombres de los miembros y reto elegido.
- Quien entregue recibe un certificado de participación.

### 2.3 Fechas y sede
**Global** [S2][S3]:

| Fecha | Hito |
|---|---|
| 3/12/2026 | Global Nominees |
| 17/12/2026 | Global Finalists y Honorable Mentions |
| 26/01/2027 | Global Winners |

**Sede de Salamanca** [S6]:
- **Lugar:** Parque Científico USAL, Edificio M3, Sala U Talent. C. del Adaja, 10, 37185 Villamayor (Salamanca). Presencial y virtual.
- **Local Lead:** Pierina Gabriela Jaramillo Wong — spaceapps.salamanca@studiohercode.com.
- **Sáb 14:** 08:30 recepción · 09:00 empieza el hackathon · cafés a las 11:00 y 16:00.
- **Dom 15:** 09:00 continuación y preparación de presentaciones · cafés a las 11:00 y 16:00 · **17:30 Pitch competition**.
- **Formato y duración del pitch, rúbrica y premios locales:** No encontrado en fuentes oficiales. *Preguntar a la Local Lead.*

---

## 3. Evaluación (Judging & Awards Guide, 13/11/2026) [S3]

**Los mismos 5 criterios en todas las fases**, cada uno **de 1 a 5**. No se publican pesos.

| Criterio | Qué valora (paráfrasis) | Para sacar un 5 |
|---|---|---|
| **Impact** | Tamaño del problema y a cuánta gente ayuda o inspira | Problema importante, gran alcance |
| **Creativity** | Concepto nuevo o mejora significativa de algo existente | Enfoque nunca visto |
| **Validity** | Base científica, viabilidad, lo completo que está **y lo fácil de usar** | Sólido, completo, listo para usarse y muy usable |
| **Relevance** | Responde de lleno al reto **con los datos de NASA como núcleo** | Datos de NASA imprescindibles |
| **Presentation** | Contar bien el reto, la solución y por qué importa. Se evalúan la demo **y** el proyecto | Presentación estructurada y convincente |

La guía pide **no descuidar *Presentation*** y dedicar tiempo al pitch y a la historia.

### Fases
1. **Local:** jueces de la Local Lead eligen los **Global Nominees**; puede haber premios locales aparte. *Cuántos nomina Salamanca: No encontrado en fuentes oficiales.*
2. **Global:** expertos eligen **Global Finalists** y Honorable Mentions.
3. **Ejecutiva:** comité de NASA y agencias socias reparte **10 premios**: Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission Concept, Most Inspirational, Best Storytelling, Global Connection, Art & Technology y Local Impact. *Nuestro concepto podría encajar con Best Storytelling, Art & Technology o Best Use of Data.*

### Checklist de autoevaluación
- [ ] **Impact:** ¿sabemos decir en una frase a quién ayuda?
- [ ] **Creativity:** ¿qué aporta frente a Giovanni o KNMI Climate Explorer?
- [ ] **Validity:** ¿estadística correcta? ¿demo funcional? ¿fácil para alguien sin contexto?
- [ ] **Relevance:** ¿cubrimos los 4 objetivos, **incluida la significancia**? ¿Datos de NASA como núcleo?
- [ ] **Presentation:** ¿la página de entrega cuenta la historia completa? ¿Demo dentro del límite?
- [ ] Enlaces probados en ventana privada · todo en inglés · IA declarada · referencias y licencias listadas.
- [ ] "Submit for Judging" antes del dom 15/11 a las 23:59 · pitch listo para las 17:30.

---

## 4. Obligaciones y prohibiciones

### ✅ Obligatorio
- **Responder directamente a un reto oficial.** [S3][S4]
- **Equipo de 1 a 6 personas**, todas confirmadas (no en lista de espera) en la sede de Salamanca y visibles en la pestaña Members. No se pueden añadir miembros después del cierre. [S3][S5]
- **Rellenar todos los campos** y marcar las dos casillas antes de enviar. [S2][S3]
- **Citar todas las fuentes**, incluidas las open source o gratuitas. NASA puede retirar el material o el premio si no lo hacemos. [S4]
- **Licencias:** [S4]
  - Nuestro contenido original debe ser de libre acceso o tener licencia aprobada por la OSI. Si no indicamos ninguna, NASA lo distribuye con **Apache 2.0**.
  - Los materiales que no sean de NASA ni de agencias socias deben ser públicos u open source, con la licencia indicada en la documentación.
- **Tener los derechos** de todo lo que entreguemos y que nada esté sujeto a control de exportación (ITAR/EAR). [S2][S4]
- **Declarar la IA:** imágenes y vídeos con **marca de agua visible**; audio, código y datos con aviso en el texto y en los metadatos (recomendación: indicarlo también en el README). [S2]
- Superar la revisión de NASA por la restricción respecto a China. [S3]

### ⛔ Prohibido
- **Trabajar en el reto antes del hackathon.** [S5]
- **Usar la IA para idear la solución.** [S2]
- **Contenido generado por IA que use, contenga o modifique marca de NASA** (logos, banderas, identificadores de misión). [S2]
- **Usar el logo de NASA** ("meatball" o "worm") sin permiso explícito. [S7]
- **Imágenes, vídeo, voz o semejanza de menores de 18.** [S2][S4][S5]
- **Datos personales identificables**, promoción comercial, información confidencial que no podamos publicar y contenido amenazante, difamatorio, obsceno, discriminatorio o sexualmente explícito. [S4]
- Estar en más de un equipo o trabajar en más de un reto. [S5]

### ❓ Zonas grises (preguntar a la Local Lead o decidir en equipo)
1. **Trabajo previo.** Haber pensado la idea es razonable, pero **no conviene llevar código ni diseños ya hechos para este proyecto**. Sobre librerías o plantillas genéricas nuestras, las fuentes no dicen nada; si se usan, hay que citarlas.
2. **La IA dentro del producto** (la que corrige al jugador). No está prohibida; hay que declararla y citar el modelo o API y sus condiciones. *Duda:* si es una API propietaria, puede chocar con la norma de que el material ajeno a NASA sea público u open source. *Confirmar.*
3. **Logo de Space Apps 2026** (spaceappschallenge.org/brand): no está claro si se puede poner dentro del proyecto. **Hasta confirmarlo, ningún logo de NASA en la interfaz**; basta con "Data: NASA …" en texto.
4. **Pitch local:** formato, duración y si se proyecta la demo. *Preguntar.*
5. **Cesión de derechos** [S4]: al entregar, damos permiso a NASA para mostrar, copiar y distribuir la solución para apoyar Space Apps. En los vídeos, la licencia al Gobierno de EE. UU. es gratuita, mundial, perpetua y **no exclusiva**, y NASA puede usar el nombre y la imagen de los adultos que aparezcan. Seguimos siendo dueños de nuestro trabajo. Todo el equipo debería saberlo.

---

## Fuentes
- **[S1]** Reto, pestaña Details: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/
- **[S1b]** Reto, pestaña Resources: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources
- **[S2]** Project Submission Guide (12/11/2026): https://www.spaceappschallenge.org/resources/project-submission-guide/
- **[S3]** Judging & Awards Guide (13/11/2026): https://www.spaceappschallenge.org/resources/judging-awards-guide/
- **[S4]** Participant Terms and Conditions: https://www.spaceappschallenge.org/legal/
- **[S5]** Participant FAQs (13/11/2026): https://www.spaceappschallenge.org/resources/participant-faqs/
- **[S6]** Sede de Salamanca (Details y Local Event Schedule): https://www.spaceappschallenge.org/2026/local-events/salamanca/
- **[S7]** NASA Brand Center, uso del logo: https://www.nasa.gov/nasa-brand-center/nasa-logo-use/
