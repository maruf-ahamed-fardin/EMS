/**
 * The maths behind the photo cropper, kept apart from the canvas so it can be tested.
 *
 * The image is drawn into a square viewport of `view` pixels at `scale`, with its top-left corner
 * at (`x`, `y`) in viewport pixels. The image always covers the whole viewport, so the crop never
 * has an empty edge.
 */
export interface CropState {
  x: number;
  y: number;
  scale: number;
}

/** The scale at which the image's shorter side just fills the viewport (zoom 1). */
export function coverScale(width: number, height: number, view: number): number {
  return view / Math.min(width, height);
}

/** Keeps the image covering the viewport. */
export function clamp(state: CropState, width: number, height: number, view: number): CropState {
  const minX = view - width * state.scale;
  const minY = view - height * state.scale;
  return {
    scale: state.scale,
    x: Math.min(0, Math.max(minX, state.x)),
    y: Math.min(0, Math.max(minY, state.y)),
  };
}

/** The image centred at zoom 1. */
export function initialCrop(width: number, height: number, view: number): CropState {
  const scale = coverScale(width, height, view);
  return { scale, x: (view - width * scale) / 2, y: (view - height * scale) / 2 };
}

/** Zooms about the viewport's centre, so the part of the photo in the middle stays there. */
export function zoomTo(state: CropState, zoom: number, width: number, height: number, view: number): CropState {
  const scale = coverScale(width, height, view) * zoom;
  const centreX = (view / 2 - state.x) / state.scale;
  const centreY = (view / 2 - state.y) / state.scale;
  return clamp({ scale, x: view / 2 - centreX * scale, y: view / 2 - centreY * scale }, width, height, view);
}

/** The square of the source image the viewport shows, in image pixels. */
export function sourceRect(state: CropState, view: number): { sx: number; sy: number; size: number } {
  // `0 - …` rather than `-…`: never a negative zero at the edge
  return { sx: 0 - state.x / state.scale, sy: 0 - state.y / state.scale, size: view / state.scale };
}
