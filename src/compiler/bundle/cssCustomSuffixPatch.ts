import postcss from "postcss";
import postcssSafeParser from 'postcss-safe-parser';

import type * as d from '../../declarations';

export function myCustomCssModifierPlugin(config: d.ValidatedConfig) {
  return {
    name: 'custom-css-modifier',
    async generateBundle(_options: unknown, bundle: Record<string, { type: string; code?: string }>) {
      // The closest identifiation I've found that we are building the dist-custom-elements target
      if ((_options as { entryFileNames?: string })?.entryFileNames !== '[name].js') return;
      if (!config.extras?.tagNameTransform) return;

      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];
        if (chunk && chunk.type === 'chunk' && typeof chunk.code === 'string' && /^[^.]+\.js$/.test(fileName)) {
          // Find all const <name>Css = `...`;
          const regex = /const\s+(\w+Css)\s*=\s*"([^"]*)"/g;
          let match: RegExpExecArray | [unknown, unknown, unknown] | null;
          let newCode = chunk.code;

          // Log component tag names if found in the file
          const compRegex = /const\s+components\s*=\s*\[([^\]]*)\]/;
          const compMatch = compRegex.exec(newCode);
          const allTagNames: string[] = [];
          if (typeof compMatch?.[1] === 'string' && compMatch[1].trim() !== '') {
            const tagNames = compMatch[1]
              .split(',')
              .map(s => s.trim().replace(/['"`]/g, ''))
              .filter(Boolean);
            allTagNames.push(...tagNames);
          }

          if (allTagNames.length > 0) {
            console.log('Component tag names:', allTagNames);
            console.log(`Processing file: ${fileName}`);
            while ((match = regex.exec(chunk.code)) !== null) {
              const [fullMatch, varName, cssString] = match;
              console.log(`Found variable: ${varName}`);
              // console.log(`CSS String: ${cssString}`);
              // Parse and transform CSS
              const result = await postcss([
                // Example: plugin to add suffix to all selectors
                (root: postcss.Root) => {
                  root.walkRules(rule => {
                    rule.selectors = rule.selectors.map(sel => (allTagNames.includes(sel) && /^[a-z][a-z0-9-]*$/i.test(sel) ? sel + '${getCustomSuffix()}' : sel));
                  });
                },
              ]).process(cssString, { parser: postcssSafeParser, from: undefined });
              // Replace the original CSS string with the transformed one
              const newCss = result.root.toString();
              newCode = newCode.replace(fullMatch, `const ${varName} = \`${newCss}\``);
            }
            chunk.code = newCode;
          }
        }
      }
    },
  };
}

