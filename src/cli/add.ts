import { findProjectRoot, detectLang } from '../utils/paths.js';
import { generateCommandSnippet } from '../generators/snippets/command.js';
import { generateButtonSnippet } from '../generators/snippets/button.js';
import { generateModalSnippet } from '../generators/snippets/modal.js';
import { generateSelectSnippet } from '../generators/snippets/select.js';
import { generateEventSnippet } from '../generators/snippets/event.js';
import { generateAutocompleteSnippet } from '../generators/snippets/autocomplete.js';
import { generateContextSnippet } from '../generators/snippets/context.js';
import { generateErlcModule } from '../generators/erlc.js';
import { erlcFlow } from '../prompts/erlcFlow.js';
import { log } from '../utils/logger.js';
import type { ComponentType, CommandSubtype, ContextSubtype } from '../types.js';

interface AddOptions {
  type?: string; // for 'command' type: 'slash' | 'prefix'
  option?: string;
}

export async function handleAdd(
  componentType: ComponentType,
  name: string,
  opts: AddOptions
): Promise<void> {
  const projectRoot = await findProjectRoot();
  if (!projectRoot) {
    log.error('Not inside a djskit project. Run this command from your project root (where src/commands/ exists).');
    process.exit(1);
  }

  const lang = await detectLang(projectRoot);

  if (componentType === 'command') {
    const commandSubtype = (opts.type ?? 'slash') as CommandSubtype;
    if (commandSubtype !== 'slash' && commandSubtype !== 'prefix') {
      log.error(`Invalid command type "${opts.type}". Must be "slash" or "prefix".`);
      process.exit(1);
    }
    await generateCommandSnippet(name, commandSubtype, lang, projectRoot);
  } else if (componentType === 'button') {
    await generateButtonSnippet(name, lang, projectRoot);
  } else if (componentType === 'modal') {
    await generateModalSnippet(name, lang, projectRoot);
  } else if (componentType === 'select') {
    await generateSelectSnippet(name, lang, projectRoot);
  } else if (componentType === 'event') {
    await generateEventSnippet(name, lang, projectRoot);
  } else if (componentType === 'autocomplete') {
    if (!opts.option) {
      log.error('Autocomplete generation requires an option name.');
      process.exit(1);
    }
    await generateAutocompleteSnippet(name, opts.option, lang, projectRoot);
  } else if (componentType === 'context') {
    const contextSubtype = (opts.type ?? 'user') as ContextSubtype;
    if (contextSubtype !== 'user' && contextSubtype !== 'message') {
      log.error(`Invalid context type "${opts.type}". Must be "user" or "message".`);
      process.exit(1);
    }
    await generateContextSnippet(name, contextSubtype, lang, projectRoot);
  } else if (componentType === 'erlc') {
    const options = await erlcFlow({ projectRoot });
    await generateErlcModule(projectRoot, { lang, options });
  }
}
