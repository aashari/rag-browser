import { VERSION } from "../src/config/version";
import { readFileSync, writeFileSync } from "fs";

// Read package.json
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// Update version
pkg.version = VERSION;

// Write back to package.json
writeFileSync("./package.json", JSON.stringify(pkg, null, 2) + "\n");

console.log(`Updated package.json version to ${VERSION}`); 