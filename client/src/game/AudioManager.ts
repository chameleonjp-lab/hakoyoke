/** Obsidian Observatory: original Web Audio signals; unlocked only by user action. */
export type SoundSignal =
  | "mark"
  | "capture"
  | "area"
  | "roll"
  | "land"
  | "warning"
  | "perfect"
  | "collapse"
  | "crush"
  | "menu";

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    void this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(signal: SoundSignal): void {
    if (!this.enabled || !this.context || !this.master) return;
    const now = this.context.currentTime;
    const palette: Record<
      SoundSignal,
      [number, number, number, OscillatorType]
    > = {
      mark: [640, 880, 0.09, "sine"],
      capture: [150, 64, 0.3, "sine"],
      area: [320, 96, 0.48, "triangle"],
      roll: [74, 52, 0.16, "triangle"],
      land: [62, 42, 0.22, "sine"],
      warning: [210, 176, 0.36, "sawtooth"],
      perfect: [392, 784, 0.5, "sine"],
      collapse: [90, 35, 0.58, "triangle"],
      crush: [70, 26, 0.7, "sawtooth"],
      menu: [440, 650, 0.08, "sine"],
    };
    const [from, to, duration, type] = palette[signal];
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, to),
      now + duration
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      signal === "warning" ? 0.045 : 0.09,
      now + 0.016
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
