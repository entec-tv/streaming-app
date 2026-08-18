import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Global spatial navigation engine for the Web/Electron platform.
 * 
 * Uses edge-to-edge distance calculations and overlap detection to ensure
 * arrow keys navigate in the correct geometric direction at all times.
 * 
 * Algorithm:
 *  1. Collect all visible focusable elements with tabindex (excluding -1).
 *  2. Filter to only those in the pressed arrow direction (edge-based check).
 *  3. Score candidates: elements that overlap on the orthogonal axis (same row
 *     for left/right, same column for up/down) get the best score. Otherwise,
 *     a heavy penalty is applied for being off-axis.
 *  4. Focus the best candidate and scroll it into view.
 */
export function useSpatialNavigationWeb() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') return;

      const active = document.activeElement as HTMLElement;
      if (!active || active === document.body) return;

      // Don't interfere with text cursor movement inside inputs, or native video controls
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable || active.tagName === 'VIDEO') {
        return;
      }

      // Gather all visible focusable elements
      const all = document.querySelectorAll<HTMLElement>('[tabindex]');
      const candidates: HTMLElement[] = [];

      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el === active) continue;
        if (el.getAttribute('tabindex') === '-1') continue;

        // Skip ancestor/descendant pairs — only target leaf-level focusables
        if (el.contains(active) || active.contains(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        // Quick visibility check
        if ((el as any).offsetParent === null && el.style.position !== 'fixed') continue;
        
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.opacity === '0') continue;

        candidates.push(el);
      }

      if (candidates.length === 0) return;

      const src = active.getBoundingClientRect();
      let bestEl: HTMLElement | null = null;
      let minScore = Infinity;

      for (const dst of candidates) {
        const dstRect = dst.getBoundingClientRect();
        
        // Calculate centers
        const dstCx = dstRect.left + dstRect.width / 2;
        const dstCy = dstRect.top + dstRect.height / 2;
        const srcCx = src.left + src.width / 2;
        const srcCy = src.top + src.height / 2;

        const dx = dstCx - srcCx;
        const dy = dstCy - srcCy;

        if (dx === 0 && dy === 0) continue;

        let isDirectional = false;
        
        // 180-degree half-planes: as long as it's in the correct general direction, consider it.
        if (key === 'ArrowRight' && dx > 0) isDirectional = true;
        else if (key === 'ArrowLeft' && dx < 0) isDirectional = true;
        else if (key === 'ArrowDown' && dy > 0) isDirectional = true;
        else if (key === 'ArrowUp' && dy < 0) isDirectional = true;

        if (isDirectional) {
          // Weight the orthogonal axis heavily so it prefers straight lines,
          // but gracefully falls back to diagonal/far items if they are the only ones available.
          let primaryAxisDist = 0;
          let orthogonalAxisDist = 0;

          if (key === 'ArrowRight' || key === 'ArrowLeft') {
            primaryAxisDist = Math.abs(dx);
            orthogonalAxisDist = Math.abs(dy);
          } else {
            primaryAxisDist = Math.abs(dy);
            orthogonalAxisDist = Math.abs(dx);
          }

          // Score: primary distance + strongly penalized orthogonal distance
          const score = primaryAxisDist + (orthogonalAxisDist * 4);
          
          if (score < minScore) {
            minScore = score;
            bestEl = dst;
          }
        }
      }

      if (bestEl) {
        e.preventDefault();
        e.stopImmediatePropagation();
        bestEl.focus({ preventScroll: true });
        bestEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
