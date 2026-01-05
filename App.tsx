
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Types from './types';
import * as Constants from './constants';
import * as MazeGen from './engine/MazeGen';

const ITEM_ICONS: Record<Types.ItemType, string> = {
  [Types.ItemType.FOOD]: '🍞',
  [Types.ItemType.WATER]: '💧',
  [Types.ItemType.FLASHLIGHT]: '🔦',
  [Types.ItemType.KNIFE]: '🔪',
  [Types.ItemType.GUN]: '🔫',
};

const SAVE_KEY = 'void_labyrinth_save';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

const isLineOfSightClear = (x1: number, y1: number, x2: number, y2: number, map: number[][]) => {
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const steps = Math.min(dist * 10, 50);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const currX = Math.floor(x1 + (x2 - x1) * t);
    const currY = Math.floor(y1 + (y2 - y1) * t);
    if (map[currY]?.[currX] === 1) return false;
  }
  return true;
};

const getNextPathStep = (startX: number, startY: number, targetX: number, targetY: number, map: number[][]) => {
  const sX = Math.floor(startX), sY = Math.floor(startY);
  const tX = Math.floor(targetX), tY = Math.floor(targetY);
  if (sX === tX && sY === tY) return null;

  const queue: [number, number, [number, number][]][] = [[sX, sY, []]];
  const visited = new Set<string>();
  visited.add(`${sX},${sY}`);

  let iters = 0;
  while (queue.length > 0 && iters < 600) {
    const [x, y, path] = queue.shift()!;
    iters++;
    if (Math.abs(x - tX) <= 1 && Math.abs(y - tY) <= 1) return path[0] || [x, y];

    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < map[0].length && ny >= 0 && ny < map.length && map[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
        visited.add(`${nx},${ny}`);
        queue.push([nx, ny, [...path, [nx, ny]]]);
      }
    }
  }
  return null;
};

