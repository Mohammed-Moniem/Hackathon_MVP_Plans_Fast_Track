import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

const entry = process.argv[2] || 'server';
if (!/^[a-z][a-z-]+$/.test(entry)) throw new Error('Invalid application entry.');
function compile(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) compile(file);
    else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const out = path.join('dist', path.relative('src', file)).replace(/\.ts$/, '.js');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, sourceMap: true }, fileName: file });
      fs.writeFileSync(out, result.outputText);
      if (result.sourceMapText) fs.writeFileSync(`${out}.map`, result.sourceMapText);
    }
  }
}
compile('src');
process.argv.splice(2, 1);
await import(pathToFileURL(path.resolve('dist', `${entry}.js`)).href);
