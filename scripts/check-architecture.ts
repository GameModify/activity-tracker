import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : full.endsWith('.ts') ? [full] : [];
  });
}
const failures: string[] = [];
function check(file: string, specifier: string): void {
  if (!specifier.startsWith('.')) return;
  const target = path
    .relative(process.cwd(), path.resolve(path.dirname(file), specifier))
    .replaceAll('\\', '/');
  if (target.startsWith('../')) failures.push(file + ': imports another checkout');
  if (file.startsWith('src/domain') && !target.startsWith('src/domain/'))
    failures.push(file + ': domain dependency');
  if (file.startsWith('src/application') && target.startsWith('src/adapters/'))
    failures.push(file + ': application imports adapter');
  if (
    file.startsWith('extension/') &&
    target.startsWith('src/') &&
    target !== 'src/domain/contracts.ts'
  )
    failures.push(file + ': extension imports service internals');
}
for (const full of [...files('src'), ...files('extension')]) {
  const file = full.replaceAll('\\', '/');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      check(file, node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      check(file, node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('Architecture boundaries: OK');
