// ==============================================================================
// BusinessBrain: Prism Global Runtime Initializer
// Ensures Prism instance is bound to globalThis / window before any grammar IIFE loads
// ==============================================================================

import Prism from "prismjs";

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
}
if (typeof window !== "undefined") {
  (window as unknown as { Prism: typeof Prism }).Prism = Prism;
}

export default Prism;
