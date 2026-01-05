
export enum ItemType {
  FOOD = 'FOOD',
  WATER = 'WATER',
  FLASHLIGHT = 'FLASHLIGHT',
  KNIFE = 'KNIFE',
  GUN = 'GUN'
}

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  durability?: number; // Battery for flashlight, sharpness for knife
  count?: number;      // Ammo for gun, servings for food/water
}

export enum EntityType {
  CHEST = 'CHEST',
  MONSTER = 'MONSTER'
}

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
  sprinting: boolean;
}

export interface GameState {
  player: Player;
  map: number[][];
  entities: Entity[];
  isGameOver: boolean;
  deathReason: string;
  message: string;
  messageTimeout: number;
  chaseActive: boolean;
  survivalTime: number;
  isPaused: boolean;
  activeChestId: string | null;
  draggingItemId: string | null;
}
