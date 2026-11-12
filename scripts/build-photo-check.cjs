"use strict";

const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const nsfwRoot = path.resolve(path.dirname(require.resolve("nsfwjs")), "../..");
const license = fs.readFileSync(path.join(nsfwRoot, "LICENSE"), "utf8");

esbuild.build({
  entryPoints: [path.join(__dirname, "photo-check.mjs")],
  outfile: path.join(__dirname, "../vendor/photo-check.js"),
  bundle: true,
  format: "iife",
  globalName: "GaicaniPhotoCheck",
  target: "es2019",
  minify: true,
  legalComments: "inline",
  banner: { js: "/*! NSFWJS\n" + license + "\n*/" },
}).catch(() => { process.exitCode = 1; });
