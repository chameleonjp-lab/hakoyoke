/** Obsidian Observatory: all physical inputs become semantic game actions. */
import { directionFromVector, type Direction } from "./gridMovement";

const GAMEPAD_ENGAGE_THRESHOLD = 0.55;
const GAMEPAD_RELEASE_THRESHOLD = 0.35;

export interface InputFrame {
  moveX: number;
  moveZ: number;
  moveDirection: Direction | null;
  movePressed: Direction | null;
  mark: boolean;
  clearMarker: boolean;
  area: boolean;
  pause: boolean;
  fast: boolean;
}

export class InputManager {
  private readonly down = new Set<string>();
  private readonly edges = new Set<string>();
  private touchX = 0;
  private touchZ = 0;
  private touchFast = false;
  private touchDirection: Direction | null = null;
  private gamepadDirection: Direction | null = null;
  private activeSource: "keyboard" | "touch" | "gamepad" | null = null;
  private readonly directionHistory: Direction[] = [];
  private movePressed: Direction | null = null;
  private readonly gamepadEdges = new Set<number>();
  private previousButtons: boolean[] = [];
  private readonly onVisibility = () => {
    if (document.hidden) this.clear();
  };
  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
        "escape",
        "backspace",
        "delete",
      ].includes(key)
    )
      event.preventDefault();
    if (!this.down.has(key)) {
      this.edges.add(key);
      const direction = directionForKey(key);
      if (direction) {
        this.movePressed = direction;
        this.rememberDirection(direction);
        this.activeSource = "keyboard";
      }
    }
    this.down.add(key);
  };
  private onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.down.delete(key);
    if (this.activeSource === "keyboard" && !this.keyboardDirection())
      this.activeSource = null;
  };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  clear = () => {
    this.down.clear();
    this.edges.clear();
    this.gamepadEdges.clear();
    this.previousButtons = [];
    this.touchX = 0;
    this.touchZ = 0;
    this.touchFast = false;
    this.touchDirection = null;
    this.gamepadDirection = null;
    this.activeSource = null;
    this.directionHistory.length = 0;
    this.movePressed = null;
  };

  setTouchMove(x: number, z: number): void {
    this.touchX = Math.max(-1, Math.min(1, x));
    this.touchZ = Math.max(-1, Math.min(1, z));
    const next = directionFromVector(
      this.touchX,
      this.touchZ,
      this.touchDirection
    );
    if (next !== this.touchDirection) {
      if (next) {
        this.movePressed = next;
        this.rememberDirection(next);
        this.activeSource = "touch";
      } else if (this.activeSource === "touch") {
        this.activeSource = null;
      }
      this.touchDirection = next;
    }
  }

  setTouchFast(active: boolean): void {
    this.touchFast = active;
  }

  press(action: "mark" | "clear" | "area" | "pause"): void {
    this.edges.add(`touch:${action}`);
  }

  sample(consumeActions = true): InputFrame {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(
      candidate => candidate?.connected
    );
    const padX = pad?.axes[0] ?? 0;
    const padZ = pad ? -(pad.axes[1] ?? 0) : 0;
    const dpadX =
      (pad?.buttons[15]?.pressed ? 1 : 0) - (pad?.buttons[14]?.pressed ? 1 : 0);
    const dpadZ =
      (pad?.buttons[12]?.pressed ? 1 : 0) - (pad?.buttons[13]?.pressed ? 1 : 0);
    const dpadActive = dpadX !== 0 || dpadZ !== 0;
    const analogMagnitude = Math.hypot(padX, padZ);
    const nextGamepadDirection = dpadActive
      ? directionFromVector(dpadX, dpadZ, this.gamepadDirection)
      : analogMagnitude >=
          (this.gamepadDirection
            ? GAMEPAD_RELEASE_THRESHOLD
            : GAMEPAD_ENGAGE_THRESHOLD)
        ? directionFromVector(padX, padZ, this.gamepadDirection)
        : null;
    if (nextGamepadDirection !== this.gamepadDirection) {
      if (nextGamepadDirection) {
        this.movePressed = nextGamepadDirection;
        this.rememberDirection(nextGamepadDirection);
        this.activeSource = "gamepad";
      } else if (this.activeSource === "gamepad") {
        this.activeSource = null;
      }
      this.gamepadDirection = nextGamepadDirection;
    }
    if (pad)
      pad.buttons.forEach((button, index) => {
        if (button.pressed && !this.previousButtons[index])
          this.gamepadEdges.add(index);
        this.previousButtons[index] = button.pressed;
      });
    const moveDirection = this.activeDirection();
    const moveX = moveDirection
      ? moveDirection === "left"
        ? -1
        : moveDirection === "right"
          ? 1
          : 0
      : 0;
    const moveZ = moveDirection
      ? moveDirection === "down"
        ? -1
        : moveDirection === "up"
          ? 1
          : 0
      : 0;
    const frame: InputFrame = {
      moveX,
      moveZ,
      moveDirection,
      movePressed: this.movePressed,
      mark:
        consumeActions &&
        (this.consume(" ") ||
          this.consume("z") ||
          this.consume("touch:mark") ||
          this.consumeGamepad(0)),
      clearMarker:
        consumeActions &&
        (this.consume("backspace") ||
          this.consume("delete") ||
          this.consume("touch:clear") ||
          this.consumeGamepad(3)),
      area:
        consumeActions &&
        (this.consume("x") ||
          this.consume("e") ||
          this.consume("touch:area") ||
          this.consumeGamepad(2)),
      pause:
        this.consume("escape") ||
        this.consume("touch:pause") ||
        this.consumeGamepad(9),
      fast:
        this.down.has("shift") ||
        this.down.has("c") ||
        this.touchFast ||
        Boolean(pad?.buttons[1]?.pressed),
    };
    this.movePressed = null;
    return frame;
  }

  private rememberDirection(direction: Direction): void {
    const index = this.directionHistory.indexOf(direction);
    if (index >= 0) this.directionHistory.splice(index, 1);
    this.directionHistory.push(direction);
  }

  private keyboardDirection(): Direction | null {
    for (let index = this.directionHistory.length - 1; index >= 0; index -= 1) {
      const direction = this.directionHistory[index]!;
      if (directionKeys(direction).some(key => this.down.has(key)))
        return direction;
    }
    return null;
  }

  private activeDirection(): Direction | null {
    if (this.activeSource === "keyboard") return this.keyboardDirection();
    if (this.activeSource === "touch") return this.touchDirection;
    if (this.activeSource === "gamepad") return this.gamepadDirection;
    return null;
  }

  private consume(key: string): boolean {
    const found = this.edges.has(key);
    this.edges.delete(key);
    return found;
  }

  private consumeGamepad(index: number): boolean {
    const found = this.gamepadEdges.has(index);
    this.gamepadEdges.delete(index);
    return found;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clear();
  }
}

function directionForKey(key: string): Direction | null {
  if (key === "w" || key === "arrowup") return "up";
  if (key === "s" || key === "arrowdown") return "down";
  if (key === "a" || key === "arrowleft") return "left";
  if (key === "d" || key === "arrowright") return "right";
  return null;
}

function directionKeys(direction: Direction): string[] {
  switch (direction) {
    case "up":
      return ["w", "arrowup"];
    case "down":
      return ["s", "arrowdown"];
    case "left":
      return ["a", "arrowleft"];
    case "right":
      return ["d", "arrowright"];
  }
}
