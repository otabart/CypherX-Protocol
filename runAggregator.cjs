// runAggregator.mjs
import { register } from "ts-node/esm";

// Register ts-node with experimental specifier resolution.
// This call configures ts-node for ESM mode.
register({ experimentalSpecifierResolution: "node" });

// Now import your aggregator TypeScript file.
await import("./aggregator.ts");
