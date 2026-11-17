const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const original = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) { return original.call(this, name.startsWith('@/') ? path.resolve(name.slice(2)) : name, parent, ...rest); };
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
