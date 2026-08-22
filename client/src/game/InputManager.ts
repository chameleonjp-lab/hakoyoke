/** Obsidian Observatory: all physical inputs become semantic game actions. */
export interface InputFrame {
  moveX: number;
  moveZ: number;
  mark: boolean;
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
  private readonly gamepadEdges = new Set<number>();
  private previousButtons: boolean[] = [];
  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "escape"].includes(key)) event.preventDefault();
    if (!this.down.has(key)) this.edges.add(key);
    this.down.add(key);
  };
  private onKeyUp = (event: KeyboardEvent) => this.down.delete(event.key.toLowerCase());

  constructor() {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
  }

  private clear = () => {
    this.down.clear();
    this.edges.clear();
    this.touchX = 0;
    this.touchZ = 0;
    this.touchFast = false;
  };

  setTouchMove(x: number, z: number): void {
    this.touchX = Math.max(-1, Math.min(1, x));
    this.touchZ = Math.max(-1, Math.min(1, z));
  }

  setTouchFast(active: boolean): void {
    this.touchFast = active;
  }

  press(action: "mark" | "area" | "pause"): void {
    this.edges.add(`touch:${action}`);
  }

  sample(): InputFrame {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((candidate) => candidate?.connected);
    const padX = pad && Math.abs(pad.axes[0] ?? 0) > 0.18 ? -(pad.axes[0] ?? 0) : 0;
    const padZ = pad && Math.abs(pad.axes[1] ?? 0) > 0.18 ? -(pad.axes[1] ?? 0) : 0;
    if (pad) pad.buttons.forEach((button, index) => { if (button.pressed && !this.previousButtons[index]) this.gamepadEdges.add(index); this.previousButtons[index] = button.pressed; });
    const moveX = (this.down.has("a") || this.down.has("arrowleft") ? 1 : 0) - (this.down.has("d") || this.down.has("arrowright") ? 1 : 0) + this.touchX + padX;
    const moveZ = (this.down.has("w") || this.down.has("arrowup") ? 1 : 0) - (this.down.has("s") || this.down.has("arrowdown") ? 1 : 0) + this.touchZ + padZ;
    const frame: InputFrame = {
      moveX: Math.max(-1, Math.min(1, moveX)),
      moveZ: Math.max(-1, Math.min(1, moveZ)),
      mark: this.consume(" ") || this.consume("z") || this.consume("touch:mark") || this.consumeGamepad(0),
      area: this.consume("x") || this.consume("e") || this.consume("touch:area") || this.consumeGamepad(2),
      pause: this.consume("escape") || this.consume("touch:pause") || this.consumeGamepad(9),
      fast: this.down.has("shift") || this.down.has("c") || this.touchFast || Boolean(pad?.buttons[1]?.pressed),
    };
    return frame;
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
    this.clear();
  }
}
