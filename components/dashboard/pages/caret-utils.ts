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

/**
 * Retrieves the current character offset of the caret within a contentEditable element.
 */
export function getCaretOffset(element: HTMLElement): number {
  if (typeof window === "undefined" || !element) return 0;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;

  const range = sel.getRangeAt(0);
  if (!element.contains(range.startContainer)) return 0;

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().length;
}

interface TextNodeMatch {
  node: Node;
  offset: number;
}

function findTextNodeAtOffset(element: Node, targetOffset: number): TextNodeMatch | null {
  let currentOffset = 0;
  let result: TextNodeMatch | null = null;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLen = node.textContent ? node.textContent.length : 0;
      if (currentOffset + textLen >= targetOffset) {
        result = { node, offset: targetOffset - currentOffset };
        return true;
      }
      currentOffset += textLen;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) return true;
      }
    }
    return false;
  }

  walk(element);
  return result;
}

/**
 * Restores the caret to a specific character offset within a contentEditable element.
 */
export function restoreCaretOffset(element: HTMLElement, offset: number) {
  if (typeof window === "undefined" || !element) return;
  const sel = window.getSelection();
  if (!sel) return;

  element.focus();

  const match = findTextNodeAtOffset(element, offset);
  const range = document.createRange();

  if (match && match.node.textContent) {
    const safeOffset = Math.min(match.offset, match.node.textContent.length);
    range.setStart(match.node, safeOffset);
    range.collapse(true);
  } else {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}
