
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
  const [showInventory, setShowInventory] = useState(false);
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

  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);
  const touchCurrentRef = useRef<{ x: number, y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const joystickVecRef = useRef<{ x: number, y: number } | null>(null);
  const isTouchSprintingRef = useRef(false);

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

  // SMART LOOTING LOGIC
  const autoEquip = (player: Types.Player, item: Types.InventoryItem): Types.Player => {
    const p = { ...player };
    // 1. Flashlight -> Prefer Left, then Pocket (Right is for weapons)
    if (item.type === Types.ItemType.FLASHLIGHT) {
      if (!p.equippedLeftId) p.equippedLeftId = item.id;
      else if (!p.equippedPocketId) p.equippedPocketId = item.id;
    }
    // 2. Weapon -> Prefer Right, then Pocket (Left is for utility/light)
    else if (item.type === Types.ItemType.GUN || item.type === Types.ItemType.KNIFE) {
      if (!p.equippedRightId) p.equippedRightId = item.id;
      else if (!p.equippedPocketId) p.equippedPocketId = item.id;
    }
    // 3. Supplies (Food/Water) -> Prefer Pocket
    else if (item.type === Types.ItemType.FOOD || item.type === Types.ItemType.WATER) {
      if (!p.equippedPocketId) p.equippedPocketId = item.id;
    }
    return p;
  };

  const initGame = useCallback((loadExisting = false) => {
    if (loadExisting) {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
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
      player: { x: 1.5, y: 1.5, dir: 0, health: 100, hunger: 100, hydration: 100, isFlashlightOn: false, inventory: [{ id: 'init-f', type: Types.ItemType.FLASHLIGHT, name: 'FLASHLIGHT', durability: 100 }], equippedLeftId: null, equippedRightId: null, equippedPocketId: null, sprinting: false, hitFlash: 0 },
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

  const handleInteraction = (clientX: number, clientY: number) => {
    if (!gameState || gameState.isPaused || gameState.isGameOver) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const s = Constants.CELL_SIZE;
    const ww = window.innerWidth, wh = window.innerHeight;

    const clickX = (clientX - rect.left - ww / 2) / s + gameState.player.x;
    const clickY = (clientY - rect.top - wh / 2) / s + gameState.player.y;

    // Determine active weapon
    const { player } = gameState;
    const weapons = [player.inventory.find(i => i?.id === player.equippedLeftId), player.inventory.find(i => i?.id === player.equippedRightId)].filter(Boolean);
    const gun = weapons.find(i => i?.type === Types.ItemType.GUN);
    const knife = weapons.find(i => i?.type === Types.ItemType.KNIFE);

    let attackMade = false;
    let newEntities = [...gameState.entities];

    // CHECK CHEST INTERACTION FIRST
    const targetChest = newEntities.find(e => e.type === Types.EntityType.CHEST && Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2) < 0.8);
    if (targetChest) {
      const distToPlayer = Math.sqrt((targetChest.x - player.x) ** 2 + (targetChest.y - player.y) ** 2);
      if (distToPlayer < 1.5) {
        setGameState(prev => prev ? { ...prev, activeChestId: targetChest.id } : null);
        return; // Exit if opening chest
      }
    }

    if (gun && (gun.count || 0) > 0) {
      // GUN ATTACK
      attackMade = true;
      setGameState(prev => {
        if (!prev) return null;
        let nextInv = prev.player.inventory.map(i => i.id === gun.id ? { ...i, count: (i.count! - 1) } : i);
        const updatedGun = nextInv.find(i => i.id === gun.id);
        if (updatedGun && updatedGun.count! <= 0) {
          nextInv = nextInv.filter(i => i.id !== gun.id);
          if (prev.player.equippedLeftId === gun.id) prev.player.equippedLeftId = null;
          if (prev.player.equippedRightId === gun.id) prev.player.equippedRightId = null;
        }
        return { ...prev, player: { ...prev.player, inventory: nextInv }, message: 'FIRING_SEQUENCE', messageTimeout: 0.5 };
      });

      newEntities = newEntities.map(e => {
        if (e.type === Types.EntityType.MONSTER && e.health! > 0) {
          const dist = Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2);
          // Allow hit if very close OR if LOS is clear
          const hasLos = isLineOfSightClear(player.x, player.y, e.x, e.y, gameState.map);
          if (dist < 0.8 && (dist < 1.5 || hasLos)) {
            spawnDamageNumber(e.x, e.y - 0.5, 40, '#fbbf24');
            return { ...e, health: e.health! - 40, data: { ...e.data, hitFlash: 0.2, state: 'CHASING' } };
          }
        }
        return e;
      });

    } else if (knife && (knife.durability || 0) > 0) {
      // KNIFE ATTACK
      const targetMonster = newEntities.find(e => e.type === Types.EntityType.MONSTER && e.health! > 0 && Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2) < 0.8);
      if (targetMonster) {
        const distToPlayer = Math.sqrt((targetMonster.x - player.x) ** 2 + (targetMonster.y - player.y) ** 2);
        if (distToPlayer < 2.0) {
          attackMade = true;
          setGameState(prev => {
            if (!prev) return null;
            let nextInv = prev.player.inventory.map(i => i.id === knife.id ? { ...i, durability: (i.durability! - 2) } : i);
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
        }
      }
    }

    if (attackMade) {
      setGameState(prev => prev ? { ...prev, entities: newEntities } : null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Keep click logic for desktop testing, but mobile relies on touchEnd
    handleInteraction(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // e.preventDefault(); // Sometimes creates issues with click passthrough, but safer for moves.
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: performance.now() };
    touchCurrentRef.current = { x: t.clientX, y: t.clientY };
    isDraggingRef.current = false;

    // Double tap check
    if (performance.now() - lastTapTimeRef.current < 300) {
      isTouchSprintingRef.current = true;
    } else {
      isTouchSprintingRef.current = false;
    }
    lastTapTimeRef.current = performance.now();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent scrolling
    // e.preventDefault(); 
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    touchCurrentRef.current = { x: t.clientX, y: t.clientY };
    const dist = Math.sqrt((t.clientX - touchStartRef.current.x) ** 2 + (t.clientY - touchStartRef.current.y) ** 2);
    if (dist > 10) {
      isDraggingRef.current = true;
      // Calc vector
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      joystickVecRef.current = { x: dx, y: dy };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingRef.current && touchStartRef.current) {
      // It was a tap
      handleInteraction(touchStartRef.current.x, touchStartRef.current.y);
    }
    touchStartRef.current = null;
    touchCurrentRef.current = null;
    isDraggingRef.current = false;
    joystickVecRef.current = null;
    isTouchSprintingRef.current = false;
  };

  const gameLoop = useCallback((time: number) => {
    const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05);
    lastTimeRef.current = time;

    particlesRef.current = particlesRef.current
      .map(p => ({
        ...p,
        x: p.x + p.vx * delta,
        y: p.y + p.vy * delta,
        life: p.life - delta
      }))
      .filter(p => p.life > 0);

    damageNumbersRef.current = damageNumbersRef.current
      .map(dn => ({ ...dn, y: dn.y - 0.5 * delta, life: dn.life - delta }))
      .filter(dn => dn.life > 0);

    setGameState(prev => {
      if (!prev || prev.isGameOver || prev.isPaused) return prev;

      const nextSurvivalTime = prev.survivalTime + delta;
      let nextMessageTimeout = prev.messageTimeout > 0 ? prev.messageTimeout - delta : 0;
      let nextMessage = nextMessageTimeout <= 0 ? '' : prev.message;

      const player = { ...prev.player };
      // Sprinting controlled by proper logic combining Shift key and Touch Double Tap
      player.sprinting = (!!keysRef.current['ShiftLeft'] || isTouchSprintingRef.current) && player.hydration > 10;

      const speed = (player.sprinting ? 6.2 : 3.8) * delta;

      let dx = 0, dy = 0;
      // KEYBOARD
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= speed;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += speed;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= speed;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += speed;

      // TOUCH JOYSTICK
      if (joystickVecRef.current) {
        const vec = joystickVecRef.current;
        const angle = Math.atan2(vec.y, vec.x);
        // Normalize speed
        dx = Math.cos(angle) * speed;
        dy = Math.sin(angle) * speed;
      }

      if (dx !== 0 || dy !== 0) {
        player.dir = Math.atan2(dy, dx);
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
      const isMoving = dx !== 0 || dy !== 0;

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

      // Depletion Rates
      // Baseline (Walk): Hunger ~0.08/s, Hydration ~0.12/s
      // Idle: 20%, Run: 200%
      let rateMultiplier = 1.0;
      if (player.sprinting && isMoving) rateMultiplier = 2.0;
      else if (!isMoving) rateMultiplier = 0.2;

      // Need higher base rates for visibility
      // Base: Walk. Idle is 0.2x, Run is 2.0x.
      // 0.5/s means 200s (3min) to starve walking.
      // Idle: 0.1/s (1000s). Run: 1.0/s (100s).
      player.hunger -= 0.5 * delta * rateMultiplier;
      player.hydration -= 0.8 * delta * rateMultiplier;

      if (player.hunger <= 0 || player.hydration <= 0) player.health -= 15 * delta;

      const flItemIndex = player.inventory.findIndex(i => i.type === Types.ItemType.FLASHLIGHT && (i.id === player.equippedLeftId || i.id === player.equippedRightId || i.id === player.equippedPocketId));
      const hasFl = flItemIndex !== -1;

      if (player.isFlashlightOn && hasFl) {
        const it = player.inventory[flItemIndex];
        if (it.durability! > 0) {
          it.durability! -= 0.5 * delta;
          if (it.durability! <= 0) {
            const id = it.id;
            player.inventory.splice(flItemIndex, 1);
            if (player.equippedLeftId === id) player.equippedLeftId = null;
            if (player.equippedRightId === id) player.equippedRightId = null;
            if (player.equippedPocketId === id) player.equippedPocketId = null;
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
          // PATROL LOGIC
          if (!nextE.data.nextTarget || (Math.sqrt((nextE.x - nextE.data.nextTarget.x) ** 2 + (nextE.y - nextE.data.nextTarget.y) ** 2) < 0.2)) {
            // Pick random point near spawn
            if (time - (nextE.data.lastPathUpdate || 0) > 3000) { // Wait a bit before moving again
              const rx = nextE.data.spawnX + (Math.random() - 0.5) * 6;
              const ry = nextE.data.spawnY + (Math.random() - 0.5) * 6;
              const step = getNextPathStep(nextE.x, nextE.y, rx, ry, prev.map);
              if (step) {
                nextE.data.nextTarget = { x: step[0] + 0.5, y: step[1] + 0.5 };
                nextE.data.lastPathUpdate = time;
              }
            }
          }

          // DETECTION LOGIC
          let detected = false;
          // 1. Visual Detection (Line of Sight)
          // Relax LOS if very close (1.5m), essentially "hearing/smelling" range or just proximity
          if (dP < 1.5) {
            detected = true;
          } else if (dP < 10.0 && isLineOfSightClear(player.x, player.y, nextE.x, nextE.y, prev.map)) {
            detected = true;
          }
          // 2. Auditory Detection (Sprinting near monster)
          if (!detected && dP < 6.0 && player.sprinting) {
            detected = true;
          }

          if (detected) {
            nextE.data.state = 'CHASING';
            nextE.data.nextTarget = null; // Reset path to force immediate recalc
          }

        } else if (nextE.data.state === 'CHASING') {
          if (dP > 12.0) { // Lost interest if too far
            nextE.data.state = 'RETURNING';
            nextE.data.nextTarget = null;
          } else {
            // Re-evaluate path to player frequently
            if (time - nextE.data.lastPathUpdate > 250 || !nextE.data.nextTarget) {
              const step = getNextPathStep(nextE.x, nextE.y, player.x, player.y, prev.map);
              if (step) nextE.data.nextTarget = { x: step[0] + 0.5, y: step[1] + 0.5 };
              nextE.data.lastPathUpdate = time;
            }
          }
        } else if (nextE.data.state === 'RETURNING') {
          // Can re-detect during return
          let detected = false;
          if (dP < 10.0 && isLineOfSightClear(player.x, player.y, nextE.x, nextE.y, prev.map)) detected = true;
          if (!detected && dP < 6.0 && player.sprinting) detected = true;

          if (detected) {
            nextE.data.state = 'CHASING';
            nextE.data.nextTarget = null;
          } else if (Math.sqrt((nextE.x - nextE.data.spawnX) ** 2 + (nextE.y - nextE.data.spawnY) ** 2) < 0.2) {
            nextE.data.state = 'IDLE'; nextE.data.nextTarget = null;
          } else {
            if (time - nextE.data.lastPathUpdate > 1000 || !nextE.data.nextTarget) {
              const step = getNextPathStep(nextE.x, nextE.y, nextE.data.spawnX, nextE.data.spawnY, prev.map);
              if (step) nextE.data.nextTarget = { x: step[0] + 0.5, y: step[1] + 0.5 };
              nextE.data.lastPathUpdate = time;
            }
          }
        }

        if (nextE.data.nextTarget && nextE.data.hitFlash <= 0) {
          const ang = Math.atan2(nextE.data.nextTarget.y - nextE.y, nextE.data.nextTarget.x - nextE.x);
          const speed = nextE.data.state === 'CHASING' ? 3.5 : 1.5;
          const ms = speed * delta;

          // Simple collision check for monster vs player (prevents clipping)
          const nextMx = nextE.x + Math.cos(ang) * ms;
          const nextMy = nextE.y + Math.sin(ang) * ms;
          const distToPlayer = Math.sqrt((nextMx - player.x) ** 2 + (nextMy - player.y) ** 2);

          if (distToPlayer > 0.8) { // Only move if not touching player (0.8 buffer)
            nextE.x = nextMx;
            nextE.y = nextMy;
          }
        }

        // Damage Player Logic - CONTINUOUS CONTACT DAMAGE
        // Distance check: < 1.0 means "touching" or very close
        const distFinal = Math.sqrt((nextE.x - player.x) ** 2 + (nextE.y - player.y) ** 2);
        if (distFinal < 1.0) {
          player.health -= 40 * delta; // Increased damage rate for danger
          player.hitFlash = 0.5;
        }
        return nextE;
      });

      // Player Hit Flash Decay
      if (player.hitFlash && player.hitFlash > 0) {
        player.hitFlash = Math.max(0, player.hitFlash - delta * 2);
      }
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
  const eP = player.inventory.find(i => i.id === player.equippedPocketId);

  // Helper to handle item actions from the bar
  const handleSlotAction = (item: Types.InventoryItem | undefined, slot: 'left' | 'right' | 'pocket') => {
    if (!item) return;
    if (item.type === Types.ItemType.FLASHLIGHT) {
      setGameState(prev => {
        if (!prev) return null;
        return { ...prev, player: { ...prev.player, isFlashlightOn: !prev.player.isFlashlightOn } };
      });
    } else if (item.type === Types.ItemType.FOOD || item.type === Types.ItemType.WATER) {
      setGameState(prev => {
        if (!prev) return null;
        const p = { ...prev.player };
        if (item.type === Types.ItemType.FOOD) p.hunger = Math.min(100, p.hunger + 35);
        if (item.type === Types.ItemType.WATER) p.hydration = Math.min(100, p.hydration + 35);

        let nextInv = p.inventory.map(i => i.id === item.id ? { ...i, count: (i.count || 1) - 1 } : i);
        const updated = nextInv.find(i => i.id === item.id);
        if (updated && updated.count! <= 0) {
          nextInv = nextInv.filter(i => i.id !== item.id);
          if (p.equippedLeftId === item.id) p.equippedLeftId = null;
          if (p.equippedRightId === item.id) p.equippedRightId = null;
          if (p.equippedPocketId === item.id) p.equippedPocketId = null;
        }
        return { ...prev, player: { ...p, inventory: nextInv } };
      });
    } else if (item.type === Types.ItemType.GUN) {
      setGameState(prev => prev ? { ...prev, message: 'WEAPON_READY', messageTimeout: 0.5 } : null);
    }
  };

  const handleEquip = (itemId: string, slot: 'left' | 'right' | 'pocket') => {
    setGameState(prev => {
      if (!prev) return null;
      const p = { ...prev.player };
      if (p.equippedLeftId === itemId && slot !== 'left') p.equippedLeftId = null;
      if (p.equippedRightId === itemId && slot !== 'right') p.equippedRightId = null;
      if (p.equippedPocketId === itemId && slot !== 'pocket') p.equippedPocketId = null;

      if (slot === 'left') p.equippedLeftId = itemId;
      if (slot === 'right') p.equippedRightId = itemId;
      if (slot === 'pocket') p.equippedPocketId = itemId;

      return { ...prev, player: p };
    });
    setShowInventory(false);
  };

  return (
    <div className="relative w-screen h-screen bg-black text-zinc-200 font-mono overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-0 block w-full h-full cursor-crosshair touch-none"
      />

      {/* HIT FLASH OVERLAY */}
      <div
        className="absolute inset-0 bg-red-600 pointer-events-none transition-opacity duration-75 z-20"
        style={{ opacity: (gameState?.player.hitFlash || 0) }}
      />

      {/* --- TOP BAR --- */}
      <div className="absolute top-0 left-0 w-full p-4 pt-12 flex items-center justify-between pointer-events-none z-10 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex gap-3 flex-1 items-center px-2">

          {/* HP */}
          <div className="text-red-600 text-[12px] w-4 text-center">♥</div>
          <div className="flex-1 h-3 bg-zinc-900/80 border border-zinc-700 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-300" style={{ width: `${Math.max(0, player.health)}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/50">{Math.floor(player.health)}%</div>
          </div>

          {/* ENERGY (Hunger) */}
          <div className="text-yellow-500 text-[12px] w-4 text-center">⚡</div>
          <div className="flex-1 h-3 bg-zinc-900/80 border border-zinc-700 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-300" style={{ width: `${Math.max(0, player.hunger)}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/50">{Math.floor(player.hunger)}%</div>
          </div>

          {/* WATER (Hydration) */}
          <div className="text-blue-500 text-[12px] w-4 text-center">💧</div>
          <div className="flex-1 h-3 bg-zinc-900/80 border border-zinc-700 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.max(0, player.hydration)}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/50">{Math.floor(player.hydration)}%</div>
          </div>

        </div>

        {/* Menu Button */}
        <button
          onClick={() => setShowInventory(true)}
          className="pointer-events-auto ml-3 p-3 bg-zinc-800/80 border border-zinc-600 rounded-lg text-white active:scale-95 transition-transform"
        >
          <div className="space-y-1">
            <div className="w-5 h-0.5 bg-white"></div>
            <div className="w-5 h-0.5 bg-white"></div>
            <div className="w-5 h-0.5 bg-white"></div>
          </div>
        </button>
      </div>

      {/* --- INVENTORY OVERLAY --- */}
      {showInventory && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-6 pt-16 animate-fade-in pointer-events-auto">
          <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
            <h2 className="text-xl font-bold tracking-widest text-zinc-400">INVENTORY</h2>
            <button onClick={() => setShowInventory(false)} className="px-4 py-2 border border-zinc-600 rounded text-zinc-400">CLOSE</button>
          </div>

          <div className="grid grid-cols-4 gap-4 overflow-y-auto content-start pb-20">
            {player.inventory.map(item => (
              <div key={item.id} className="aspect-square bg-zinc-800/50 border border-zinc-700 rounded-xl p-1 flex flex-col items-center justify-between relative group">
                <div className="text-2xl mt-1">{ITEM_ICONS[item.type]}</div>
                <div className="text-[9px] text-zinc-500 truncate w-full text-center">{item.name}</div>
                {item.count !== undefined && <div className="absolute top-1 right-1 text-[8px] bg-zinc-700 px-1 rounded text-white">{item.count}</div>}

                {/* Equip Overlay */}
                <div onClick={() => {
                  setGameState(prev => {
                    if (!prev) return null;
                    const p = autoEquip(prev.player, item);
                    // If autoEquip didn't assign (full slots), maybe swap active?
                    // For now, autoEquip is smart enough for empty slots.
                    // If strict swap needed:
                    // if item is FLASHLIGHT -> force to left
                    // if item is WEAPON -> force to right
                    // but user asked for "default into...", which autoEquip does.
                    // Let's force it if autoEquip fails or just use a specialized equip logic here.

                    // Force Logic per user request:
                    if (item.type === Types.ItemType.FLASHLIGHT) {
                      p.equippedLeftId = item.id;
                      if (p.equippedPocketId === item.id) p.equippedPocketId = null;
                      if (p.equippedRightId === item.id) p.equippedRightId = null;
                    }
                    else if (item.type === Types.ItemType.GUN || item.type === Types.ItemType.KNIFE) {
                      p.equippedRightId = item.id;
                      if (p.equippedPocketId === item.id) p.equippedPocketId = null;
                      if (p.equippedLeftId === item.id) p.equippedLeftId = null;
                    }
                    else if (item.type === Types.ItemType.FOOD || item.type === Types.ItemType.WATER) {
                      p.equippedPocketId = item.id;
                      if (p.equippedLeftId === item.id) p.equippedLeftId = null;
                      if (p.equippedRightId === item.id) p.equippedRightId = null;
                    }

                    return { ...prev, player: p };
                  });
                  setShowInventory(false);
                }} className="absolute inset-0 bg-transparent z-10 cursor-pointer active:bg-white/10" />

                {/* REMOVED OLD EQUIP BUTTONS */}
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-zinc-800 pt-4 flex flex-col gap-3">
            <button onClick={() => setGameState(s => s ? { ...s, isPaused: !s.isPaused } : null)} className="w-full py-4 bg-zinc-800 text-zinc-300 font-bold rounded-xl uppercase tracking-widest">
              {gameState.isPaused ? 'Resume Game' : 'Pause Game'}
            </button>
            <button onClick={saveAndExit} className="w-full py-4 bg-red-900/20 border border-red-900/50 text-red-500 font-bold rounded-xl uppercase tracking-widest">SAVE & EXIT</button>
          </div>
        </div>
      )}

      {/* --- NOTIFICATIONS --- */}
      {gameState.message && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-3 border border-zinc-700 rounded-full text-white font-bold text-sm tracking-widest pointer-events-none animate-pulse z-20 whitespace-nowrap">
          {gameState.message}
        </div>
      )}

      {/* --- BOTTOM ACTION BAR --- */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg flex gap-4 pointer-events-auto z-10 px-6 items-end">

        {/* LEFT HAND */}
        <button onClick={() => handleSlotAction(eL, 'left')} className={`flex-1 aspect-square bg-zinc-900/90 backdrop-blur-md border-2 ${eL ? 'border-zinc-500' : 'border-zinc-800'} rounded-[1.5rem] flex flex-col items-center justify-center relative active:scale-95 transition-all shadow-lg`}>
          <div className="text-[9px] absolute top-2 text-zinc-500 font-bold tracking-widest uppercase">Left</div>
          {eL ? (
            <>
              <div className="text-4xl pb-2">{ITEM_ICONS[eL.type]}</div>
              <div className="absolute bottom-2 left-0 w-full flex justify-center">
                <div className="text-[9px] text-zinc-400 font-bold bg-zinc-950/50 px-2 rounded mb-1">{eL.name}</div>
              </div>
              {/* DURABILITY/AMMO DISPLAY */}
              {eL.durability !== undefined && (
                <div className="absolute top-2 right-2 text-[8px] font-mono text-cyan-400">{Math.ceil(eL.durability)}%</div>
              )}
              {eL.count !== undefined && (
                <div className="absolute top-2 right-2 text-[8px] font-mono text-yellow-400">x{eL.count}</div>
              )}
            </>
          ) : <div className="text-zinc-700 text-2xl">✋</div>}
        </button>

        {/* POCKET */}
        <button onClick={() => handleSlotAction(eP, 'pocket')} className={`flex-1 aspect-square bg-zinc-900/90 backdrop-blur-md border-2 ${eP ? 'border-blue-500/50' : 'border-zinc-800'} rounded-[1.5rem] flex flex-col items-center justify-center relative active:scale-95 transition-all shadow-lg`}>
          <div className="text-[9px] absolute top-2 text-zinc-500 font-bold tracking-widest uppercase">Pocket</div>
          {eP ? (
            <>
              <div className="text-4xl pb-2">{ITEM_ICONS[eP.type]}</div>
              <div className="absolute bottom-2 left-0 w-full flex justify-center">
                <div className="text-[9px] text-zinc-400 font-bold bg-zinc-950/50 px-2 rounded mb-1">{eP.name}</div>
              </div>
              {eP.type === Types.ItemType.FLASHLIGHT && player.isFlashlightOn && <div className="absolute inset-0 bg-yellow-500/10 animate-pulse pointer-events-none rounded-[1.5rem] border border-yellow-500/30" />}
              {/* DURABILITY/AMMO DISPLAY */}
              {eP.count !== undefined && (
                <div className="absolute top-2 right-2 text-[8px] font-mono text-yellow-400">x{eP.count}</div>
              )}
            </>
          ) : <div className="text-zinc-700 text-2xl">🎒</div>}
        </button>

        {/* RIGHT HAND */}
        <button onClick={() => handleSlotAction(eR, 'right')} className={`flex-1 aspect-square bg-red-950/20 backdrop-blur-md border-2 ${eR ? 'border-red-600' : 'border-red-900/30'} rounded-[1.5rem] flex flex-col items-center justify-center relative active:scale-95 transition-all shadow-lg`}>
          <div className="text-[9px] absolute top-2 text-red-500/50 font-bold tracking-widest uppercase">Attack</div>
          {eR ? (
            <>
              <div className="text-4xl pb-2">{ITEM_ICONS[eR.type]}</div>
              <div className="absolute bottom-2 left-0 w-full flex justify-center">
                <div className="text-[9px] text-red-400 font-bold bg-black/40 px-2 rounded border border-red-900/30 mb-1">{eR.name}</div>
              </div>
              {/* DURABILITY/AMMO DISPLAY */}
              {eR.durability !== undefined && (
                <div className="absolute top-2 right-2 text-[8px] font-mono text-cyan-400">{Math.ceil(eR.durability)}%</div>
              )}
              {eR.count !== undefined && (
                <div className="absolute top-2 right-2 text-[8px] font-mono text-yellow-400">x{eR.count}</div>
              )}
            </>
          ) : <div className="text-zinc-700 text-2xl">⚔️</div>}
        </button>

      </div>

      {/* CHEST MODAL (Mobile Style) */}
      {gameState.activeChestId && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4">
          <div className="bg-zinc-900 border border-yellow-700/50 p-6 rounded-3xl w-full max-w-sm shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-yellow-500 font-bold uppercase tracking-widest text-lg">Chest Content</h2>
              <button className="text-[10px] items-center justify-center bg-yellow-900/20 text-yellow-500 border border-yellow-700/50 px-3 py-1 rounded-full uppercase font-bold tracking-wider active:scale-95" onClick={() => {
                // LOOT ALL
                setGameState(s => {
                  if (!s) return null;
                  const chest = s.entities.find(e => e.id === s.activeChestId);
                  if (!chest) return s;
                  let p = { ...s.player };

                  chest.data.items.forEach((item: any) => {
                    p.inventory.push(item);
                    p = autoEquip(p, item);
                  });
                  chest.data.items = [];
                  return { ...s, player: p, activeChestId: null };
                });
              }}>Loot All</button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4 overflow-y-auto p-2">
              {gameState.entities.find(e => e.id === gameState.activeChestId)?.data.items.map((it: any) => (
                <button key={it.id} onClick={() => {
                  // Loot item
                  setGameState(s => {
                    if (!s) return null;
                    const chest = s.entities.find(e => e.id === s.activeChestId);
                    if (!chest) return s;
                    const item = chest.data.items.find((i: any) => i.id === it.id);
                    if (!item) return s;

                    // Add to player
                    let p = { ...s.player };
                    p.inventory.push(item);
                    p = autoEquip(p, item);

                    chest.data.items = chest.data.items.filter((i: any) => i.id !== it.id);

                    return { ...s, player: p };
                  });
                }} className="aspect-square bg-black border border-yellow-900/30 rounded-xl flex items-center justify-center text-2xl hover:bg-yellow-900/20 active:scale-95 transition-transform">
                  {ITEM_ICONS[it.type as Types.ItemType]}
                </button>
              ))}
            </div>
            <button onClick={() => setGameState(s => s ? { ...s, activeChestId: null } : null)} className="mt-auto w-full py-4 bg-zinc-800 rounded-xl text-zinc-400 font-bold uppercase tracking-widest">CLOSE</button>
          </div>
        </div>
      )}

      {gameState.isPaused && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-[100]">
          <h2 className="text-4xl font-black text-white tracking-[0.5em] mb-12 animate-pulse">PAUSED</h2>
          <button onClick={() => setGameState(s => s ? { ...s, isPaused: false } : null)} className="px-12 py-4 bg-white text-black font-black uppercase tracking-[0.2em] rounded-full active:scale-95 transition-transform">RESUME</button>
        </div>
      )}

      {gameState.isGameOver && (
        <div className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center text-center p-10">
          <h1 className="text-8xl font-black text-red-600 mb-4 flicker uppercase leading-none tracking-tighter">DIED</h1>
          <p className="text-zinc-500 mb-16 italic text-sm tracking-[0.5em] font-bold uppercase">"{gameState.deathReason}"</p>
          <button onClick={returnToMenu} className="px-12 py-4 bg-zinc-800 border border-zinc-700 text-white text-xs hover:bg-zinc-700 transition-all uppercase font-black tracking-[0.3em] rounded-lg active:scale-95">RESTART MISSION</button>
        </div>
      )}

    </div>
  );
};

export default App;
