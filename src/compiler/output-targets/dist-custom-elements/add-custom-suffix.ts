import { getModuleFromSourceFile } from 'src/compiler/transformers/transform-utils';
import ts from 'typescript';

import type * as d from '../../../declarations';


export function addCustomSuffix(
  compilerCtx: d.CompilerCtx,
  components: d.ComponentCompilerMeta[],
  tagNameTransform: boolean): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext) => {

  if (!tagNameTransform) {
    return (rootNode: ts.SourceFile): ts.SourceFile => rootNode;
  }
  return (rootNode: ts.SourceFile): ts.SourceFile => {

    const moduleFile = getModuleFromSourceFile(compilerCtx, rootNode);
    const tagNames: string[] = [];
    if (moduleFile.cmps.length) {
      const mainTagName = moduleFile.cmps[0].tagName;
      console.log('Patching:', mainTagName);
      tagNames.push(mainTagName);
      moduleFile.cmps.forEach((cmp) => {
        cmp.dependencies.forEach((dCmp) => {
          const foundDep = components.find((dComp) => dComp.tagName === dCmp);
          tagNames.push(foundDep.tagName);
            console.log('Found dependency:', foundDep.tagName);
        });
      });
    }
    const runtimeFunction = ts.factory.createFunctionDeclaration(
      undefined,
      undefined,
      'getCustomSuffix',
      undefined,
      [],
      undefined,
      ts.factory.createBlock([ts.factory.createReturnStatement(ts.factory.createStringLiteral('-test'))]),
    );
    const newSourceFile = ts.factory.updateSourceFile(rootNode, [...rootNode.statements, runtimeFunction]);

    function visit(node: ts.Node): ts.Node {
      let newNode: ts.Node = node;

      // Find all instances of `h('tagName')` and replace them with `h('tagName' + getCustomSuffix())`
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'h') {
        const componentName = node.arguments[0];
        if (ts.isStringLiteral(componentName) && tagNames.some(tag => componentName.text.startsWith(tag))) {
          const customTagNameExpression = ts.factory.createBinaryExpression(
            ts.factory.createStringLiteral(componentName.text),
            ts.SyntaxKind.PlusToken,
            ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
          );

          newNode = ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [
            customTagNameExpression,
            ...node.arguments.slice(1),
          ]);
        }
      }
      // Find all instances of query selectors targeting the tagname and add the custom suffix as a template literal
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        if ((methodName === 'querySelector' || methodName === 'querySelectorAll') && node.arguments.length > 0) {
          const selectorArgument = node.arguments[0];

          if (ts.isStringLiteral(selectorArgument)) {
            const selectorText = selectorArgument.text;
            // Find all matches of any tagName in selectorText, preferring the longest at each position
            const matches: { tag: string; start: number; end: number }[] = [];
            let i = 0;
            while (i < selectorText.length) {
              let foundTag: string | undefined;
              let foundLength = 0;
              for (const tagName of tagNames) {
                if (
                  selectorText.startsWith(tagName, i) &&
                  tagName.length > foundLength  &&
                  (i === 0 || !/[.#]/.test(selectorText[i - 1])) // Ensure not preceded by . or #
                ) {
                  foundTag = tagName;
                  foundLength = tagName.length;
                }
              }
              if (foundTag) {
                matches.push({ tag: foundTag, start: i, end: i + foundLength });
                i += foundLength;
              } else {
                i++;
              }
            }

            if (matches.length > 0) {
              let lastIndex = 0;
              const templateSpans: ts.TemplateSpan[] = [];
              const templateHead = selectorText.slice(0, matches[0].start) + matches[0].tag;
              lastIndex = matches[0].end;
              templateSpans.push(
                ts.factory.createTemplateSpan(
                  ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
                  matches.length === 1
                    ? ts.factory.createTemplateTail(selectorText.slice(lastIndex))
                    : ts.factory.createTemplateMiddle(selectorText.slice(lastIndex, matches[1].start) + matches[1].tag),
                ),
              );
              for (let j = 1; j < matches.length; j++) {
                lastIndex = matches[j].end;
                templateSpans.push(
                  ts.factory.createTemplateSpan(
                    ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
                    j === matches.length - 1
                      ? ts.factory.createTemplateTail(selectorText.slice(lastIndex))
                      : ts.factory.createTemplateMiddle(selectorText.slice(lastIndex, matches[j + 1].start) + matches[j + 1].tag),
                  ),
                );
              }
              const customTagNameExpression = ts.factory.createTemplateExpression(
                ts.factory.createTemplateHead(templateHead),
                templateSpans,
              );
              newNode = ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [
                customTagNameExpression,
                ...node.arguments.slice(1),
              ]);
            }
          }
        }
      }

      // Find all instances of `customElements.get('tagName')` and replace them with `customElements.get('tagName' + getCustomSuffix())`
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (
          ts.isPropertyAccessExpression(expression) &&
          (expression.name.text === 'get' || expression.name.text === 'define') &&
          ts.isIdentifier(expression.expression) &&
          expression.expression.text === 'customElements'
        ) {
          // Replace the tagname with tagName + getCustomSuffix()
          const [firstArg, ...restArgs] = node.arguments;
          if (firstArg && ts.isIdentifier(firstArg) && firstArg.text === 'tagName') {
            const newArgument = ts.factory.createBinaryExpression(
              firstArg,
              ts.SyntaxKind.PlusToken,
              ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
            );

            newNode = ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [
              newArgument,
              ...restArgs,
            ]);
          }
        }
      }

      return ts.visitEachChild(newNode, visit, context);
    }
    return ts.visitNode(newSourceFile, visit) as ts.SourceFile;
  };
  }
}
