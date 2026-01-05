
export function generateMaze(size: number) {
  // We want a layout like: W PP WW PP WW PP WW
  // W=0, PP=1,2, WW=3,4, PP=5,6...
  // Step size is 4.
  const s = size % 4 !== 3 ? size + (3 - (size % 4)) : size;
  const map = Array(s).fill(0).map(() => Array(s).fill(1));
  
  function walk(x: number, y: number) {
    // Carve 2x2 node
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (y + dy < s && x + dx < s) map[y + dy][x + dx] = 0;
      }
    }
    
    const dirs = [[0, -4], [0, 4], [-4, 0], [4, 0]];
    dirs.sort(() => Math.random() - 0.5);
    
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      
      // Bounds check: must stay within 1-cell border
      if (nx >= 1 && nx < s - 1 && ny >= 1 && ny < s - 1 && map[ny][nx] === 1) {
        // Carve connector
        if (dx !== 0) { // Horizontal move
          const startX = Math.min(x, nx);
          for (let tx = startX; tx < startX + 4; tx++) {
            if (tx < s) {
              map[y][tx] = 0;
              map[y + 1][tx] = 0;
            }
          }
        } else { // Vertical move
          const startY = Math.min(y, ny);
          for (let ty = startY; ty < startY + 4; ty++) {
            if (ty < s) {
              map[ty][x] = 0;
              map[ty][x + 1] = 0;
            }
          }
        }
        walk(nx, ny);
      }
    }
  }
  
  // Starting point (1,1)
  walk(1, 1);
  return map;
}

export function findDeadEnds(map: number[][]) {
  const deadEnds: {x: number, y: number}[] = [];
  const s = map.length;
  // Scan the centers of our 2x2 nodes (starting at 1,1; 5,1; etc)
  for (let y = 1; y < s - 1; y += 4) {
    for (let x = 1; x < s - 1; x += 4) {
      if (map[y][x] === 0) {
        let exits = 0;
        // Check 4 cardinal directions for path connectivity
        // We look 2 cells away to skip the 2x2 node itself
        if (y >= 4 && map[y - 1][x] === 0) exits++; // North
        if (y < s - 4 && map[y + 2][x] === 0) exits++; // South
        if (x >= 4 && map[y][x - 1] === 0) exits++; // West
        if (x < s - 4 && map[y][x + 2] === 0) exits++; // East
        
        if (exits === 1) {
          deadEnds.push({ x: x + 1, y: y + 1 });
        }
      }
    }
  }
  
  // Safety: if too few dead ends, pick random open spots
  if (deadEnds.length < 10) {
    for (let i = 0; i < 30; i++) {
      const rx = Math.floor(Math.random() * (s - 4)) + 2;
      const ry = Math.floor(Math.random() * (s - 4)) + 2;
      if (map[ry][rx] === 0) deadEnds.push({ x: rx + 0.5, y: ry + 0.5 });
    }
  }
  return deadEnds;
}
