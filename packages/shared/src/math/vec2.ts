export interface Vec2 {
  x: number;
  y: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function circleVsCircle(a: Circle, b: Circle): boolean {
  const r = a.radius + b.radius;
  return distanceSq(a.x, a.y, b.x, b.y) <= r * r;
}

export function circleVsAABB(circle: Circle, box: AABB): boolean {
  const closestX = clamp(circle.x, box.minX, box.maxX);
  const closestY = clamp(circle.y, box.minY, box.maxY);
  return distanceSq(circle.x, circle.y, closestX, closestY) <= circle.radius * circle.radius;
}