type Screen = 'MENU' | 'PLAYING';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('MENU');
  const [hasSave, setHasSave] = useState(false);
  const [gameState, setGameState] = useState<Types.GameState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastTimeRef = useRef<number>(performance.now());
  const lastShotTimeRef = useRef<number>(0);
  const frameIdRef = useRef<number>(0);

  // Asset Refs
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const monsterImgRef = useRef<HTMLImageElement | null>(null);
  const wallTopImgRef = useRef<HTMLImageElement | null>(null);
  const wallFaceImgRef = useRef<HTMLImageElement | null>(null);
  const floorImgRef = useRef<HTMLImageElement | null>(null);
  const chestClosedImgRef = useRef<HTMLImageElement | null>(null);
  const chestOpenImgRef = useRef<HTMLImageElement | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(0);

  const damageNumbersRef = useRef<Types.DamageNumber[]>([]);
  const nextDamageNumberIdRef = useRef(0);

  useEffect(() => {
    const save = localStorage.getItem(SAVE_KEY);
    setHasSave(!!save);

    const loadImg = (src: string, ref: React.MutableRefObject<HTMLImageElement | null>) => {
      const img = new Image();
      img.src = src;
      img.onload = () => { ref.current = img; };
    };

    loadImg('/assets/player.png', playerImgRef);
    loadImg('/assets/monster.png', monsterImgRef);
    loadImg('/assets/wall_top.png', wallTopImgRef);
    loadImg('/assets/wall_face.png', wallFaceImgRef);
    loadImg('/assets/floor.png', floorImgRef);
    loadImg('/assets/chest_closed.png', chestClosedImgRef);
    loadImg('/assets/chest_open.png', chestOpenImgRef);
  }, [screen]);

  const initGame = useCallback((loadExisting = false) => {
    if (loadExisting) {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        // Reset transient visual states
        state.entities.forEach((e: any) => {
          if (e.data) { e.data.hitFlash = 0; }
        });
        setGameState(state);
        setScreen('PLAYING');
        return;
      }
    }

    localStorage.removeItem(SAVE_KEY);
    const map = MazeGen.generateMaze(Constants.MAP_SIZE);
    const deadEnds = MazeGen.findDeadEnds(map);
    const entities: Types.Entity[] = [];

    deadEnds.forEach((pos, i) => {
      if (pos.x <= 4 && pos.y <= 4) return;
      const type = Math.random() > 0.4 ? Types.EntityType.CHEST : Types.EntityType.MONSTER;
      const items: Types.InventoryItem[] = [];
      if (type === Types.EntityType.CHEST) {
        const count = Math.floor(Math.random() * 2) + 1;
        for (let j = 0; j < count; j++) {
          const pool = [Types.ItemType.FOOD, Types.ItemType.WATER, Types.ItemType.KNIFE, Types.ItemType.FLASHLIGHT, Types.ItemType.GUN];
          const it = pool[Math.floor(Math.random() * pool.length)];
          items.push({
            id: `it-${i}-${j}-${Math.random()}`,
            type: it,
            name: it,
            durability: (it === Types.ItemType.KNIFE || it === Types.ItemType.FLASHLIGHT) ? 100 : undefined,
            count: it === Types.ItemType.GUN ? 12 : (it === Types.ItemType.FOOD || it === Types.ItemType.WATER ? 1 : undefined)
          });
        }
      }
      entities.push({
        id: `e-${i}`, x: pos.x, y: pos.y, type, health: 75,
        data: type === Types.EntityType.CHEST ? { items, isOpen: false } : {
          nextTarget: null, lastPathUpdate: 0, spawnX: pos.x, spawnY: pos.y, state: 'IDLE', hitFlash: 0
        }
      });
    });

    setGameState({
      player: { x: 1.5, y: 1.5, dir: 0, health: 100, hunger: 100, hydration: 100, isFlashlightOn: false, inventory: [{ id: 'init-f', type: Types.ItemType.FLASHLIGHT, name: 'FLASHLIGHT', durability: 100 }], equippedLeftId: null, equippedRightId: null, sprinting: false },
      map, entities, isGameOver: false, deathReason: '', message: 'SYSTEM_BOOT_COMPLETE', messageTimeout: 4, chaseActive: false, survivalTime: 0, isPaused: false, activeChestId: null, draggingItemId: null
    });
    setScreen('PLAYING');
    damageNumbersRef.current = [];
  }, []);

  const saveAndExit = () => {
    if (gameState) {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...gameState, isPaused: false }));
      setScreen('MENU');
      setGameState(null);
    }
  };

  const spawnDamageNumber = (x: number, y: number, value: number, color: string = '#ef4444') => {
    damageNumbersRef.current.push({
      id: nextDamageNumberIdRef.current++,
      x, y, value, color, life: 1.0
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState || gameState.isPaused || gameState.isGameOver) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = Constants.CELL_SIZE;
    const ww = window.innerWidth, wh = window.innerHeight;

    // Calculate world coordinates from screen click
    // ScreenX = ww/2 + (worldX - playerX) * s
    // worldX = (ScreenX - ww/2) / s + playerX
    const clickX = (e.clientX - rect.left - ww / 2) / s + gameState.player.x;
    const clickY = (e.clientY - rect.top - wh / 2) / s + gameState.player.y;

    // Determine active weapon
    const { player } = gameState;
    const weapons = [player.inventory.find(i => i?.id === player.equippedLeftId), player.inventory.find(i => i?.id === player.equippedRightId)].filter(Boolean);
    // Prioritize Gun > Knife
    const gun = weapons.find(i => i?.type === Types.ItemType.GUN);
    const knife = weapons.find(i => i?.type === Types.ItemType.KNIFE);

    let attackMade = false;
    let newEntities = [...gameState.entities];

    if (gun && (gun.count || 0) > 0) {
      // GUN ATTACK
      attackMade = true;
      setGameState(prev => {
        if (!prev) return null;
        let nextInv = prev.player.inventory.map(i => i.id === gun.id ? { ...i, count: (i.count! - 1) } : i);

        // Remove empty gun
        const updatedGun = nextInv.find(i => i.id === gun.id);
        if (updatedGun && updatedGun.count! <= 0) {
          nextInv = nextInv.filter(i => i.id !== gun.id);
          if (prev.player.equippedLeftId === gun.id) prev.player.equippedLeftId = null;
          if (prev.player.equippedRightId === gun.id) prev.player.equippedRightId = null;
        }

        return { ...prev, player: { ...prev.player, inventory: nextInv }, message: 'FIRING_SEQUENCE', messageTimeout: 0.5 };
      });

      // Check hits logic
      newEntities = newEntities.map(e => {
        if (e.type === Types.EntityType.MONSTER && e.health! > 0) {
          const dist = Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2);
          if (dist < 0.8 && isLineOfSightClear(player.x, player.y, e.x, e.y, gameState.map)) {
            spawnDamageNumber(e.x, e.y - 0.5, 40, '#fbbf24');
            return { ...e, health: e.health! - 40, data: { ...e.data, hitFlash: 0.2, state: 'CHASING' } };
          }
        }
        return e;
      });

    } else if (knife && (knife.durability || 0) > 0) {
      // KNIFE ATTACK
      // Knife requires clicking ON the monster AND being close
      const targetMonster = newEntities.find(e => e.type === Types.EntityType.MONSTER && e.health! > 0 && Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2) < 0.8);

      if (targetMonster) {
        const distToPlayer = Math.sqrt((targetMonster.x - player.x) ** 2 + (targetMonster.y - player.y) ** 2);
        if (distToPlayer < 2.0) {
          attackMade = true;
          setGameState(prev => {
            if (!prev) return null;
            let nextInv = prev.player.inventory.map(i => i.id === knife.id ? { ...i, durability: (i.durability! - 2) } : i);

            // Remove broken knife
            const updatedKnife = nextInv.find(i => i.id === knife.id);
            if (updatedKnife && updatedKnife.durability! <= 0) {
              nextInv = nextInv.filter(i => i.id !== knife.id);
              if (prev.player.equippedLeftId === knife.id) prev.player.equippedLeftId = null;
              if (prev.player.equippedRightId === knife.id) prev.player.equippedRightId = null;
            }

            return { ...prev, player: { ...prev.player, inventory: nextInv }, message: 'MELEE_ENGAGED', messageTimeout: 0.5 };
          });

          newEntities = newEntities.map(e => {
            if (e.id === targetMonster.id) {
              spawnDamageNumber(e.x, e.y - 0.5, 25, '#ef4444');
              return { ...e, health: e.health! - 25, data: { ...e.data, hitFlash: 0.2, state: 'CHASING' } };
            }
            return e;
          });
        } else {
          setGameState(prev => prev ? { ...prev, message: 'TARGET_OUT_OF_RANGE', messageTimeout: 1.0 } : null);
        }
      }
    } else {
      setGameState(prev => prev ? { ...prev, message: 'NO_WEAPON_READY', messageTimeout: 1.0 } : null);
    }

    if (attackMade) {
      setGameState(prev => prev ? { ...prev, entities: newEntities } : null);
    }
  };

  const gameLoop = useCallback((time: number) => {
    const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = time;

    // Update Particles
    particlesRef.current = particlesRef.current
      .map(p => ({
        ...p,
        x: p.x + p.vx * delta,
        y: p.y + p.vy * delta,
        life: p.life - delta
      }))
      .filter(p => p.life > 0);

    // Update Damage Numbers
    damageNumbersRef.current = damageNumbersRef.current
      .map(dn => ({ ...dn, y: dn.y - 0.5 * delta, life: dn.life - delta }))
      .filter(dn => dn.life > 0);

    setGameState(prev => {
      if (!prev || prev.isGameOver || prev.isPaused) return prev;

      const nextSurvivalTime = prev.survivalTime + delta;
      let nextMessageTimeout = prev.messageTimeout > 0 ? prev.messageTimeout - delta : 0;
      let nextMessage = nextMessageTimeout <= 0 ? '' : prev.message;

      const player = { ...prev.player };
      player.sprinting = !!keysRef.current['ShiftLeft'] && player.hydration > 10;
      const speed = (player.sprinting ? 6.2 : 3.8) * delta;

      let dx = 0, dy = 0;
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= speed;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += speed;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= speed;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += speed;
      if (dx !== 0 || dy !== 0) {
        player.dir = Math.atan2(dy, dx);

        // Emit Particles
        if (Math.random() > 0.7) {
          particlesRef.current.push({
            id: nextParticleIdRef.current++,
            x: player.x + (Math.random() - 0.5) * 0.2,
            y: player.y + 0.3 + (Math.random() - 0.5) * 0.1,
            vx: -dx * 0.5 + (Math.random() - 0.5) * 0.5,
            vy: -dy * 0.5 + (Math.random() - 0.5) * 0.5,
            life: 0.5 + Math.random() * 0.5,
            maxLife: 1.0,
            size: 2 + Math.random() * 4
          });
        }
      }

      const r = 0.2, bodyR = 0.45;
      const nx = player.x + dx, ny = player.y + dy;
      let canX = true, canY = true;

      const checkWall = (tx: number, ty: number) => {
        const mx = Math.floor(tx), my = Math.floor(ty);
        if (my < 0 || my >= prev.map.length || mx < 0 || mx >= prev.map[0].length) return true;
        return prev.map[my][mx] === 1;
      };

      if (checkWall(nx + (dx > 0 ? r : -r), player.y)) canX = false;
      if (checkWall(player.x, ny + (dy > 0 ? r : -r))) canY = false;

      prev.entities.forEach(e => {
        if (e.type === Types.EntityType.MONSTER && e.health! > 0) {
          if (Math.sqrt((e.x - nx) ** 2 + (e.y - ny) ** 2) < bodyR) { canX = false; canY = false; }
        }
      });

      if (canX) player.x = nx;
      if (canY) player.y = ny;

      player.hunger -= 0.04 * delta;
      player.hydration -= (player.sprinting ? 0.15 : 0.07) * delta;
      if (player.hunger <= 0 || player.hydration <= 0) player.health -= 8 * delta;

      // Fix: Check if ANY equipped item is a flashlight, not just the first found equipped item
      const flItemIndex = player.inventory.findIndex(i => i.type === Types.ItemType.FLASHLIGHT && (i.id === player.equippedLeftId || i.id === player.equippedRightId));
      const hasFl = flItemIndex !== -1;

      if (player.isFlashlightOn && hasFl) {
        const it = player.inventory[flItemIndex];
        if (it.durability! > 0) {
          it.durability! -= 0.5 * delta;
          if (it.durability! <= 0) {
            // Depleted
            const id = it.id;
            player.inventory.splice(flItemIndex, 1);
            if (player.equippedLeftId === id) player.equippedLeftId = null;
            if (player.equippedRightId === id) player.equippedRightId = null;
            player.isFlashlightOn = false;
            nextMessage = "BATTERY_DEPLETED";
            nextMessageTimeout = 2.0;
          }
        } else {
          player.isFlashlightOn = false;
        }
      } else {
        player.isFlashlightOn = false;
      }

      let nextEntities = prev.entities.map(e => {
        if (e.type !== Types.EntityType.MONSTER || e.health! <= 0) return e;
        const dP = Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2);

        // Handle Hit Flash Decay
        const nextData = { ...e.data };
        if (nextData.hitFlash > 0) nextData.hitFlash = Math.max(0, nextData.hitFlash - delta);

        const nextE = { ...e, data: nextData };

        if (nextE.data.state === 'IDLE') {
          if (dP < 6.0) nextE.data.state = 'CHASING';
        } else if (nextE.data.state === 'CHASING') {
          if (dP > 10.0) { nextE.data.state = 'RETURNING'; nextE.data.nextTarget = null; }
          else {
            if (time - nextE.data.lastPathUpdate > 500 || !nextE.data.nextTarget) {
              const step = getNextPathStep(nextE.x, nextE.y, player.x, player.y, prev.map);
              if (step) nextE.data.nextTarget = { x: step[0] + 0.5, y: step[1] + 0.5 };
              nextE.data.lastPathUpdate = time;
            }
          }
        } else if (nextE.data.state === 'RETURNING') {
          if (dP < 4.5) nextE.data.state = 'CHASING';
          else if (Math.sqrt((nextE.x - nextE.data.spawnX) ** 2 + (nextE.y - nextE.data.spawnY) ** 2) < 0.2) {
            nextE.data.state = 'IDLE'; nextE.data.nextTarget = null;
          } else {
            if (time - nextE.data.lastPathUpdate > 1000 || !nextE.data.nextTarget) {
              const step = getNextPathStep(nextE.x, nextE.y, nextE.data.spawnX, nextE.data.spawnY, prev.map);
              if (step) nextE.data.nextTarget = { x: step[0] + 0.5, y: step[1] + 0.5 };
              nextE.data.lastPathUpdate = time;
            }
          }
        }

        if (nextE.data.nextTarget && nextE.data.hitFlash <= 0) { // Stun briefly when hit? Maybe not needed, but good for feel
          const ang = Math.atan2(nextE.data.nextTarget.y - nextE.y, nextE.data.nextTarget.x - nextE.x);
          const ms = (nextE.data.state === 'CHASING' ? 2.2 : 1.5) * delta;
          nextE.x += Math.cos(ang) * ms;
          nextE.y += Math.sin(ang) * ms;
        }
        if (dP < 0.6) player.health -= 30 * delta;
        return nextE;
      });

      // No auto-fire anymore, relying on clicks
      // REMOVED OLD GUN/KNIFE LOGIC HERE

      let activeChestId = prev.activeChestId;
      if (keysRef.current['KeyE']) {
        const nearChest = prev.entities.find(e => e.type === Types.EntityType.CHEST && Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2) < 1.6);
        if (nearChest) {
          activeChestId = nearChest.id;
          const chestIndex = nextEntities.findIndex(ce => ce.id === nearChest.id);
          if (chestIndex !== -1) nextEntities[chestIndex].data.isOpen = true;
        }
      } else if (activeChestId) {
        const c = nextEntities.find(e => e.id === activeChestId);
        if (!c || Math.sqrt((c.x - player.x) ** 2 + (c.y - player.y) ** 2) > 1.8) activeChestId = null;
      }

      return {
        ...prev,
        player,
        entities: nextEntities,
        survivalTime: nextSurvivalTime,
        messageTimeout: nextMessageTimeout,
        message: nextMessage,
        activeChestId,
        isGameOver: player.health <= 0,
        deathReason: player.health <= 0 ? "VITAL_SYSTEM_FAILURE" : ""
      };
    });
    frameIdRef.current = requestAnimationFrame(gameLoop);
  }, [screen]);

  useEffect(() => {
    if (screen === 'PLAYING') {
      frameIdRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [gameLoop, screen]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'KeyP' && screen === 'PLAYING') setGameState(s => s ? { ...s, isPaused: !s.isPaused } : null);
      if (e.code === 'KeyF' && screen === 'PLAYING') setGameState(s => {
        if (!s) return null;
        const hasLight = s.player.inventory.some(i => i.type === Types.ItemType.FLASHLIGHT && (i.id === s.player.equippedLeftId || i.id === s.player.equippedRightId));
        return hasLight ? { ...s, player: { ...s.player, isFlashlightOn: !s.player.isFlashlightOn } } : s;
      });
    };
    const up = (e: KeyboardEvent) => keysRef.current[e.code] = false;
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [screen]);

  const draw = useCallback(() => {
    if (!gameState || !canvasRef.current || screen !== 'PLAYING') return;
    const ctx = canvasRef.current.getContext('2d', { alpha: false })!;
    const { player, map, entities } = gameState;
    const s = Constants.CELL_SIZE;
    const ww = window.innerWidth, wh = window.innerHeight;
    canvasRef.current.width = ww; canvasRef.current.height = wh;

    ctx.fillStyle = '#050308'; ctx.fillRect(0, 0, ww, wh);

    ctx.save(); ctx.translate(ww / 2 - player.x * s, wh / 2 - player.y * s);

    const rangeX = 14; const rangeY = 10; // Reduced range slightly for performance with images
    const startX = Math.floor(player.x - rangeX);
    const endX = Math.floor(player.x + rangeX);
    const startY = Math.floor(player.y - rangeY);
    const endY = Math.floor(player.y + rangeY);

    // DRAW FLOOR
    if (floorImgRef.current) {
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
            ctx.drawImage(floorImgRef.current, x * s, y * s, s, s);
          }
        }
      }
    } else {
      ctx.fillStyle = '#09090b'; ctx.fillRect(0, 0, ww, wh); // Fallback
    }

    // PREPARE RENDER LIST FOR Y-SORTING
    interface RenderItem {
      type: 'WALL' | 'ENTITY' | 'PLAYER' | 'PARTICLE' | 'DAMAGE_NUMBER';
      y: number; // sort key (bottom of object)
      draw: () => void;
    }
    const renderList: RenderItem[] = [];

    // Add Walls
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (map[y]?.[x] === 1) {
          renderList.push({
            type: 'WALL',
            y: (y + 1) * s, // Bottom of the wall block
            draw: () => {
              // Draw Wall Face (creates height)
              if (wallFaceImgRef.current) ctx.drawImage(wallFaceImgRef.current, x * s, y * s - 10, s, s + 10);
              else { ctx.fillStyle = '#444'; ctx.fillRect(x * s, y * s, s, s); }

              // Draw Wall Top (shifted up)
              if (wallTopImgRef.current) ctx.drawImage(wallTopImgRef.current, x * s, y * s - s, s, s);
              else { ctx.fillStyle = '#222'; ctx.fillRect(x * s, y * s - s, s, s); }

              // Shadow
              ctx.fillStyle = 'rgba(0,0,0,0.5)';
              ctx.fillRect(x * s, y * s + s - 5, s, 5);
            }
          });
        }
      }
    }

    // Add Damage Numbers
    damageNumbersRef.current.forEach(dn => {
      renderList.push({
        type: 'DAMAGE_NUMBER',
        y: dn.y * s + 100, // Always on top
        draw: () => {
          ctx.save();
          ctx.globalAlpha = dn.life;
          ctx.fillStyle = dn.color;
          ctx.font = 'bold 24px monospace';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          ctx.strokeText(`-${dn.value}`, dn.x * s, dn.y * s);
          ctx.fillText(`-${dn.value}`, dn.x * s, dn.y * s);
          ctx.restore();
        }
      });
    });

    // Add Entities
    entities.forEach(e => {
      if (Math.abs(e.x - player.x) > rangeX || Math.abs(e.y - player.y) > rangeY) return;
      if (!e.type || (e.type === Types.EntityType.MONSTER && e.health! <= 0)) return;

      renderList.push({
        type: 'ENTITY',
        y: e.y * s,
        draw: () => {
          if (e.type === Types.EntityType.CHEST) {
            const size = 32;
            const img = e.data.isOpen ? chestOpenImgRef.current : chestClosedImgRef.current;
            if (img) {
              ctx.drawImage(img, e.x * s - size / 2, e.y * s - size / 2 - 10, size, size);
            } else {
              ctx.fillStyle = e.data.isOpen ? '#3a2601' : '#a16207';
              ctx.fillRect(e.x * s - 14, e.y * s - 14, 28, 28);
            }
          } else if (e.type === Types.EntityType.MONSTER) {
            const size = 50;
            if (monsterImgRef.current) {
              ctx.save();
              // Hit Flash Effect
              if (e.data.hitFlash > 0) {
                // Simple red tint via composite or filter simulation
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = '#ef4444';
                ctx.beginPath(); ctx.arc(e.x * s, e.y * s - 15, size / 2, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1.0;
              }

              // Simple bounce animation for monster
              const bounce = Math.sin(performance.now() * 0.005 + e.x) * 3;
              // Shake if hit
              const shake = e.data.hitFlash > 0 ? (Math.random() - 0.5) * 5 : 0;

              ctx.drawImage(monsterImgRef.current, e.x * s - size / 2 + shake, e.y * s - size / 2 - 15 + bounce, size, size);
              ctx.restore();
            } else {
              ctx.fillStyle = e.data.hitFlash > 0 ? '#ef4444' : '#7f1d1d';
              ctx.beginPath(); ctx.arc(e.x * s, e.y * s, 15, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      });
    });

    // Add Player
    renderList.push({
      type: 'PLAYER',
      y: player.y * s,
      draw: () => {
        const isMoving = !!(keysRef.current['KeyW'] || keysRef.current['KeyS'] || keysRef.current['KeyA'] || keysRef.current['KeyD'] || keysRef.current['ArrowUp'] || keysRef.current['ArrowDown'] || keysRef.current['ArrowLeft'] || keysRef.current['ArrowRight']);
        const bob = isMoving ? Math.sin(performance.now() * 0.015) * 4 : Math.sin(performance.now() * 0.003) * 2;
        const shake = isMoving ? Math.cos(performance.now() * 0.015) * 0.05 : 0;

        if (playerImgRef.current) {
          ctx.save();
          ctx.translate(player.x * s, player.y * s + bob); // Position relative to world, camera translates context
          ctx.rotate(shake);
          const size = 54;
          ctx.drawImage(playerImgRef.current, -size / 2, -size / 2 - 12, size, size);
          ctx.restore();
        } else {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(player.x * s, player.y * s, 12, 0, Math.PI * 2); ctx.fill();
        }
      }
    });

    // Add Particles
    particlesRef.current.forEach(p => {
      renderList.push({
        type: 'PARTICLE',
        y: p.y * s,
        draw: () => {
          const opacity = p.life / p.maxLife;
          ctx.fillStyle = `rgba(150, 140, 130, ${opacity * 0.4})`;
          ctx.beginPath();
          ctx.arc(p.x * s, p.y * s, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // SORT AND DRAW
    renderList.sort((a, b) => a.y - b.y);
    renderList.forEach(item => item.draw());

    ctx.restore();

    // DYNAMIC VISION MASK
    const visionCanvas = document.createElement('canvas');
    visionCanvas.width = ww; visionCanvas.height = wh;
    const vctx = visionCanvas.getContext('2d')!;

    vctx.fillStyle = '#000'; vctx.fillRect(0, 0, ww, wh);
    vctx.globalCompositeOperation = 'destination-out';

    // Vision radius restored to 120 pixels (base) or 450 (flashlight)
    const visionRadius = player.isFlashlightOn ? 450 : 120;
    const grad = vctx.createRadialGradient(ww / 2, wh / 2, 0, ww / 2, wh / 2, visionRadius);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    vctx.fillStyle = grad;
    vctx.fillRect(ww / 2 - visionRadius, wh / 2 - visionRadius, visionRadius * 2, visionRadius * 2);

    ctx.drawImage(visionCanvas, 0, 0);

    if (player.isFlashlightOn) {
      ctx.globalAlpha = 0.04; ctx.fillStyle = '#fff9c4'; ctx.fillRect(0, 0, ww, wh); ctx.globalAlpha = 1.0;
    }
  }, [gameState, screen]);

  useEffect(() => { draw(); }, [draw]);

  const onDragStart = (id: string) => setGameState(s => s ? { ...s, draggingItemId: id } : null);
  const onDrop = (target: 'inv' | 'left' | 'right' | 'consume' | 'chest') => {
    setGameState(s => {
      if (!s || !s.draggingItemId) return s;
      const id = s.draggingItemId, player = { ...s.player };
      const chest = s.entities.find(e => e.id === s.activeChestId);
      const item = player.inventory.find(i => i.id === id) || chest?.data.items.find((i: any) => i.id === id);
      if (!item) return { ...s, draggingItemId: null };

      if (player.inventory.some(i => i.id === id)) {
        if (target === 'chest' && chest) {
          player.inventory = player.inventory.filter(i => i.id !== id);
          if (player.equippedLeftId === id) player.equippedLeftId = null;
          if (player.equippedRightId === id) player.equippedRightId = null;
          chest.data.items.push(item);
        } else if (target === 'left') { player.equippedLeftId = id; if (player.equippedRightId === id) player.equippedRightId = null; }
        else if (target === 'right') { player.equippedRightId = id; if (player.equippedLeftId === id) player.equippedLeftId = null; }
        else if (target === 'inv') { player.equippedLeftId = (player.equippedLeftId === id ? null : player.equippedLeftId); player.equippedRightId = (player.equippedRightId === id ? null : player.equippedRightId); }
        else if (target === 'consume') {
          if (item.type === Types.ItemType.FOOD) player.hunger = Math.min(100, player.hunger + 35);
          if (item.type === Types.ItemType.WATER) player.hydration = Math.min(100, player.hydration + 35);
          player.inventory = player.inventory.filter(i => i.id !== id);
          if (player.equippedLeftId === id) player.equippedLeftId = null;
          if (player.equippedRightId === id) player.equippedRightId = null;
        }
      } else if (chest?.data.items.some((i: any) => i.id === id) && target !== 'chest') {
        chest.data.items = chest.data.items.filter((i: any) => i.id !== id);
        player.inventory.push(item);
        if (target === 'left') player.equippedLeftId = id;
        if (target === 'right') player.equippedRightId = id;
      }
      return { ...s, player, draggingItemId: null };
    });
  };

  const returnToMenu = () => {
    setGameState(null);
    setScreen('MENU');
  };

  if (screen === 'MENU') {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-10 font-mono text-zinc-100">
        <div className="absolute inset-0 bg-blue-900/5 pointer-events-none" />
        <h1 className="text-7xl font-black tracking-widest mb-2 animate-pulse text-zinc-50">VOID_RUNNER</h1>
        <p className="text-zinc-500 mb-16 tracking-[0.5em] text-[10px] uppercase">Labyrinth Survival Simulation v3.2</p>

        <div className="flex flex-col gap-6 w-96 relative z-10">
          <button onClick={() => initGame(false)} className="group relative overflow-hidden px-8 py-5 border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-50 hover:text-black transition-all">
            <div className="flex justify-between items-center font-black uppercase tracking-widest text-sm">
              <span>New Expedition</span>
              <span className="opacity-0 group-hover:opacity-100">{'>>'}</span>
            </div>
          </button>

          {hasSave && (
            <button onClick={() => initGame(true)} className="group relative overflow-hidden px-8 py-5 border-2 border-blue-900 bg-blue-950/20 hover:bg-blue-600 hover:text-white transition-all">
              <div className="flex justify-between items-center font-black uppercase tracking-widest text-sm text-blue-300 group-hover:text-white">
                <span>Resume Mission</span>
                <span>(SAVE_FOUND)</span>
              </div>
            </button>
          )}
        </div>

        <div className="mt-24 flex gap-12 opacity-20 text-[9px] font-bold uppercase tracking-widest">
          <div>Grid_Area: {Constants.MAP_SIZE}^2</div>
          <div>Auth: SECURED</div>
          <div>Core: STABLE</div>
        </div>
      </div>
    );
  }

  if (!gameState) return null;
  const { player } = gameState;
  const eL = player.inventory.find(i => i.id === player.equippedLeftId);
  const eR = player.inventory.find(i => i.id === player.equippedRightId);
  const activeChest = gameState.entities.find(e => e.id === gameState.activeChestId);

  return (
    <div className="relative w-screen h-screen bg-black text-zinc-200 font-mono overflow-hidden select-none" onMouseUp={() => onDrop('inv')}>
      <canvas ref={canvasRef} onClick={handleCanvasClick} className="absolute inset-0 block w-full h-full cursor-crosshair" />

      {/* STATS PANEL */}
      <div className="absolute top-8 left-8 p-6 bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800 rounded-3xl w-72 pointer-events-auto">
        <h2 className="text-[10px] tracking-widest uppercase border-b border-zinc-900 pb-3 mb-5 font-black text-zinc-600">MISSION_MONITOR</h2>
        <div className="space-y-5 text-[10px]">
          {[['VITAL', player.health, '#dc2626'], ['ENERGY', player.hunger, '#16a34a'], ['FLUID', player.hydration, '#2563eb']].map(([label, val, color]) => (
            <div key={label as string} className="space-y-1">
              <div className="flex justify-between font-black uppercase tracking-tighter"><span>{label as string}</span><span>{Math.ceil(val as number)}%</span></div>
              <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5"><div className="h-full transition-all" style={{ width: `${Math.max(0, val as number)}%`, backgroundColor: color as string }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-4 border-t border-zinc-900 flex flex-col gap-3">
          <button onClick={() => setGameState(s => s ? { ...s, isPaused: !s.isPaused } : null)} className={`py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${gameState.isPaused ? 'bg-zinc-100 text-black' : 'bg-zinc-900 hover:bg-zinc-800'}`}>
            {gameState.isPaused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={saveAndExit} className="py-2 bg-blue-900/20 text-blue-400 border border-blue-900/30 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-blue-600 hover:text-white transition-all">
            Save & Exit
          </button>
        </div>
      </div>

      {/* INVENTORY PANEL */}
      <div className="absolute top-8 right-8 p-6 bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800 rounded-3xl w-72 pointer-events-auto flex flex-col max-h-[60vh]">
        <h2 className="text-[10px] tracking-widest uppercase border-b border-zinc-900 pb-3 mb-5 font-black text-zinc-600">CARGO_UNIT</h2>
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {player.inventory.map(it => (
            <div key={it.id} onMouseDown={(e) => { e.stopPropagation(); onDragStart(it.id); }} className={`p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex items-center gap-4 transition-all ${player.equippedLeftId === it.id || player.equippedRightId === it.id ? 'opacity-20' : 'cursor-grab hover:border-zinc-400'}`}>
              <span className="text-3xl">{ITEM_ICONS[it.type]}</span>
              <div className="text-[10px] font-black uppercase text-zinc-400">{it.name} {it.count ? `(${it.count})` : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT/MESSAGE BOX */}
      {gameState.message && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-black/90 px-12 py-5 border border-zinc-800 rounded-3xl text-white text-3xl font-black uppercase tracking-[0.4em] pointer-events-none animate-pulse shadow-2xl z-20">
          {gameState.message}
        </div>
      )}

      {/* CHEST MODAL */}
      {gameState.activeChestId && (
        <div onMouseUp={(e) => { e.stopPropagation(); onDrop('chest'); }} className="absolute left-1/2 top-1/2 -translate-x-full -translate-y-1/2 p-8 bg-zinc-900/95 backdrop-blur-3xl border border-yellow-800/50 rounded-[3rem] w-80 pointer-events-auto mr-16 shadow-2xl z-30">
          <h2 className="text-[11px] tracking-widest uppercase border-b border-zinc-800 pb-4 mb-6 font-bold text-yellow-600">DEPOSITED_CARGO</h2>
          <div className="space-y-4">
            {activeChest?.data.items.map((it: any) => (
              <div key={it.id} onMouseDown={(e) => { e.stopPropagation(); onDragStart(it.id); }} className="p-4 bg-zinc-800 border border-zinc-700 cursor-grab flex items-center gap-5 hover:border-yellow-500 rounded-2xl">
                <span className="text-3xl">{ITEM_ICONS[it.type as Types.ItemType]}</span>
                <div className="text-[11px] font-black uppercase">{it.name}</div>
              </div>
            ))}
            {activeChest?.data.items.length === 0 && <div className="text-zinc-600 text-center py-8 text-[10px] font-bold uppercase tracking-widest">EMPTY_CACHE</div>}
          </div>
        </div>
      )}

      {/* ACTION HUD */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto flex items-end gap-8 bg-black/30 backdrop-blur-xl p-10 rounded-[3.5rem] border border-zinc-900 shadow-2xl">
        {[eL, eR].map((it, i) => (
          <div key={i} onMouseUp={(e) => { e.stopPropagation(); onDrop(i === 0 ? 'left' : 'right'); }} className={`w-36 h-36 border-2 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-2xl relative rounded-[2.5rem] transition-all ${it ? (i === 0 ? 'border-yellow-600/40' : 'border-red-600/40') : 'border-zinc-900 border-dashed'}`}>
            <span className="text-6xl">{it ? ITEM_ICONS[it.type] : ''}</span>
            <span className="text-[9px] text-zinc-600 font-black mt-4 uppercase tracking-tighter">{i === 0 ? 'L_LINK' : 'R_LINK'}</span>
            {it && (
              <div className="absolute top-4 right-4 text-[11px] font-black text-white bg-black/60 px-3 py-0.5 rounded-full border border-white/10">
                {it.type === Types.ItemType.FLASHLIGHT && `${Math.ceil(it.durability!)}%`}
                {it.type === Types.ItemType.KNIFE && `X${Math.ceil(it.durability!)}`}
                {it.type === Types.ItemType.GUN && `${it.count}R`}
              </div>
            )}
          </div>
        ))}
        <div onMouseUp={(e) => { e.stopPropagation(); onDrop('consume'); }} className="w-28 h-28 border border-dashed border-zinc-800 flex flex-col items-center justify-center hover:bg-zinc-900/80 backdrop-blur-2xl rounded-[2.5rem] cursor-pointer transition-all hover:scale-105 active:scale-95 group">
          <span className="text-4xl group-hover:scale-110">💊</span><span className="text-[9px] uppercase font-black mt-4 text-zinc-600">APPLY</span>
        </div>
      </div>

      {gameState.isPaused && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-[100]">
          <h2 className="text-5xl font-black text-white tracking-[1em] mb-12 animate-pulse">SUSPENDED</h2>
          <button onClick={() => setGameState(s => s ? { ...s, isPaused: false } : null)} className="px-16 py-5 bg-white text-black font-black uppercase tracking-[0.3em] hover:scale-110 transition-transform rounded-full">Restore Link</button>
        </div>
      )}

      {gameState.isGameOver && (
        <div className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center text-center p-20">
          <h1 className="text-[12rem] font-black text-red-950 mb-0 flicker uppercase leading-none tracking-tighter">LOST</h1>
          <p className="text-zinc-700 mb-20 italic text-xl tracking-[1em] font-black uppercase">"{gameState.deathReason}"</p>
          <button onClick={returnToMenu} className="px-32 py-10 bg-zinc-100 text-black text-sm hover:bg-white transition-all uppercase font-black tracking-[0.6em] rounded-full active:scale-95 shadow-2xl">RETURN_TO_BASE</button>
        </div>
      )}
    </div>
  );
};

export default App;
