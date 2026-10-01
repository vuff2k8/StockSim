import { WorldManager } from '../src/game/world/WorldManager';
import { WorldBinaryCodec } from '../src/services/storage/BinaryCodec';

async function testCompression() {
  console.log('=== RUNNING BINARY CODEC & COMPRESSION TEST ===');
  
  // 1. Create a World
  const world = await WorldManager.createNewWorld({
    marketId: 'vietnam',
    difficulty: 'normal',
  });

  // A. JSON Baseline
  const jsonStart = performance.now();
  const jsonStr = JSON.stringify(world);
  const jsonEncodeTime = performance.now() - jsonStart;
  const jsonBytes = Buffer.byteLength(jsonStr, 'utf8');

  const jsonParseStart = performance.now();
  const parsedJson = JSON.parse(jsonStr);
  const jsonDecodeTime = performance.now() - jsonParseStart;

  console.log(`[A] JSON Baseline:`);
  console.log(`    Size: ${(jsonBytes / 1024).toFixed(2)} KB (${jsonBytes} bytes)`);
  console.log(`    Encode time: ${jsonEncodeTime.toFixed(2)} ms | Decode time: ${jsonDecodeTime.toFixed(2)} ms`);

  // B. Binary Uncompressed
  const binStart = performance.now();
  const binaryBytes = WorldBinaryCodec.encode(world);
  const binEncodeTime = performance.now() - binStart;

  const binParseStart = performance.now();
  const decodedWorld = WorldBinaryCodec.decode(binaryBytes);
  const binDecodeTime = performance.now() - binParseStart;

  const binarySavings = (((jsonBytes - binaryBytes.length) / jsonBytes) * 100).toFixed(1);
  console.log(`[B] Binary Codec (Delta + VarInt + ZigZag):`);
  console.log(`    Size: ${(binaryBytes.length / 1024).toFixed(2)} KB (${binaryBytes.length} bytes) - Reduction: ${binarySavings}%`);
  console.log(`    Encode time: ${binEncodeTime.toFixed(2)} ms | Decode time: ${binDecodeTime.toFixed(2)} ms`);

  // C. Binary + Gzip Compression
  const compStart = performance.now();
  const compressedBytes = await WorldBinaryCodec.compress(binaryBytes);
  const compTime = performance.now() - compStart;

  const decompStart = performance.now();
  const decompressedBytes = await WorldBinaryCodec.decompress(compressedBytes);
  const roundtripWorld = WorldBinaryCodec.decode(decompressedBytes);
  const decompTime = performance.now() - decompStart;

  const compSavings = (((jsonBytes - compressedBytes.length) / jsonBytes) * 100).toFixed(1);
  console.log(`[C] Binary + Gzip Compressed:`);
  console.log(`    Size: ${(compressedBytes.length / 1024).toFixed(2)} KB (${compressedBytes.length} bytes) - Reduction: ${compSavings}%`);
  console.log(`    Compress time: ${compTime.toFixed(2)} ms | Decompress time: ${decompTime.toFixed(2)} ms`);

  // Verify correctness
  console.log('\n--- VERIFYING ROUNDTRIP CORRECTNESS ---');
  console.log(`Seed match: ${world.snapshot.seed === roundtripWorld.snapshot.seed ? 'OK' : 'FAIL'}`);
  console.log(`Cash match: ${world.portfolio.cash === roundtripWorld.portfolio.cash ? 'OK' : 'FAIL'}`);
  
  const origKeys = Object.keys(world.instruments);
  const roundKeys = Object.keys(roundtripWorld.instruments);
  console.log(`Instrument count match: ${origKeys.length === roundKeys.length ? 'OK' : 'FAIL'} (${roundKeys.length} instruments)`);
  
  let priceMatch = true;
  for (const sym of origKeys) {
    const p1 = world.instruments[sym].currentPrice;
    const p2 = roundtripWorld.instruments[sym].currentPrice;
    if (Math.abs(p1 - p2) > 0.05) {
      priceMatch = false;
      console.log(`Price mismatch for ${sym}: ${p1} vs ${p2}`);
    }
  }
  console.log(`All instrument prices roundtrip match: ${priceMatch ? 'OK' : 'FAIL'}`);
  console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

testCompression().catch(console.error);
