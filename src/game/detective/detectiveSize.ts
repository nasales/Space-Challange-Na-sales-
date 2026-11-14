// Tamaño del detective. Va en su propio archivo para que la física pueda usarlo sin importar
// el modelo 3D (y así no hay importaciones en círculo: modelo → física → modelo).

/** Escala del modelo respecto a sus medidas base (mide ~2,7 de alto sin escalar). */
export const DETECTIVE_SCALE = 3.4
/** Huella en el suelo en unidades del mundo (la usa la física para cuestas y choques). */
export const DETECTIVE = { length: 0.9 * DETECTIVE_SCALE, width: 1.1 * DETECTIVE_SCALE }
