// Lector mínimo de archivos ZIP (solo lo necesario para los ZIP de GeoNames).
// Escrito a mano con zlib (incluido en Node) para no instalar librerías.
import { inflateRawSync } from 'node:zlib'

/** Devuelve el contenido (texto UTF-8) del archivo `name` dentro del ZIP. */
export function readZipEntry(buf, name) {
  // El "directorio central" al final del ZIP dice dónde está cada archivo
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error('No es un ZIP válido')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let k = 0; k < count; k++) {
    const method = buf.readUInt16LE(p + 10)
    const size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
    const offset = buf.readUInt32LE(p + 42)
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (entryName === name) {
      const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28)
      const data = buf.subarray(start, start + size)
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8') // 8 = comprimido
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`${name} no está en el ZIP`)
}
