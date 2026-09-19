/* ╔══════════════════════════════════════════════════════════════════╗
   ║  GLOBALS — the bridge from module scope back to window            ║
   ║                                                                   ║
   ║  Every module ends by calling publish() with its own top-level    ║
   ║  names. That is not a step backwards from modules; it is what     ║
   ║  makes the conversion possible at all.                            ║
   ║                                                                   ║
   ║  This app drives itself from inline handlers — onclick="AS.go()", ║
   ║  thousands of them, written into HTML strings all over the code   ║
   ║  base. An inline handler is compiled against the GLOBAL scope. It ║
   ║  cannot see a module's bindings, and no import statement can help ║
   ║  it. Rewriting every one of them to addEventListener is a real    ║
   ║  project; it is not a prerequisite for getting module scope.      ║
   ║                                                                   ║
   ║  So the names still land on the global object. What changed is    ║
   ║  where they live FIRST:                                           ║
   ║                                                                   ║
   ║    before   one shared lexical scope. A second `const CV` was a   ║
   ║             SyntaxError, and the browser threw away the entire    ║
   ║             file that declared it second. The feature vanished,   ║
   ║             and the console blamed nothing in particular. This    ║
   ║             project lost CMD, then CM, then CV that way.          ║
   ║                                                                   ║
   ║    now      each file has its own scope, so nothing is discarded. ║
   ║             A clash is one module overwriting another's global,   ║
   ║             and the warning below names both files.               ║
   ║                                                                   ║
   ║  A silent overwrite is still a bug — but it is a bug where the    ║
   ║  code runs and something tells you. That is the whole trade.      ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/* Who published what, so a clash can name the file that got there
   first rather than just the symbol. */
const owner = new Map();

/* `names` maps a name to a thunk returning it. Thunks, because the list
   each module publishes is produced by scanning its source, and scanning
   over-collects: a line inside a template literal can look exactly like a
   top-level declaration. Reading such a name directly would throw a
   ReferenceError, and in a module graph one throw stops every other
   module from evaluating. A thunk that fails is just skipped. */
export function publish(moduleName, names) {
  for (const key of Object.keys(names)) {
    let value;
    try { value = names[key](); }
    catch (e) { continue; }                 // not a real binding — scanned out of a string
    const had = owner.get(key);

    if (had && had.module !== moduleName && had.value !== value) {
      console.warn(
        `[globals] "${key}" is declared in two modules — ${moduleName} has ` +
        `overwritten the one from ${had.module}. Both still load; whichever ` +
        `is imported later in boot.js wins. Rename one.`
      );
    }

    owner.set(key, { module: moduleName, value });
    globalThis[key] = value;
  }
}

/* For a quick audit from the console: which module owns a global, and
   what has been published in total. */
export function ownerOf(key) { const o = owner.get(key); return o ? o.module : null; }
export function published() { return [...owner.keys()].sort(); }

globalThis.__globals = { ownerOf, published };
