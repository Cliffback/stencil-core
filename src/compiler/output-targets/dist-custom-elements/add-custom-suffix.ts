import ts from 'typescript';

export function addCustomSuffix(context: ts.TransformationContext): ts.Transformer<ts.SourceFile> {
  return (rootNode: ts.SourceFile): ts.SourceFile => {
    const runtimeFunction = ts.factory.createFunctionDeclaration(
      undefined,
      undefined,
      'getCustomSuffix',
      undefined,
      [],
      undefined,
      ts.factory.createBlock([
        ts.factory.createReturnStatement(ts.factory.createStringLiteral('-test'))
      ]),
    );
    const newSourceFile = ts.factory.updateSourceFile(
      rootNode,
      [
        ...rootNode.statements,
        runtimeFunction,
      ],
    );

    function visit(node: ts.Node): ts.Node {
      let newNode: ts.Node = node;

      // Find all instances of `h('stn-')` and replace them with `h('stn-' + getCustomSuffix())`
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'h') {
        const componentName = node.arguments[0]
        if (ts.isStringLiteral(componentName) && componentName.text.startsWith('stn-')) {
          const customTagNameExpression = ts.factory.createBinaryExpression(
            ts.factory.createStringLiteral(componentName.text),
            ts.SyntaxKind.PlusToken,
            ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
          );


          newNode = ts.factory.updateCallExpression(
            node,
            node.expression,
            node.typeArguments,
            [
              customTagNameExpression,
              ...node.arguments.slice(1)
            ]
          );
        }
      }
      // Find all instances of `document.querySelector('stn-')` and replace them with `document.querySelector('stn-' + getCustomSuffix())`
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const methodName = node.expression.name.text;
        if ((methodName === 'querySelector' || methodName === 'querySelectorAll') && node.arguments.length > 0) {
          const selectorArgument = node.arguments[0];

          if (ts.isStringLiteral(selectorArgument) && selectorArgument.text.startsWith('stn-')) {
            const selectorText = selectorArgument.text;

            const match = selectorText.match(/^(stn-[a-zA-Z0-9-]+)([^a-zA-Z0-9-].*)?$/);
            if (match) {
              const baseSelector = match[1];
              const rest = match[2] || '';

              const customTagNameExpression =
                ts.factory.createTemplateExpression(
                  ts.factory.createTemplateHead(baseSelector),
                  [
                    ts.factory.createTemplateSpan(
                    ts.factory.createCallExpression(ts.factory.createIdentifier('getCustomSuffix'), undefined, []),
                      ts.factory.createTemplateTail(rest)
                    )
                  ]
                );
              newNode = ts.factory.updateCallExpression(
                node,
                node.expression,
                node.typeArguments,
                [customTagNameExpression, ...node.arguments.slice(1)]
              );
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
              ts.factory.createCallExpression(
                ts.factory.createIdentifier('getCustomSuffix'),
                undefined,
                []
              )
            );

            newNode = ts.factory.updateCallExpression(
              node,
              node.expression,
              node.typeArguments,
              [newArgument, ...restArgs]
            );
          }
        }
      }

      return ts.visitEachChild(newNode, visit, context);
    }
    return ts.visitNode(newSourceFile, visit) as ts.SourceFile;
  };
}

