import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { spawnSync } from 'node:child_process';

function compile(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) compile(file);
    else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const out = path.join('.test-build', file).replace(/\.ts$/, '.js');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, fileName: file }).outputText);
    }
  }
}
compile('src'); compile('test');
const selected = process.argv.slice(2);
const tests = fs.readdirSync('.test-build/test').filter(f => f.endsWith('.test.js') && (!selected.length || selected.some(s => f.includes(s)))).map(f => path.resolve('.test-build/test', f));
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
