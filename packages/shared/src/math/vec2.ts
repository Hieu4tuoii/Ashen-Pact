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

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function normalizeAngle(angleRad: number): number {
  let a = angleRad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a: number, b: number): number {
  return normalizeAngle(a - b);
}

export function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
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

const circleAABBOut = {
  x: 0,
  y: 0,
  collided: false,
  normalX: 0,
  normalY: 0,
};

/**
 * Resolves overlap between a moving circle and a static AABB (wall/pillar tile).
 * Returns the pushed-out position and whether a collision occurred.
 */
export function resolveCircleVsAABB(
  x: number,
  y: number,
  radius: number,
  box: AABB,
): { x: number; y: number; collided: boolean; normalX: number; normalY: number } {
  const closestX = clamp(x, box.minX, box.maxX);
  const closestY = clamp(y, box.minY, box.maxY);
  const dx = x - closestX;
  const dy = y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > radius * radius) {
    circleAABBOut.x = x;
    circleAABBOut.y = y;
    circleAABBOut.collided = false;
    circleAABBOut.normalX = 0;
    circleAABBOut.normalY = 0;
    return circleAABBOut;
  }

  // Circle center is outside the box
  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;
    const penetration = radius - dist;
    circleAABBOut.x = x + nx * penetration;
    circleAABBOut.y = y + ny * penetration;
    circleAABBOut.collided = true;
    circleAABBOut.normalX = nx;
    circleAABBOut.normalY = ny;
    return circleAABBOut;
  }

  // Circle center is inside the box: push out along minimum penetration axis
  const leftPen = x - box.minX + radius;
  const rightPen = box.maxX - x + radius;
  const topPen = y - box.minY + radius;
  const bottomPen = box.maxY - y + radius;
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

  circleAABBOut.collided = true;
  if (minPen === leftPen) {
    circleAABBOut.x = box.minX - radius;
    circleAABBOut.y = y;
    circleAABBOut.normalX = -1;
    circleAABBOut.normalY = 0;
    return circleAABBOut;
  }
  if (minPen === rightPen) {
    circleAABBOut.x = box.maxX + radius;
    circleAABBOut.y = y;
    circleAABBOut.normalX = 1;
    circleAABBOut.normalY = 0;
    return circleAABBOut;
  }
  if (minPen === topPen) {
    circleAABBOut.x = x;
    circleAABBOut.y = box.minY - radius;
    circleAABBOut.normalX = 0;
    circleAABBOut.normalY = -1;
    return circleAABBOut;
  }
  circleAABBOut.x = x;
  circleAABBOut.y = box.maxY + radius;
  circleAABBOut.normalX = 0;
  circleAABBOut.normalY = 1;
  return circleAABBOut;
}

/**
 * Checks if a target circle is within a directional cone/arc (used for melee swings and Vanguard shield).
 */
export function isCircleInCone(
  originX: number,
  originY: number,
  aimAngleRad: number,
  halfArcRad: number,
  range: number,
  target: Circle,
): boolean {
  const dx = target.x - originX;
  const dy = target.y - originY;
  const maxDist = range + target.radius;
  const distSq = dx * dx + dy * dy;
  if (distSq > maxDist * maxDist) return false;
  if (distSq <= target.radius * target.radius) return true;

  const angleToTarget = Math.atan2(dy, dx);
  const diff = Math.abs(angleDiff(angleToTarget, aimAngleRad));
  const angularSlack = Math.asin(clamp(target.radius / Math.sqrt(distSq), 0, 1));
  return diff <= halfArcRad + angularSlack;
}
