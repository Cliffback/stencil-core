import { getModuleFromSourceFile } from 'src/compiler/transformers/transform-utils';
import ts from 'typescript';

import type * as d from '../../../declarations';


export function addCustomSuffix(compilerCtx: d.CompilerCtx, tagNameTransform: boolean): ts.TransformerFactory<ts.SourceFile> {
  return (context: ts.TransformationContext) => {

  if (!tagNameTransform) {
    return (rootNode: ts.SourceFile): ts.SourceFile => rootNode;
  }
  return (rootNode: ts.SourceFile): ts.SourceFile => {

    const moduleFile = getModuleFromSourceFile(compilerCtx, rootNode);
      if (moduleFile.cmps.length) {
        const tagName = moduleFile.cmps[0];
        console.log('Found a component:', tagName.tagName);
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

      // Find all instances of `h('stn-')` and replace them with `h('stn-' + getCustomSuffix())`
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'h') {
        const componentName = node.arguments[0];
        if (ts.isStringLiteral(componentName) && componentName.text.startsWith('stn-')) {
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
            const regex = /stn-[a-zA-Z0-9-]+/g;
            let match: RegExpExecArray | null;
            let lastIndex = 0;
            const templateSpans: ts.TemplateSpan[] = [];
            let templateHead = '';
            let found = false;

            while ((match = regex.exec(selectorText)) !== null) {
              found = true;
              const [tag] = match;
              const start = match.index;
              const end = regex.lastIndex;

              if (templateHead === '') {
                templateHead = selectorText.slice(0, start) + tag;
              } else {
                templateSpans.push(
                  ts.factory.createTemplateSpan(
                    ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
                    ts.factory.createTemplateMiddle(selectorText.slice(lastIndex, start) + tag),
                  ),
                );
              }

              lastIndex = end;
            }

            if (found) {
              // Add the final span with TemplateTail
              templateSpans.push(
                ts.factory.createTemplateSpan(
                  ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
                  ts.factory.createTemplateTail(selectorText.slice(lastIndex)),
                ),
              );

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

      // Find all instances of `customElements.get('stn-')` and replace them with `customElements.get('stn-' + getCustomSuffix())`
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


//
//       if (ts.isVariableStatement(node)) {
//         if (node.declarationList.declarations.length === 0) {
//           console.log("Found an empty variable statement:", node.getText());
//         } else {
//           node.declarationList.declarations.forEach(declaration => {
//             if (ts.isIdentifier(declaration.name)) {
//               console.log("Variable name:", declaration.name.text);
//             } else {
//               console.log("Found a variable statement with non-identifier name:", declaration.name.getText());
//             }
//           });
//         }
//               }

//
//       if (ts.isVariableStatement(node)) {
//         console.log('Found a variable statement:');
//   node.declarationList.declarations.forEach(declaration => {
//     if (ts.isIdentifier(declaration.name)) {
//       console.log(declaration.name.text);
//     }
//   });
// }

    if (ts.isVariableStatement(node)) {
        const updated = false;
        const newDeclarations = node.declarationList.declarations.map(declaration => {
          if (ts.isIdentifier(declaration.name) && declaration.name.text.includes('Css')) {
            console.log('Found a variable statement with Css:', declaration.name.text);
            // if (ts.isArrayLiteralExpression(declaration.initializer)) {
            //   const updatedElements = declaration.initializer.elements.map(element => {
            //     if (ts.isStringLiteral(element)) {
            //       const customTagNameExpression = ts.factory.createBinaryExpression(
            //         ts.factory.createStringLiteral(element.text),
            //         ts.SyntaxKind.PlusToken,
            //         ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
            //       );
            //       console.log(element.text);
            //       // return ts.factory.createStringLiteral(element.text + '-test');
            //       // return customTagNameExpression;
            //     }
            //     return element;
            //   });
            //   updated = true;
            //   return ts.factory.updateVariableDeclaration(
            //     declaration,
            //     declaration.name,
            //     declaration.exclamationToken,
            //     declaration.type,
            //     ts.factory.createArrayLiteralExpression(updatedElements, false)
            //   );
            // }
          }
          return declaration;
        });

        if (updated) {
          newNode = ts.factory.updateVariableStatement(
            node,
            node.modifiers,
            ts.factory.updateVariableDeclarationList(node.declarationList, newDeclarations)
          );
        }
      }



      // if (
      //   ts.isVariableStatement(node) &&
      //   node.declarationList.flags & ts.NodeFlags.Const
      // ) {
      //   const decls = node.declarationList.declarations.map(decl => {
      //     if (
      //       decl.initializer &&
      //       ts.isStringLiteral(decl.initializer)
      //     ) {
      //       console.log('Found a string literal:', decl.initializer.text);
      //       const css = decl.initializer.text;
      //       // Match stn-<tagname> not preceded by . or #
      //       const regex = /(^|[^.#\w-])(stn-[a-zA-Z0-9-]+)/g;
      //       let lastIndex = 0;
      //       let match: RegExpExecArray | null;
      //       const templateSpans: ts.TemplateSpan[] = [];
      //       let templateHead = '';
      //       let found = false;
      //
      //       while ((match = regex.exec(css)) !== null) {
      //         console.log('Found a match:', match[2]);
      //         console.log('prefix:', match[1]);
      //         found = true;
      //         const prefix = match[1];
      //         const tag = match[2];
      //         const start = match.index + prefix.length;
      //         const end = start + tag.length;
      //
      //         if (templateHead === '') {
      //           templateHead = css.slice(0, start) + tag;
      //         } else {
      //           templateSpans.push(
      //             ts.factory.createTemplateSpan(
      //               ts.factory.createCallExpression(
      //                 ts.factory.createIdentifier('getCustomSuffix'),
      //                 undefined,
      //                 []
      //               ),
      //               ts.factory.createTemplateMiddle(css.slice(lastIndex, start) + tag)
      //             )
      //           );
      //         }
      //         lastIndex = end;
      //       }
      //
      //       if (found) {
      //         templateSpans.push(
      //           ts.factory.createTemplateSpan(
      //             ts.factory.createCallExpression(
      //               ts.factory.createIdentifier('getCustomSuffix'),
      //               undefined,
      //               []
      //             ),
      //             ts.factory.createTemplateTail(css.slice(lastIndex))
      //           )
      //         );
      //         const templateExpr = ts.factory.createTemplateExpression(
      //           ts.factory.createTemplateHead(templateHead),
      //           templateSpans
      //         );
      //         return ts.factory.updateVariableDeclaration(
      //           decl,
      //           decl.name,
      //           decl.exclamationToken,
      //           decl.type,
      //           templateExpr
      //         );
      //       }
      //     }
      //     return decl;
      //   });
      //   newNode = ts.factory.updateVariableStatement(
      //     node,
      //     node.modifiers,
      //     ts.factory.updateVariableDeclarationList(node.declarationList, decls)
      //   );
      // }

      return ts.visitEachChild(newNode, visit, context);
    }
    return ts.visitNode(newSourceFile, visit) as ts.SourceFile;
  };
  }
}
