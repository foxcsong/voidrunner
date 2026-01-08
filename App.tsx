
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Types from './types';
import * as Constants from './constants';
import * as MazeGen from './engine/MazeGen';
import { getAtmosphericMessage, generateLayout } from './services/geminiService';
import { supabase } from './services/supabase';
import { AuthForm } from './components/AuthForm';

const ITEM_ICONS: Record<Types.ItemType, string> = {
  [Types.ItemType.FOOD]: '🍞',
  [Types.ItemType.WATER]: '💧',
  [Types.ItemType.FLASHLIGHT]: '🔦',
  [Types.ItemType.KNIFE]: '🔪',
  [Types.ItemType.GUN]: '🔫',
  [Types.ItemType.AMMO]: '🔋',
  [Types.ItemType.BATTERY]: '🪫',
  [Types.ItemType.KEY]: '🔑',
};

const ITEM_NAMES: Record<Types.ItemType, string> = {
  [Types.ItemType.FOOD]: '食物',
  [Types.ItemType.WATER]: '饮用水',
  [Types.ItemType.FLASHLIGHT]: '手电筒',
  [Types.ItemType.KNIFE]: '战术匕首',
  [Types.ItemType.GUN]: '手枪',
  [Types.ItemType.AMMO]: '备用弹夹',
  [Types.ItemType.BATTERY]: '高能电池',
  [Types.ItemType.KEY]: '虚空钥匙',
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

type Screen = 'MENU' | 'PLAYING' | 'LOADING_AI';

const FallingVoid: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [textIndex, setTextIndex] = useState(0);
  const narrative = [
    "笔尖在草稿纸上沙沙作响，那道复杂的几何题终于快要解开了……",
    "可就在我落笔的一瞬，灯火骤灭，世界像被墨水吞噬。",
    "我感觉双脚踏空，身体毫无防备地坠入冰冷的虚空。",
    "我在哪里？为什么……呼吸变得如此沉重？"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTextIndex(prev => (prev < narrative.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-10 overflow-hidden">
      {/* Falling Particles Background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white/20 w-[1px] h-[50px]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10%`,
              animation: `fall ${1 + Math.random() * 2}s linear infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-2xl text-center space-y-8">
        <div className="text-zinc-400 text-lg leading-relaxed animate-pulse">
          {narrative[textIndex]}
        </div>
        <div className="flex justify-center gap-2">
          {narrative.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-1000 ${i <= textIndex ? 'w-8 bg-zinc-200' : 'w-2 bg-zinc-800'}`} />
          ))}
        </div>
        <div className="pt-10 text-zinc-600 text-[10px] tracking-[0.2em] animate-pulse">
          INITIALIZING_NEURAL_LINK...
        </div>
      </div>

      {/* SKIP BUTTON */}
      <button
        onClick={onComplete}
        className="absolute bottom-10 right-10 text-zinc-600 text-xs uppercase tracking-widest hover:text-white transition-colors border border-zinc-800 px-4 py-2 rounded hover:border-zinc-500"
      >
        [ 跳过剧情 ]
      </button>

      <style>{`
        @keyframes fall {
          to { transform: translateY(120vh); }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('MENU');
  const [hasSave, setHasSave] = useState(false);
  const [gameState, setGameState] = useState<Types.GameState | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastTimeRef = useRef<number>(performance.now());
  const lastShotTimeRef = useRef<number>(0);
  const frameIdRef = useRef<number>(0);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Asset Refs
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const playerKnifeImgRef = useRef<HTMLImageElement | null>(null);
  const playerShootImgRef = useRef<HTMLImageElement | null>(null);
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
  const lastAIEventTimeRef = useRef<number>(0);

  const triggerAIEvent = useCallback(async (eventDescription: string) => {
    const now = Date.now();
    if (now - lastAIEventTimeRef.current < 8000) return; // 8s cooldown to avoid noise
    lastAIEventTimeRef.current = now;

    try {
      const msg = await getAtmosphericMessage(eventDescription);
      setGameState(prev => prev ? { ...prev, message: msg, messageTimeout: 5 } : null);
    } catch (e) {
      console.error("AI Event trigger failed:", e);
    }
  }, []);

  useEffect(() => {
    const save = localStorage.getItem(SAVE_KEY);
    setHasSave(!!save);

    const loadImg = (src: string, ref: React.MutableRefObject<HTMLImageElement | null>) => {
      const img = new Image();
      img.src = src;
      img.onload = () => { ref.current = img; };
    };

    loadImg('/assets/player.png', playerImgRef);
    loadImg('/assets/player_knife.png', playerKnifeImgRef);
    loadImg('/assets/player_shoot.png', playerShootImgRef);
    loadImg('/assets/monster.png', monsterImgRef);
    loadImg('/assets/wall_top.png', wallTopImgRef);
    loadImg('/assets/wall_face.png', wallFaceImgRef);
    loadImg('/assets/floor.png', floorImgRef);
    loadImg('/assets/chest_closed.png', chestClosedImgRef);
    loadImg('/assets/chest_open.png', chestOpenImgRef);

    // Check Auth Status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
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

  const initGame = useCallback(async (loadExisting = false) => {
    if (loadExisting) {
      let stateToLoad: any = null;

      // 1. Try Cloud Load first if logged in
      if (currentUser) {
        const { data, error } = await supabase
          .from('game_saves')
          .select('save_data')
          .eq('user_id', currentUser.id)
          .single();

        if (data && data.save_data) {
          stateToLoad = data.save_data;
          console.log("Loaded save from Cloud");
        }
      }

      // 2. Fallback to LocalStorage
      if (!stateToLoad) {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) stateToLoad = JSON.parse(saved);
      }

      if (stateToLoad) {
        stateToLoad.entities.forEach((e: any) => {
          if (e.data) { e.data.hitFlash = 0; }
        });
        setGameState(stateToLoad);
        setScreen('PLAYING');
        return;
      }
    }

    localStorage.removeItem(SAVE_KEY);
    setScreen('LOADING_AI');

    // Step 1: Generate Maze
    const map = MazeGen.generateMaze(Constants.MAP_SIZE);
    const deadEnds = MazeGen.findDeadEnds(map);

    // Step 2: Skip AI Layout, go straight to procedural with improved weighting
    const entities: Types.Entity[] = [];

    // Add Starter Chest
    entities.push({
      id: 'starter-chest', x: 1.5, y: 1.5, type: Types.EntityType.CHEST,
      data: {
        isOpen: false,
        items: [
          { id: 'start-knife', type: Types.ItemType.KNIFE, name: ITEM_NAMES[Types.ItemType.KNIFE], durability: 100 },
          { id: 'start-water', type: Types.ItemType.WATER, name: ITEM_NAMES[Types.ItemType.WATER], count: 1 },
          { id: 'start-fl', type: Types.ItemType.FLASHLIGHT, name: ITEM_NAMES[Types.ItemType.FLASHLIGHT], durability: 100 }
        ]
      }
    });

    // Find the furthest dead end for the EXIT
    let exitPos = { x: Constants.MAP_SIZE - 2, y: Constants.MAP_SIZE - 2 };
    let maxDist = 0;
    deadEnds.forEach(pos => {
      const dist = Math.sqrt((pos.x - 1.5) ** 2 + (pos.y - 1.5) ** 2);
      if (dist > maxDist) {
        maxDist = dist;
        exitPos = pos;
      }
    });

    // Strategy: Assign one gun to a dead end between 6 and 15 distance
    let gunSpawned = false;
    const startX = 1.5, startY = 1.5;

    // Shuffle deadEnds for random distribution
    const shuffledDeadEnds = [...deadEnds].sort(() => Math.random() - 0.5);

    shuffledDeadEnds.forEach((pos, i) => {
      // Avoid start area and exit
      if (pos.x <= 4 && pos.y <= 4) return;
      if (pos.x === exitPos.x && pos.y === exitPos.y) return;

      const dist = Math.sqrt((pos.x - startX) ** 2 + (pos.y - startY) ** 2);

      // Determine entity type: Chest or Monster
      // High probability of chest in dead ends
      const entityType = Math.random() > 0.3 ? Types.EntityType.CHEST : Types.EntityType.MONSTER;
      const items: Types.InventoryItem[] = [];

      if (entityType === Types.EntityType.CHEST) {
        const itemCount = Math.floor(Math.random() * 2) + 1;
        for (let j = 0; j < itemCount; j++) {
          let itType = [Types.ItemType.FOOD, Types.ItemType.WATER, Types.ItemType.KNIFE, Types.ItemType.AMMO, Types.ItemType.BATTERY][Math.floor(Math.random() * 5)];

          // Force gun placement
          if (!gunSpawned && dist >= 6 && dist <= 15) {
            itType = Types.ItemType.GUN;
            gunSpawned = true;
          }

          items.push({
            id: `it-${i}-${j}`,
            type: itType,
            name: ITEM_NAMES[itType],
            durability: (itType === Types.ItemType.KNIFE) ? 100 : undefined,
            count: itType === Types.ItemType.GUN ? 12 : (itType === Types.ItemType.FOOD || itType === Types.ItemType.WATER || itType === Types.ItemType.AMMO || itType === Types.ItemType.BATTERY ? 1 : undefined)
          });
        }
      }

      entities.push({
        id: `e-${i}`,
        x: pos.x + 0.5,
        y: pos.y + 0.5,
        type: entityType,
        health: 75,
        data: entityType === Types.EntityType.CHEST ? { items, isOpen: false } : {
          nextTarget: null, lastPathUpdate: 0, spawnX: pos.x + 0.5, spawnY: pos.y + 0.5, state: 'IDLE', hitFlash: 0
        }
      });
    });

    // If gun still hasn't spawned (no dead ends in range), force it in a generic chest or monster spot
    if (!gunSpawned) {
      const fallbackPos = shuffledDeadEnds.find(p => Math.sqrt((p.x - startX) ** 2 + (p.y - startY) ** 2) > 5) || exitPos;
      const targetEntity = entities.find(e => e.x === fallbackPos.x + 0.5 && e.y === fallbackPos.y + 0.5);
      if (targetEntity && targetEntity.type === Types.EntityType.CHEST) {
        targetEntity.data.items.push({ id: 'force-gun', type: Types.ItemType.GUN, name: ITEM_NAMES[Types.ItemType.GUN], count: 12 });
      } else {
        entities.push({
          id: 'force-gun-chest', x: fallbackPos.x + 0.5, y: fallbackPos.y + 0.5, type: Types.EntityType.CHEST,
          data: { isOpen: false, items: [{ id: 'force-gun', type: Types.ItemType.GUN, name: ITEM_NAMES[Types.ItemType.GUN], count: 12 }] }
        });
      }
    }

    // Add extra monsters in corridors (not just dead ends)
    for (let k = 0; k < 10; k++) {
      const rx = Math.floor(Math.random() * Constants.MAP_SIZE);
      const ry = Math.floor(Math.random() * Constants.MAP_SIZE);
      if (map[ry][rx] === 0 && Math.sqrt((rx - startX) ** 2 + (ry - startY) ** 2) > 8) {
        entities.push({
          id: `monster-walk-${k}`, x: rx + 0.5, y: ry + 0.5, type: Types.EntityType.MONSTER, health: 75,
          data: { nextTarget: null, lastPathUpdate: 0, spawnX: rx + 0.5, spawnY: ry + 0.5, state: 'IDLE', hitFlash: 0 }
        });
      }
    }

    // Add EXIT_GATE at exit position
    entities.push({
      id: 'exit-gate',
      x: exitPos.x + 0.5,
      y: exitPos.y + 0.5,
      type: Types.EntityType.EXIT_GATE,
      data: { isLocked: true }
    });

    // DISTRIBUTE KEYS
    // 1. Two keys in two random chests
    const chests = entities.filter(e => e.type === Types.EntityType.CHEST && e.id !== 'starter-chest');
    const shuffledChests = chests.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(2, shuffledChests.length); i++) {
      shuffledChests[i].data.items.push({
        id: `key-chest-${i}`,
        type: Types.ItemType.KEY,
        name: ITEM_NAMES[Types.ItemType.KEY]
      });
    }

    // 2. One key in a random monster
    const monsters = entities.filter(e => e.type === Types.EntityType.MONSTER);
    const randomMonster = monsters[Math.floor(Math.random() * monsters.length)];
    if (randomMonster) {
      randomMonster.data.hasKey = true;
    }

    setGameState({
      player: { x: 1.5, y: 1.5, dir: 0, health: 100, hunger: 100, hydration: 100, isFlashlightOn: false, inventory: [], equippedLeftId: null, equippedRightId: null, equippedPocketId: null, sprinting: false, hitFlash: 0 },
      map, entities, isGameOver: false, isVictory: false, exitX: exitPos.x + 0.5, exitY: exitPos.y + 0.5, deathReason: '', message: '发现近处有补给箱，请上前打开获取生存物资。', messageTimeout: 10, chaseActive: false, survivalTime: 0, isPaused: false, activeChestId: null, draggingItemId: null
    });

    // Narrative transition
    loadingTimeoutRef.current = setTimeout(() => {
      setScreen('PLAYING');
      damageNumbersRef.current = [];
    }, 14000);
  }, [triggerAIEvent]);

  const saveAndExit = async () => {
    if (gameState) {
      const saveData = { ...gameState, isPaused: false };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));

      // Cloud Save
      if (currentUser) {
        const { error } = await supabase
          .from('game_saves')
          .upsert({
            user_id: currentUser.id,
            save_data: saveData,
            updated_at: new Date().toISOString()
          });
        if (error) console.error("Cloud Save Failed:", error);
        else console.log("Cloud Save Synced");
      }

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

    // CHECK EXIT_GATE INTERACTION
    const targetGate = newEntities.find(e => e.type === Types.EntityType.EXIT_GATE && Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2) < 0.8);
    if (targetGate) {
      const distToPlayer = Math.sqrt((targetGate.x - player.x) ** 2 + (targetGate.y - player.y) ** 2);
      if (distToPlayer < 1.5) {
        const keyCount = player.inventory.filter(i => i.type === Types.ItemType.KEY).length;
        if (keyCount >= 3) {
          setGameState(prev => {
            if (!prev) return null;
            // Remove 3 keys
            let removedCount = 0;
            const nextInv = prev.player.inventory.filter(i => {
              if (i.type === Types.ItemType.KEY && removedCount < 3) {
                removedCount++;
                return false;
              }
              return true;
            });
            // Remove the gate entity
            const nextEntities = prev.entities.filter(e => e.id !== targetGate.id);
            return {
              ...prev,
              player: { ...prev.player, inventory: nextInv },
              entities: nextEntities,
              message: '出口已解锁！虚空在召唤...',
              messageTimeout: 5
            };
          });
        } else {
          setGameState(prev => prev ? {
            ...prev,
            message: `只有集齐 3 把虚空钥匙，才能开启最后的门户。目前进度: ${keyCount}/3`,
            messageTimeout: 5
          } : null);
        }
        return;
      }
    }

    // CHECK CHEST INTERACTION NEXT
    const targetChest = newEntities.find(e => e.type === Types.EntityType.CHEST && Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2) < 0.8);
    if (targetChest) {
      const distToPlayer = Math.sqrt((targetChest.x - player.x) ** 2 + (targetChest.y - player.y) ** 2);
      if (distToPlayer < 1.5) {
        setGameState(prev => prev ? { ...prev, activeChestId: targetChest.id } : null);
        if (targetChest.id === 'starter-chest') {
          setGameState(prev => prev ? {
            ...prev,
            message: '提示：点击箱中物资拿取。注意匕首耐久度及生存状态，极致饥饿或脱水将损耗生命！',
            messageTimeout: 8
          } : null);
        } else {
          triggerAIEvent("我发现了一个补给箱，在这个地狱里，这代表着暂时的生存希望...");
        }
        return;
      }
    }

    if (gun) {
      // GUN ATTACK - Requires ammo
      if ((gun.count || 0) <= 0) {
        setGameState(prev => prev ? { ...prev, message: '弹药耗尽，请点击弹夹重装', messageTimeout: 2 } : null);
        return;
      }

      attackMade = true;
      setGameState(prev => {
        if (!prev) return null;
        const nextInv = prev.player.inventory.map(i => i.id === gun.id ? { ...i, count: Math.max(0, i.count! - 1) } : i);
        return {
          ...prev,
          player: { ...prev.player, inventory: nextInv, actionState: 'ATTACK_GUN', actionTimer: 0.2 },
          message: '武器开火',
          messageTimeout: 0.5
        };
      });

      newEntities = newEntities.map(e => {
        if (e.type === Types.EntityType.MONSTER && e.health! > 0) {
          const dist = Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2);
          const hasLos = isLineOfSightClear(player.x, player.y, e.x, e.y, gameState.map);
          if (dist < 0.8 && hasLos) {
            spawnDamageNumber(e.x, e.y - 0.5, 40, '#fbbf24');
            return { ...e, health: e.health! - 40, data: { ...e.data, hitFlash: 0.2, state: 'CHASING' } };
          }
        }
        return e;
      });

    } else if (knife) {
      // KNIFE ATTACK - Requires durability
      if ((knife.durability || 0) <= 0) {
        setGameState(prev => prev ? { ...prev, message: '匕首已损坏', messageTimeout: 2 } : null);
        return;
      }

      const targetMonster = newEntities.find(e => e.type === Types.EntityType.MONSTER && e.health! > 0 && Math.sqrt((e.x - clickX) ** 2 + (e.y - clickY) ** 2) < 0.8);
      if (targetMonster) {
        const distToPlayer = Math.sqrt((targetMonster.x - player.x) ** 2 + (targetMonster.y - player.y) ** 2);
        const hasLos = isLineOfSightClear(player.x, player.y, targetMonster.x, targetMonster.y, gameState.map);
        if (distToPlayer < 2.0 && hasLos) {
          attackMade = true;
          setGameState(prev => {
            if (!prev) return null;
            let nextInv = prev.player.inventory.map(i => i.id === knife.id ? { ...i, durability: Math.max(0, i.durability! - 2) } : i);
            const updatedKnife = nextInv.find(i => i.id === knife.id);
            if (updatedKnife && updatedKnife.durability! <= 0) {
              nextInv = nextInv.filter(i => i.id !== knife.id);
              if (prev.player.equippedLeftId === knife.id) prev.player.equippedLeftId = null;
              if (prev.player.equippedRightId === knife.id) prev.player.equippedRightId = null;
            }
            return {
              ...prev,
              player: { ...prev.player, inventory: nextInv, actionState: 'ATTACK_KNIFE', actionTimer: 0.2 },
              message: '近战格斗',
              messageTimeout: 0.5
            };
          });
          newEntities = newEntities.map(e => e.id === targetMonster.id ? { ...e, health: e.health! - 25, data: { ...e.data, hitFlash: 0.2, state: 'CHASING' } } : e);
          spawnDamageNumber(targetMonster.x, targetMonster.y - 0.5, 25, '#ffffff');
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
    e.preventDefault();
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
    if (e.cancelable) e.preventDefault();
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
      if (!prev || prev.isGameOver || prev.isVictory || prev.isPaused) return prev;

      const nextSurvivalTime = prev.survivalTime + delta;
      let nextMessageTimeout = prev.messageTimeout > 0 ? prev.messageTimeout - delta : 0;
      let nextMessage = nextMessageTimeout <= 0 ? '' : prev.message;

      const player = { ...prev.player };

      // Update Action Timer
      if (player.actionTimer && player.actionTimer > 0) {
        player.actionTimer -= delta;
        if (player.actionTimer <= 0) {
          player.actionState = 'IDLE';
          player.actionTimer = 0;
        }
      }

      // Sprinting: Supports Shift (Left/Right) AND Touch Double Tap
      const isShiftHeld = !!keysRef.current['ShiftLeft'] || !!keysRef.current['ShiftRight'];
      player.sprinting = (isShiftHeld || isTouchSprintingRef.current) && player.hydration > 10;

      const speed = (player.sprinting ? 6.2 : 3.8) * delta;

      let dx = 0, dy = 0;
      // ... (omitting strict match to avoid block size issues, will match surrounding unique lines)
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
        if (prev.map[my][mx] === 1) return true;

        // Add EXIT_GATE collision
        const gate = prev.entities.find(e => e.type === Types.EntityType.EXIT_GATE);
        if (gate) {
          const dist = Math.sqrt((tx - gate.x) ** 2 + (ty - gate.y) ** 2);
          if (dist < 0.8) return true;
        }
        return false;
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
      // Depletion Rates Reduced by 50% per user request:
      // Hunger: 0.5 -> 0.25, Hydration: 0.8 -> 0.4
      player.hunger -= 0.25 * delta * rateMultiplier;
      player.hydration -= 0.4 * delta * rateMultiplier;

      if (player.hunger <= 0 || player.hydration <= 0) player.health -= 15 * delta;

      const flItemIndex = player.inventory.findIndex(i => i.type === Types.ItemType.FLASHLIGHT && (i.id === player.equippedLeftId || i.id === player.equippedRightId || i.id === player.equippedPocketId));
      const hasFl = flItemIndex !== -1;

      if (player.isFlashlightOn && hasFl) {
        const it = player.inventory[flItemIndex];
        if (it.durability! > 0) {
          it.durability! -= 0.5 * delta;
          if (it.durability! <= 0) {
            player.isFlashlightOn = false;
            triggerAIEvent("最后的一丝光亮也消失了，我在黑暗中彻底变成了一件猎物……");
            setGameState(prev => prev ? { ...prev, message: '电量耗尽，请使用电池', messageTimeout: 3 } : null);
          }
        } else {
          player.isFlashlightOn = false;
        }
      } else {
        player.isFlashlightOn = false;
      }

      // 10. AI TRIGGERS for LOW STATS
      if (player.health < 25) triggerAIEvent("我感觉生命在流逝，视线开始变得模糊，呼吸变得沉重……");
      else if (player.hunger < 15) triggerAIEvent("胃部传来的剧痛在提醒我，如果再找不到食物，我就要被饿死了……");
      else if (player.hydration < 15) triggerAIEvent("嗓子干得像着了火，我需要水，哪怕只有一滴……");

      let nextEntities = prev.entities.map(e => {
        if (e.type !== Types.EntityType.MONSTER || e.health! <= 0) return e;
        const dP = Math.sqrt((e.x - player.x) ** 2 + (e.y - player.y) ** 2);

        // Handle Hit Flash Decay
        const nextData = { ...e.data };
        if (nextData.hitFlash > 0) nextData.hitFlash = Math.max(0, nextData.hitFlash - delta);

        const nextE = { ...e, data: nextData };

        if (nextE.data.state === 'IDLE') {
          // ... existing logic ...
        }

        // MONSTER DEATH -> KEY DROP
        if (nextE.health! <= 0) {
          if (nextE.data.hasKey) {
            // Transform into a chest containing the key
            return {
              ...nextE,
              type: Types.EntityType.CHEST,
              health: undefined,
              data: {
                isOpen: false,
                items: [{
                  id: `key-drop-${nextE.id}`,
                  type: Types.ItemType.KEY,
                  name: ITEM_NAMES[Types.ItemType.KEY]
                }]
              }
            };
          }
          // Normal monster death (remains for sorting but logic skipped)
          return nextE;
        }

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
          // Relax LOS if very close (2.0m), essentially "hearing/smelling" range or just proximity
          if (dP < 2.0) {
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
            // DIRECT TRACKING: If close and LOS clear, target player center
            if (dP < 3.0 && isLineOfSightClear(player.x, player.y, nextE.x, nextE.y, prev.map)) {
              nextE.data.nextTarget = { x: player.x, y: player.y };
            } else {
              // Re-evaluate path to player frequently
              if (time - nextE.data.lastPathUpdate > 250 || !nextE.data.nextTarget) {
                const step = getNextPathStep(nextE.x, nextE.y, player.x, player.y, prev.map);
                if (step) nextE.data.nextTarget = { x: step[0] + 0.5, y: step[1] + 0.5 };
                nextE.data.lastPathUpdate = time;
              }
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

          if (distToPlayer > 0.4) { // Tighter buffer (0.6 -> 0.4) for closer contact
            nextE.x = nextMx;
            nextE.y = nextMy;
          }
        }

        // Damage Player Logic - CONTINUOUS CONTACT DAMAGE
        // Distance check: < 1.5 means "touching" or sufficiently close
        const distFinal = Math.sqrt((nextE.x - player.x) ** 2 + (nextE.y - player.y) ** 2);
        if (distFinal < 1.5) {
          player.health -= 40 * delta; // Constant damage while touching
          player.hitFlash = 0.5;
        }
        return nextE;
      });

      // 11. CHASE ACTIVE TRACKING & AI TRIGGER
      const chaseActive = nextEntities.some(e => e.type === Types.EntityType.MONSTER && e.data.state === 'CHASING');
      if (!prev.chaseActive && chaseActive) {
        triggerAIEvent("那种令人毛骨悚然的直觉来了……有什么东西盯上我了……他在靠近……");
      }

      // Player Hit Flash Decay
      if (player.hitFlash && player.hitFlash > 0) {
        player.hitFlash = Math.max(0, player.hitFlash - delta * 2);
      }
      // REMOVED OLD GUN/KNIFE LOGIC HERE

      let activeChestId = prev.activeChestId;
      if (keysRef.current['KeyE']) {
        // ... (omitting lines for matching)
      } else if (activeChestId) {
        const c = nextEntities.find(e => e.id === activeChestId);
        if (!c || Math.sqrt((c.x - player.x) ** 2 + (c.y - player.y) ** 2) > 1.8) activeChestId = null;
      }

      // EXIT / VICTORY CHECK
      const distToExit = Math.sqrt((player.x - prev.exitX) ** 2 + (player.y - prev.exitY) ** 2);
      const isVictory = distToExit < 0.6;

      return {
        ...prev,
        player,
        entities: nextEntities,
        survivalTime: nextSurvivalTime,
        messageTimeout: nextMessageTimeout,
        message: nextMessage,
        activeChestId,
        chaseActive,
        isGameOver: player.health <= 0,
        isVictory,
        deathReason: player.health <= 0 ? "生命维持系统完全失效" : ""
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
      type: 'WALL' | 'ENTITY' | 'PLAYER' | 'PARTICLE' | 'DAMAGE_NUMBER' | 'EXIT';
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

    // Add Exit (Always at the end of renderList for transparency/glow)
    renderList.push({
      type: 'EXIT',
      y: gameState.exitY * s,
      draw: () => {
        const x = gameState.exitX * s;
        const y = gameState.exitY * s;
        const time = performance.now() * 0.002;
        const pulse = Math.sin(time) * 10;
        const float = Math.sin(time * 0.5) * 5;

        ctx.save();
        // 1. Massive Ground Glow
        const groundGrad = ctx.createRadialGradient(x, y, 5, x, y, 70 + pulse);
        groundGrad.addColorStop(0, 'rgba(0, 255, 255, 0.4)');
        groundGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = groundGrad;
        ctx.beginPath(); ctx.arc(x, y, 80 + pulse, 0, Math.PI * 2); ctx.fill();

        // 2. Vertical Light Beam
        const beamGrad = ctx.createLinearGradient(x - 20, y, x + 20, y);
        beamGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        beamGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.2)');
        beamGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = beamGrad;
        ctx.fillRect(x - 20, y - 200, 40, 200);

        // 3. Core Floating Orb
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#0cf';
        ctx.beginPath();
        ctx.arc(x, y - 10 + float, 12 + Math.sin(time * 2) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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
          } else if (e.type === Types.EntityType.EXIT_GATE) {
            const size = 64;
            const time = performance.now() * 0.003;
            ctx.save();
            ctx.translate(e.x * s, e.y * s);

            // Energy Field
            const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 40 + Math.sin(time) * 5);
            grad.addColorStop(0, 'rgba(0, 100, 255, 0.6)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI * 2); ctx.fill();

            // Lock Icon
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#0cf';
            ctx.fillText('🔒', 0, 0);

            // Rotating Seals
            ctx.rotate(time);
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
            ctx.setLineDash([5, 10]);
            ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();

            ctx.restore();
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

          let sprite = playerImgRef.current;
          if (player.actionState === 'ATTACK_KNIFE' && playerKnifeImgRef.current) sprite = playerKnifeImgRef.current;
          if (player.actionState === 'ATTACK_GUN' && playerShootImgRef.current) sprite = playerShootImgRef.current;

          ctx.drawImage(sprite, -size / 2, -size / 2 - 12, size, size);
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
        <h1 className="text-7xl font-black tracking-widest mb-2 animate-pulse text-zinc-50">虚空行者</h1>
        <p className="text-zinc-500 mb-16 tracking-[0.5em] text-[10px] uppercase">迷宫生存模拟器 v3.2</p>

        <div className="flex flex-col gap-6 w-96 relative z-10">
          <button onClick={() => initGame(false)} className="group relative overflow-hidden px-8 py-5 border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-50 hover:text-black transition-all">
            <div className="flex justify-between items-center font-black uppercase tracking-widest text-sm">
              <span>开始新探险</span>
              <span className="opacity-0 group-hover:opacity-100">{'>>'}</span>
            </div>
          </button>

          {hasSave && (
            <button onClick={() => initGame(true)} className="group relative overflow-hidden px-8 py-5 border-2 border-blue-900 bg-blue-950/20 hover:bg-blue-600 hover:text-white transition-all">
              <div className="flex justify-between items-center font-black uppercase tracking-widest text-sm text-blue-300 group-hover:text-white">
                <span>继续此前任务</span>
                <span>(发现存档)</span>
              </div>
            </button>
          )}

          {/* AUTH BUTTON */}
          {!currentUser ? (
            <button onClick={() => setShowAuth(true)} className="group relative overflow-hidden px-8 py-5 border border-zinc-800 bg-black hover:border-yellow-600 transition-all">
              <div className="flex justify-between items-center font-black uppercase tracking-widest text-xs text-zinc-500 group-hover:text-yellow-500">
                <span>☁ 连接云端数据库</span>
                <span>OFFLINE</span>
              </div>
            </button>
          ) : (
            <div className="relative px-8 py-5 border border-green-900 bg-green-950/10">
              <div className="flex justify-between items-center font-bold uppercase tracking-widest text-xs text-green-500">
                <span className="truncate max-w-[200px]">{currentUser.email}</span>
                <button onClick={() => supabase.auth.signOut()} className="hover:text-white underline">退出</button>
              </div>
              <div className="text-[9px] text-green-700 mt-1">云端同步已连接</div>
            </div>
          )}
        </div>

        <div className="mt-24 flex gap-12 opacity-20 text-[9px] font-bold uppercase tracking-widest">
          <div>区域大小: {Constants.MAP_SIZE}^2</div>
          <div>认证: 已安全</div>
          <div>核心: 稳定</div>
        </div>

        {showAuth && (
          <AuthForm
            onLoginSuccess={() => setShowAuth(false)}
            onCancel={() => setShowAuth(false)}
          />
        )}
      </div>
    );
  }

  if (screen === 'LOADING_AI') {
    return <FallingVoid onComplete={() => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setScreen('PLAYING');
      damageNumbersRef.current = [];
    }} />;
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
      setGameState(prev => prev ? { ...prev, message: '武器已就绪', messageTimeout: 0.5 } : null);
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
            <div className="absolute top-0 left-0 h-full bg-red-600" style={{ width: `${Math.max(0, player.health).toFixed(1)}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/50">{Math.floor(player.health)}%</div>
          </div>

          {/* ENERGY (Hunger) */}
          <div className="text-yellow-500 text-[12px] w-4 text-center">⚡</div>
          <div className="flex-1 h-3 bg-zinc-900/80 border border-zinc-700 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-green-500" style={{ width: `${Math.max(0, player.hunger).toFixed(1)}%` }}></div>
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-white/50">{Math.floor(player.hunger)}%</div>
          </div>

          {/* WATER (Hydration) */}
          <div className="text-blue-500 text-[12px] w-4 text-center">💧</div>
          <div className="flex-1 h-3 bg-zinc-900/80 border border-zinc-700 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-blue-500" style={{ width: `${Math.max(0, player.hydration).toFixed(1)}%` }}></div>
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
            <h2 className="text-xl font-bold tracking-widest text-zinc-400">物资背包</h2>
            <button onClick={() => setShowInventory(false)} className="px-4 py-2 border border-zinc-600 rounded text-zinc-400">关闭</button>
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
                    const p = { ...prev.player };

                    // RELOAD/RECHARGE LOGIC
                    if (item.type === Types.ItemType.BATTERY) {
                      const fl = p.inventory.find(i => i.type === Types.ItemType.FLASHLIGHT);
                      if (fl) {
                        fl.durability = 100;
                        p.inventory = p.inventory.filter(i => i.id !== item.id);
                        return { ...prev, player: p, message: '电筒已充电', messageTimeout: 2 };
                      }
                    } else if (item.type === Types.ItemType.AMMO) {
                      const gun = p.inventory.find(i => i.type === Types.ItemType.GUN);
                      if (gun) {
                        gun.count = 12;
                        p.inventory = p.inventory.filter(i => i.id !== item.id);
                        return { ...prev, player: p, message: '已更换弹夹', messageTimeout: 2 };
                      }
                    }

                    // NORMAL EQUIP LOGIC
                    const nextP = autoEquip(p, item);
                    if (item.type === Types.ItemType.FLASHLIGHT) {
                      nextP.equippedLeftId = item.id;
                      if (nextP.equippedPocketId === item.id) nextP.equippedPocketId = null;
                      if (nextP.equippedRightId === item.id) nextP.equippedRightId = null;
                    }
                    else if (item.type === Types.ItemType.GUN || item.type === Types.ItemType.KNIFE) {
                      nextP.equippedRightId = item.id;
                      if (nextP.equippedPocketId === item.id) nextP.equippedPocketId = null;
                      if (nextP.equippedLeftId === item.id) nextP.equippedLeftId = null;
                    }
                    else if (item.type === Types.ItemType.FOOD || item.type === Types.ItemType.WATER) {
                      nextP.equippedPocketId = item.id;
                      if (nextP.equippedLeftId === item.id) nextP.equippedLeftId = null;
                      if (nextP.equippedRightId === item.id) nextP.equippedRightId = null;
                    }

                    return { ...prev, player: nextP };
                  });
                  setShowInventory(false);
                }} className="absolute inset-0 bg-transparent z-10 cursor-pointer active:bg-white/10" />

                {/* REMOVED OLD EQUIP BUTTONS */}
              </div>
            ))}
          </div>

          <div className="mt-auto border-t border-zinc-800 pt-4 flex flex-col gap-3">
            <button onClick={() => setGameState(s => s ? { ...s, isPaused: !s.isPaused } : null)} className="w-full py-4 bg-zinc-800 text-zinc-300 font-bold rounded-xl uppercase tracking-widest">
              {gameState.isPaused ? '继续游戏' : '暂停游戏'}
            </button>
            <button onClick={saveAndExit} className="w-full py-4 bg-red-900/20 border border-red-900/50 text-red-500 font-bold rounded-xl uppercase tracking-widest">保存并退出</button>
          </div>
        </div>
      )}

      {/* --- NOTIFICATIONS --- */}
      {gameState.message && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-3 border border-zinc-700 rounded-2xl text-white font-bold text-sm tracking-widest pointer-events-none animate-pulse z-20 w-max max-w-[85vw] text-center whitespace-pre-wrap leading-relaxed shadow-lg">
          {gameState.message}
        </div>
      )}

      {/* --- BOTTOM ACTION BAR --- */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg flex gap-4 pointer-events-auto z-10 px-6 items-end">

        {/* LEFT HAND */}
        <button onClick={() => handleSlotAction(eL, 'left')} className={`flex-1 aspect-square bg-zinc-900/90 backdrop-blur-md border-2 ${eL ? 'border-zinc-500' : 'border-zinc-800'} rounded-[1.5rem] flex flex-col items-center justify-center relative active:scale-95 transition-all shadow-lg`}>
          <div className="text-[9px] absolute top-2 text-zinc-500 font-bold tracking-widest uppercase">左手</div>
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
          <div className="text-[9px] absolute top-2 text-zinc-500 font-bold tracking-widest uppercase">储备口袋</div>
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
          <div className="text-[9px] absolute top-2 text-red-500/50 font-bold tracking-widest uppercase">战备位</div>
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
              <h2 className="text-yellow-500 font-bold uppercase tracking-widest text-lg">补给箱物品</h2>
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
              }}>全部提取</button>
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
            <button onClick={() => setGameState(s => s ? { ...s, activeChestId: null } : null)} className="mt-auto w-full py-4 bg-zinc-800 rounded-xl text-zinc-400 font-bold uppercase tracking-widest">关闭</button>
          </div>
        </div>
      )}

      {gameState.isPaused && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-[100]">
          <h2 className="text-4xl font-black text-white tracking-[0.5em] mb-12 animate-pulse">暂停</h2>
          <button onClick={() => setGameState(s => s ? { ...s, isPaused: false } : null)} className="px-12 py-4 bg-white text-black font-black uppercase tracking-[0.2em] rounded-full active:scale-95 transition-transform">继续</button>
        </div>
      )}

      {gameState.isGameOver && (
        <div className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center text-center p-10">
          <h1 className="text-8xl font-black text-red-600 mb-4 flicker uppercase leading-none tracking-tighter">已牺牲</h1>
          <p className="text-zinc-500 mb-16 italic text-sm tracking-[0.5em] font-bold uppercase">"{gameState.deathReason}"</p>
          <button onClick={returnToMenu} className="px-12 py-4 bg-zinc-800 border border-zinc-700 text-white text-xs hover:bg-zinc-700 transition-all uppercase font-black tracking-[0.3em] rounded-lg active:scale-95">重启任务</button>
        </div>
      )}

      {gameState.isVictory && (
        <div className="fixed inset-0 bg-zinc-950 z-[99999] flex flex-col items-center justify-center text-center p-10 animate-fade-in">
          <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
          <h1 className="text-8xl font-black text-cyan-400 mb-4 animate-pulse uppercase leading-none tracking-tighter drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">成功撤离</h1>
          <p className="text-zinc-500 mb-16 italic text-sm tracking-[0.5em] font-bold uppercase">"核心系统已受控 // 任务圆满成功"</p>
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-2xl mb-12 w-full max-w-sm">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2 font-bold">生存时长</div>
            <div className="text-4xl text-white font-mono">{Math.floor(gameState.survivalTime)} 秒</div>
          </div>
          <button onClick={returnToMenu} className="px-12 py-5 bg-cyan-600 border border-cyan-400 text-white hover:bg-cyan-500 transition-all uppercase font-black tracking-[0.3em] rounded-xl active:scale-95 shadow-lg shadow-cyan-900/40">返回主基地</button>
        </div>
      )}

    </div>
  );
};

export default App;
