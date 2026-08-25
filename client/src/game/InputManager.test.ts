import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InputManager } from "./InputManager";

type Listener = (event: unknown) => void;

class TestEventTarget {
  hidden = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(
    type: string,
    listener: Listener,
    _options?: unknown
  ): void {
    const bucket = this.listeners.get(type) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown): void {
    this.listeners.get(type)?.forEach(listener => listener(event));
  }
}

type GamepadState = {
  connected: boolean;
  axes: number[];
  buttons: Array<{ pressed: boolean }>;
};

const keyEvent = (key: string) => ({
  key,
  preventDefault: () => undefined,
});

describe("InputManager directional invariants", () => {
  let windowStub: TestEventTarget;
  let documentStub: TestEventTarget;
  let gamepads: GamepadState[];

  beforeEach(() => {
    windowStub = new TestEventTarget();
    documentStub = new TestEventTarget();
    gamepads = [];
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: windowStub,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: documentStub,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { getGamepads: () => gamepads },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { getGamepads: () => [] },
    });
  });

  it("maps left and right keyboard input to the matching screen direction", () => {
    const manager = new InputManager();

    windowStub.dispatch("keydown", keyEvent("ArrowLeft"));
    expect(manager.sample(false).moveX).toBe(-1);
    windowStub.dispatch("keyup", keyEvent("ArrowLeft"));

    windowStub.dispatch("keydown", keyEvent("ArrowRight"));
    expect(manager.sample(false).moveX).toBe(1);

    manager.dispose();
  });

  it("maps the standard gamepad axis and d-pad without mirroring horizontal movement", () => {
    const pad: GamepadState = {
      connected: true,
      axes: [-1, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    };
    gamepads = [pad];
    const manager = new InputManager();

    expect(manager.sample(false).moveX).toBe(-1);

    pad.axes[0] = 1;
    expect(manager.sample(false).moveX).toBe(1);

    pad.axes[0] = 0;
    pad.buttons[14].pressed = true;
    expect(manager.sample(false).moveX).toBe(-1);
    pad.buttons[14].pressed = false;
    pad.buttons[15].pressed = true;
    expect(manager.sample(false).moveX).toBe(1);

    manager.dispose();
  });

  it("clears held touch state and action edges together", () => {
    const manager = new InputManager();

    manager.setTouchMove(1, -1);
    manager.setTouchFast(true);
    manager.press("mark");
    manager.clear();

    expect(manager.sample()).toEqual({
      moveX: 0,
      moveZ: 0,
      mark: false,
      area: false,
      pause: false,
      fast: false,
    });

    manager.dispose();
  });
});
