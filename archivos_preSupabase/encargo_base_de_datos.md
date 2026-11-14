# Contexto: subir los datos de NASA a Supabase

> **Para el Claude que lea esto:** vas a ayudar a la persona responsable de la base de datos a cargar datos de NASA en Supabase. Este documento y los dos archivos adjuntos (`supabase_schema.sql` y `etl_espana.py`) son todo el contexto. Las decisiones de abajo ya están tomadas por el equipo: no las rediseñes sin avisar, porque el frontend y estadística dependen de ellas. Si algo falla, arréglalo sobre estos archivos.

## 1. Situación

- **Evento:** NASA Space Apps Challenge 2026, sede de Salamanca, reto *"Be An Earth System Trend Detective!"*.
- **Plazos:** pitch el domingo 15/11 a las 17:30; la entrega cierra el domingo 15/11 a las 23:59 (hora de Salamanca).
- **Proyecto:** un juego web de detectives. El jugador conduce un coche de policía por un mapa 3D de España y para en un punto. Elige una variable y ve gráficos de su evolución, sin la conclusión. Escribe su conclusión y una IA la corrige.
- **Stack:** Supabase (base de datos), Vite (frontend), Vercel (despliegue).
- **Reparto:**
  - **Tú (este chat):** cargar los datos en Supabase.
  - **Un compañero:** Vite y Vercel.
  - **Yeipi:** la interfaz.
  - **Dos de estadística:** calculan las tendencias y la significancia y verifican los resultados.

## 2. Alcance de esta tarea

**Sí:**
1. Crear el esquema en Supabase.
2. Descargar de NASA las series mensuales de España.
3. Cargarlas.
4. Comprobar que la carga está completa y bien.
5. Pasar al frontend lo que necesita para leerla.

**No:**
- Ni tendencias, ni significancia, ni validación estadística: eso lo hacen los de estadística.
- El script **no** rellena la tabla `trends`. Se queda vacía para ellos.
- El cálculo opcional `--with-trends` existe, pero **no se usa**.

## 3. Decisiones ya tomadas

| Decisión | Valor |
|---|---|
| Zona | Península y Baleares (lon −9,5 a 4,5; lat 35,75 a 44) y Canarias (lon −18,25 a −13,25; lat 27,5 a 29,5) |
| Mar | **No hay mar** en el mapa: solo celdas de tierra, según la máscara de GLDAS |
| Rejilla | 0,25° (unos 28 km), la nativa de GLDAS. Estimación: ~1170 celdas en Península y Baleares y ~10 en Canarias |
| Paso temporal | Mensual |
| Fuente | Solo NASA, de GES DISC, con la librería `earthaccess` (necesita cuenta de Earthdata) |

**Las 6 variables:**

| id | Variable | Producto NASA (short_name, versión) | Variable original | Unidad final | Desde | Paso a 0,25° |
|---|---|---|---|---|---|---|
| `tair` | Temperatura del aire | `GLDAS_NOAH025_M` 2.1 | `Tair_f_inst` | °C | 2000 | Nativa |
| `wind` | Velocidad del viento | `GLDAS_NOAH025_M` 2.1 | `Wind_f_inst` | m/s | 2000 | Nativa |
| `soilmoist` | Humedad del suelo 0–10 cm | `GLDAS_NOAH025_M` 2.1 | `SoilMoi0_10cm_inst` | kg/m² | 2000 | Nativa |
| `evap` | Evapotranspiración | `GLDAS_NOAH025_M` 2.1 | `Evap_tavg` | mm/día | 2000 | Nativa |
| `precip` | Precipitación | `GPM_3IMERGM` 07 | `precipitation` (grupo `Grid`) | mm/día | 1998 | Interpolación lineal desde 0,1° |
| `t2m_long` | Temperatura a 2 m (serie larga) | `M2TMNXSLV` 5.12.4 | `T2M` | °C | 1980 | Punto más cercano desde 0,5° × 0,625° |

**DOIs para citar:**
- GLDAS: 10.5067/SXAVCZFAQLNO
- IMERG: 10.5067/GPM/IMERG/3B-MONTH/07
- MERRA-2: 10.5067/AP1B0BA5PD2K

## 4. Cómo es la base de datos (`supabase_schema.sql`)

- `variables`: id, `name_en`, unidad, fuente y `definition_en`. Va en inglés porque lo ve el jugador.
- `cells`: `cell_id`, lat, lon y región. Solo hay celdas de tierra.
  - `cell_id = floor((lat+90)/0.25) * 1440 + floor((lon+180)/0.25)`.
- `series`: una fila por celda y variable.
  - `start_month`
  - `values`: `real[]`, un valor por mes; `null` es que no hay dato.
  - `climatology`: `real[12]`, las medias de enero a diciembre.
