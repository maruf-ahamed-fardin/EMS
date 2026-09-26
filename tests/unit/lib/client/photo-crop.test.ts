import { describe, expect, it } from 'vitest';
import { clamp, initialCrop, sourceRect, zoomTo } from '@/lib/client/photo-crop';

const VIEW = 300;

describe('photo crop', () => {
  it('starts centred, with the shorter side filling the square', () => {
    // A landscape 1200×800 photo: the height fills, the sides are trimmed equally
    const state = initialCrop(1200, 800, VIEW);
    expect(sourceRect(state, VIEW)).toEqual({ sx: 200, sy: 0, size: 800 });
  });

  it('never lets the photo leave an empty edge', () => {
    const start = initialCrop(1200, 800, VIEW);
    const dragged = clamp({ ...start, x: 500, y: -900 }, 1200, 800, VIEW);
    const rect = sourceRect(dragged, VIEW);
    expect(rect.sx).toBe(0);
    expect(rect.sy).toBe(0); // 800 tall at zoom 1: there is no room to move up or down
  });

  it('zooms about the centre, and back out to the whole square', () => {
    const start = initialCrop(1000, 1000, VIEW);
    const zoomed = sourceRect(zoomTo(start, 2, 1000, 1000, VIEW), VIEW);
    expect(zoomed).toEqual({ sx: 250, sy: 250, size: 500 });

    const back = sourceRect(zoomTo(zoomTo(start, 2, 1000, 1000, VIEW), 1, 1000, 1000, VIEW), VIEW);
    expect(back).toEqual({ sx: 0, sy: 0, size: 1000 });
  });
});
