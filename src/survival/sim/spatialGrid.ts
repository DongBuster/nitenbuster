export class SpatialGrid<T extends { id: string; x: number; y: number }> {
  private readonly cellSize: number;
  private readonly cells = new Map<number, T[]>();

  constructor(cellSize = 160) {
    this.cellSize = Math.max(1, cellSize);
  }

  clear(): void {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
    }
  }

  private cellKey(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const key = this.cellKey(cx, cy);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(item);
  }

  queryRadius(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    if (radius < 0) return out;

    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const radiusSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(this.cellKey(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            out.push(item);
          }
        }
      }
    }

    return out;
  }

  findNearest(
    x: number,
    y: number,
    maxRadius: number,
    filter?: (item: T) => boolean,
  ): T | null {
    if (maxRadius < 0) return null;

    const minCx = Math.floor((x - maxRadius) / this.cellSize);
    const maxCx = Math.floor((x + maxRadius) / this.cellSize);
    const minCy = Math.floor((y - maxRadius) / this.cellSize);
    const maxCy = Math.floor((y + maxRadius) / this.cellSize);
    const maxRadiusSq = maxRadius * maxRadius;

    let best: T | null = null;
    let bestDistSq = maxRadiusSq;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(this.cellKey(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (filter && !filter(item)) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= maxRadiusSq && (best === null || distSq < bestDistSq)) {
            best = item;
            bestDistSq = distSq;
          }
        }
      }
    }

    return best;
  }
}
