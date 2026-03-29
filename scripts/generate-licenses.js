#!/usr/bin/env node
// Dev-time script: extract license metadata for all production dependencies.
// Run via: npm run generate-licenses
// Output: src/renderer/data/licenses.json
//
// Re-run whenever a production dependency is added, removed, or updated.

"use strict";

const licenseChecker = require("license-checker");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "src", "renderer", "data", "licenses.json");

licenseChecker.init(
  { start: ROOT, production: true, excludePrivatePackages: true },
  (err, packages) => {
    if (err) {
      console.error("license-checker failed:", err);
      process.exit(1);
    }

    const result = Object.entries(packages)
      .map(([nameVersion, info]) => {
        const atIndex = nameVersion.lastIndexOf("@");
        const name = nameVersion.substring(0, atIndex);
        const version = nameVersion.substring(atIndex + 1);
        const license = Array.isArray(info.licenses) ? info.licenses.join(" OR ") : info.licenses;
        return {
          name,
          version,
          license: license || "UNKNOWN",
          repository: info.repository || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + "\n");
    console.log(`Generated ${result.length} license entries → ${OUTPUT}`);
  }
);
