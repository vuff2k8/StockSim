import { WorldManager } from '../src/game/world/WorldManager';
import { MarketEngine } from '../src/game/market/MarketEngine';
import { SeededRandom } from '../src/utils/seedRandom';
import { SaveManager } from '../src/game/world/SaveManager';

async function runBaseline() {
  console.log('--- STARTING BASELINE PROFILE ---');
  const startTime = performance.now();
  
  // 1. Create a World
  const world = await WorldManager.createNewWorld({
    marketId: 'vietnam',
    difficulty: 'normal',
  });
  const worldCreationTime = performance.now() - startTime;
  console.log(`World creation time: ${worldCreationTime.toFixed(2)} ms`);
  console.log(`Number of instruments: ${Object.keys(world.instruments).length}`);

  // Measure JSON save size
  const jsonStr = JSON.stringify(world);
  const jsonSizeKB = (Buffer.byteLength(jsonStr, 'utf8') / 1024).toFixed(2);
  console.log(`World JSON size: ${jsonSizeKB} KB (${jsonStr.length} chars)`);

  // Measure tick performance
  const marketEngine = new MarketEngine();
  const rng = new SeededRandom(world.snapshot.seed);

  let state = world;
  const warmupTicks = 10;
  for (let i = 0; i < warmupTicks; i++) {
    state = WorldManager.stepSimulation(state, marketEngine, rng);
  }

  const measuredTicks = 100;
  const tickStart = performance.now();
  for (let i = 0; i < measuredTicks; i++) {
    state = WorldManager.stepSimulation(state, marketEngine, rng);
  }
  const tickElapsed = performance.now() - tickStart;
  const avgTickMs = (tickElapsed / measuredTicks).toFixed(3);
  const tps = ((measuredTicks * 1000) / tickElapsed).toFixed(1);
  console.log(`Simulation 100 ticks elapsed: ${tickElapsed.toFixed(2)} ms`);
  console.log(`Average tick time: ${avgTickMs} ms (approx ${tps} TPS)`);

  // Measure Save/Load time
  const saveStart = performance.now();
  const serialized = JSON.stringify(state);
  const saveElapsed = performance.now() - saveStart;
  
  const loadStart = performance.now();
  const deserialized = JSON.parse(serialized);
  const loadElapsed = performance.now() - loadStart;
  console.log(`JSON Save time: ${saveElapsed.toFixed(2)} ms`);
  console.log(`JSON Load time: ${loadElapsed.toFixed(2)} ms`);

  // Measure memory approximation
  if (process.memoryUsage) {
    const mem = process.memoryUsage();
    console.log(`Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  }

  // Fast forward 1 day benchmark (approx 360 ticks)
  const ffStart = performance.now();
  const ffState = WorldManager.advanceTimeJump(state, '1d', marketEngine, rng);
  const ffElapsed = performance.now() - ffStart;
  console.log(`1-Day Fast-forward time: ${ffElapsed.toFixed(2)} ms`);

  console.log('--- BASELINE COMPLETED ---');
}

runBaseline().catch(console.error);