- `trends`: vacía; la rellena estadística.
- **Permisos:** RLS activo. Cualquiera puede leer, nadie puede escribir desde el navegador.
- **Función `get_cell(p_lat, p_lon)`:** devuelve las variables de la celda de tierra más cercana (a menos de ~0,5°) y la distancia en `distance_km`. Un punto en mar abierto devuelve vacío. Mientras `trends` esté vacía, sus columnas salen a `null`.

## 5. Pasos

1. **Cuenta de NASA Earthdata:** https://urs.earthdata.nasa.gov. En el perfil, *Applications → Authorized Apps*, autorizar **"NASA GESDISC DATA ARCHIVE"**.
2. **Proyecto en Supabase** (plan gratuito, región de la UE). En el *SQL Editor*, pegar `supabase_schema.sql` y ejecutarlo.
3. **Instalar las dependencias** (Python 3.10 o superior):
   ```bash
   pip install earthaccess xarray h5netcdf netCDF4 scipy numpy "psycopg[binary]"
   ```
4. **Prueba pequeña:**
   ```bash
   python etl_espana.py --only tair --export-dir export
   ```
   La primera vez pide el usuario y la contraseña de Earthdata. Primero lee un mes de GLDAS para la máscara de tierra y muestra "Tierra en … celdas". Después muestra "[tair] N celdas con serie".
5. **Carga completa:**
   ```bash
   export SUPABASE_DB_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-eu-....pooler.supabase.com:5432/postgres"
   python etl_espana.py --upload --export-dir export
   ```
   La cadena está en el botón **Connect** del proyecto. Usad la del **Session pooler**, porque la directa suele ir solo por IPv6.
6. **Entregar al frontend** (en Vercel → *Settings → Environment Variables*):
   - `VITE_SUPABASE_URL` = la Project URL.
   - `VITE_SUPABASE_ANON_KEY` = la clave pública (anon o publishable).

   **Nunca** la contraseña de la base de datos ni la clave `service_role`. Uso en el frontend:
   ```js
   const { data } = await supabase.rpc('get_cell', { p_lat: 40.96, p_lon: -5.66 })
   ```
7. **Plan B:** la carpeta `export/` (un JSON por celda más `variables.json`) se copia en `public/data/` del proyecto Vite.

## 6. Comprobar que la carga está bien (solo la carga, no la estadística)

- [ ] `select var_id, count(*) from series group by var_id;` devuelve 6 variables, todas con el mismo número de celdas (unas 1180).
- [ ] `select var_id, start_month, array_length(values,1) from series where cell_id = 753817;` (Salamanca):
  - `tair`, `wind`, `soilmoist` y `evap` empiezan en 2000;
  - `precip` empieza en 1998;
  - `t2m_long` empieza en 1980.
- [ ] `select * from get_cell(40.96, -5.66);` devuelve 6 filas, con la celda centrada en 40,875 / −5,625.
- [ ] `get_cell(36.53, -6.29)` (Cádiz, en la costa) devuelve una celda cercana con `distance_km` pequeño; un punto en pleno mar devuelve vacío.
- [ ] Las unidades tienen sentido: en Salamanca, una temperatura media de unos 12 °C (no unos 285, que serían Kelvin) y una precipitación de 1–2 mm/día.
- [ ] En *Settings → Usage*, la base de datos ocupa decenas de MB, lejos del límite de 500 MB del plan gratuito.

## 7. Lo que no está probado y puede fallar

- **La conexión real con NASA no se ha ejecutado nunca.** Lo que sí se probó con datos simulados y un Postgres local: el esquema, la carga, el filtro de tierra, `get_cell` y los permisos.
- **Puntos probables de ajuste:**
  - el nombre exacto de alguna variable: compruébalo con `print(ds.data_vars)`;
  - las dimensiones de IMERG, que vienen como (time, lon, lat);
  - la velocidad de lectura por HTTPS desde Europa. Si va muy lento, usa `earthaccess.download` y recorta en local.
- **Canarias:** solo hay unas 10 celdas de tierra. La Gomera y El Hierro pueden no tener celda propia; en ese caso, `get_cell` devuelve la de la isla vecina.
- **MERRA-2 en la costa:** es grueso, y su punto más cercano a una celda costera puede caer en el mar.
- **Supabase gratis se pausa** tras 7 días sin actividad, y los jueces miran el proyecto en diciembre y enero. Por eso existe el plan B en JSON.

## 8. Normas del reto que afectan a esta tarea

- Todo lo que vea el jugador, en inglés. `name_en` y `definition_en` ya lo están.
- Hay que citar los datos de NASA (DOIs de arriba).
- El script se escribió con ayuda de IA: declararlo en el README y en el campo "Use of SI".
- No usar logos de NASA en la interfaz.
