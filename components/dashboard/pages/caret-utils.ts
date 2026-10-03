/**
 * Utility to reliably position the selection caret at the end of a contentEditable element.
 */
export function setCaretToEnd(el: HTMLElement) {
  if (typeof window === "undefined" || !el) return;

  el.focus();
  const sel = window.getSelection();
  if (!sel) return;

  function getLastTextNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) return node;
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i];
      const text = getLastTextNode(child);
      if (text) return text;
    }
    return null;
  }

  const range = document.createRange();
  const lastText = getLastTextNode(el);

  if (lastText && lastText.textContent !== null && lastText.textContent.length > 0) {
    range.setStart(lastText, lastText.textContent.length);
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Focuses the element and places caret at the end, reinforced with requestAnimationFrame
 * to prevent focus loss from concurrent DOM unmounts or browser blur events.
 */
export function focusBlockCaretEnd(el: HTMLElement) {
  if (typeof window === "undefined" || !el) return;
  setCaretToEnd(el);
  requestAnimationFrame(() => {
    setCaretToEnd(el);
  });
}

