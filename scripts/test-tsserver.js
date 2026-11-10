const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// 1. Try reading tsconfig.json as tsserver does
const configFileName = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
const configFile = ts.readConfigFile(configFileName, ts.sys.readFile);
const compilerOptions = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');

console.log('Compiler options from tsconfig.json:');
console.log('moduleResolution:', compilerOptions.options.moduleResolution);
console.log('jsx:', compilerOptions.options.jsx);
console.log('paths:', compilerOptions.options.paths);

// Create LanguageService
const servicesHost = {
  getScriptFileNames: () => compilerOptions.fileNames,
  getScriptVersion: () => '1',
  getScriptSnapshot: (fileName) => {
    if (!fs.existsSync(fileName)) return undefined;
    return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, 'utf8'));
  },
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => compilerOptions.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};

const service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());

const files = ['app/index.tsx', 'app/(student-tabs)/_layout.tsx', 'app/portal-select.tsx'];

for (const file of files) {
  const absPath = path.resolve(file);
  const syntactic = service.getSyntacticDiagnostics(absPath);
  const semantic = service.getSemanticDiagnostics(absPath);
  const suggestions = service.getSuggestionDiagnostics(absPath);
  
  console.log(`\n=== Diagnostics for ${file} ===`);
  console.log(`Syntactic: ${syntactic.length}, Semantic: ${semantic.length}, Suggestions: ${suggestions.length}`);
  
  for (const d of [...syntactic, ...semantic, ...suggestions]) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    console.log(`[Category ${d.category}, Code ${d.code}] ${message}`);
  }
}

