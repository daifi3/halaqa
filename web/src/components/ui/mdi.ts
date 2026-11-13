import { mdiArrowTopRight, mdiCircleOutline, mdiEraser, mdiPencil, mdiSigma, mdiSquareOutline, mdiVectorLine } from '@mdi/js';

export const MDI = {
  pencil: mdiPencil,
  'vector-line': mdiVectorLine,
  'arrow-top-right': mdiArrowTopRight,
  'square-outline': mdiSquareOutline,
  'circle-outline': mdiCircleOutline,
  sigma: mdiSigma,
  eraser: mdiEraser,
} as const;

export type MdiName = keyof typeof MDI;
