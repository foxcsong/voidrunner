
export enum ItemType {
  FOOD = 'FOOD',
  WATER = 'WATER',
  FLASHLIGHT = 'FLASHLIGHT',
  KNIFE = 'KNIFE',
  GUN = 'GUN',
  AMMO = 'AMMO',
  BATTERY = 'BATTERY',
  KEY = 'KEY'
}

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  durability?: number; // Battery for flashlight, sharpness for knife
  count?: number;      // Ammo for gun, servings for food/water
}

export enum EntityType {
  PLAYER = 'PLAYER',
  MONSTER = 'MONSTER',
  CHEST = 'CHEST',
  EXIT_GATE = 'EXIT_GATE'
}
export type Screen = 'MENU' | 'PLAYING' | 'LOADING_AI';

export interface DamageNumber {
  id: number;
  x: number;
  y: number;
  value: number;
  life: number;
  color: string;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  type: EntityType;
  health?: number;
  data?: any;
}

export interface Player {
  x: number;
  y: number;
  dir: number;
  health: number;
  hunger: number;
  hydration: number;
  isFlashlightOn: boolean;
  inventory: InventoryItem[];
  equippedLeftId: string | null;
  equippedRightId: string | null;
  equippedPocketId: string | null;
  sprinting: boolean;
  hitFlash?: number; // Visual feedback intensity (0-1)
  actionState?: 'IDLE' | 'ATTACK_KNIFE' | 'ATTACK_GUN';
  actionTimer?: number;
}

export interface GameState {
  player: Player;
  map: number[][];
  entities: Entity[];
  isGameOver: boolean;
  isVictory: boolean;
  exitX: number;
  exitY: number;
  deathReason: string;
  message: string;
  messageTimeout: number;
  chaseActive: boolean;
  survivalTime: number;
  isPaused: boolean;
  activeChestId: string | null;
  draggingItemId: string | null;
}
