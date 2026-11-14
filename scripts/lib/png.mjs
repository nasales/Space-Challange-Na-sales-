// Decodificador PNG mínimo (solo lo que usan las teselas de altura: 8 bits, RGB o RGBA,
// sin entrelazado). Escrito a mano para no instalar librerías.
import { inflateSync } from 'node:zlib'

export function decodePng(buf) {
  let pos = 8 // saltar la firma PNG
  let width = 0, height = 0, colorType = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[12] !== 0) throw new Error('PNG no soportado')
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const bpp = colorType === 2 ? 3 : colorType === 6 ? 4 : 0
  if (!bpp) throw new Error(`Tipo de color PNG no soportado: ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  // Cada fila empieza con un byte de "filtro" que hay que deshacer.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0 // izquierda
      const b = y > 0 ? out[dst - stride + x] : 0 // arriba
      const c = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0 // arriba-izquierda
      let v = raw[src + x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[dst + x] = v & 0xff
    }
  }
  return { width, height, bpp, pixels: out }
}

