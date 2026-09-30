/**
 * Deterministic pseudo-random number generator (Mulberry32)
 * Ensures repeatable simulation states across runs with the same world seed.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = Math.floor(Math.abs(seed)) || 123456789;
  }

  /**
   * Returns a float between 0 (inclusive) and 1 (exclusive)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a number sampled from standard normal distribution (mean=0, stdev=1)
   * Using Box-Muller transform
   */
  public nextGaussian(): number {
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) u1 = this.next();
    while (u2 === 0) u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Returns float in range [min, max]
   */
  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns integer in range [min, max]
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  public getSeed(): number {
    return this.state;
  }

  public setSeed(seed: number): void {
    this.state = Math.floor(Math.abs(seed)) || 123456789;
  }
}
