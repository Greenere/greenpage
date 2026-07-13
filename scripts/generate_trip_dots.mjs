import { generateTripDots } from './trip_dots/generate.mjs';

async function main() {
  const debug = process.argv.includes('--debug');
  const result = await generateTripDots({ rootDir: process.cwd(), debug });
  console.log(`Generated ${result.tripCount} trips across ${result.homeCenterCount} home center(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
