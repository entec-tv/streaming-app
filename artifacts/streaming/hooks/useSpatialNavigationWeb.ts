import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Global spatial navigation engine for Web / Electron (Desktop).
 * Supports "Focus Zones" via data-focus-zone attribute.
 */
export function useSpatialNavigationWeb() {
  const lastFocusedInZone = useRef<Record<string, HTMLElement | null>>({});
  const globalLastActiveZone = useRef<string>('default');
  const globalLastActiveRect = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const getVisibleFocusableCandidates = (activeEl: HTMLElement | null): HTMLElement[] => {
      const all = document.querySelectorAll<HTMLElement>(
        '[tabindex="0"], [tabindex], [data-focusable="true"], [role="button"], button, a[href], input, select, textarea'
      );
      const candidates: HTMLElement[] = [];

      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el === activeEl) continue;
        if (el.getAttribute('tabindex') === '-1' && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') continue;
        if ((el as any).disabled) continue;

        // Allow navigating between parent and child by removing the containment check
        // if (activeEl && (el.contains(activeEl) || activeEl.contains(el))) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        if ((el as any).offsetParent === null && el.style.position !== 'fixed' && el.style.position !== 'absolute') continue;
        
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;

        candidates.push(el);
      }

      return candidates;
    };

    const getZoneForElement = (el: HTMLElement | null): { name: string, el: HTMLElement } | null => {
      if (!el) return null;
      let current: HTMLElement | null = el;
      while (current && current !== document.body) {
        if (current.hasAttribute('data-focus-zone')) {
          return { name: current.getAttribute('data-focus-zone')!, el: current };
        }
        current = current.parentElement;
      }
      return null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const active = document.activeElement as HTMLElement | null;

      if (key === 'Enter') {
        if (active && active !== document.body) {
          if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return;
          e.preventDefault();
          active.click();
          return;
        }
      }

      if (key === 'Escape' || key === 'Backspace') {
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
        const backBtn = document.querySelector<HTMLElement>('[data-back="true"], [aria-label*="Back"], [aria-label*="back"], [aria-label*="رجوع"]');
        if (backBtn) {
          e.preventDefault();
          backBtn.click();
          return;
        }
        if (window.history.length > 1) {
          e.preventDefault();
          window.history.back();
          return;
        }
      }

      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
        return;
      }

      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      const candidates = getVisibleFocusableCandidates(active);
      if (candidates.length === 0) return;

      const activeZoneInfo = getZoneForElement(active);
      const activeZone = activeZoneInfo ? activeZoneInfo.name : 'default';

      if (active) {
        lastFocusedInZone.current[activeZone] = active;
        globalLastActiveZone.current = activeZone;
        globalLastActiveRect.current = active.getBoundingClientRect();
      }

      if (!active || active === document.body || !document.body.contains(active)) {
        let defaultEl: HTMLElement | null = null;
        
        // 1. Try to restore from last known state
        const prevZone = globalLastActiveZone.current;
        const prevEl = lastFocusedInZone.current[prevZone];
        if (prevEl && document.body.contains(prevEl) && candidates.includes(prevEl)) {
           defaultEl = prevEl;
        } else if (globalLastActiveRect.current) {
           // 2. Find closest to last known position in the same zone
           let minDistance = Infinity;
           for (const el of candidates) {
             const zoneInfo = getZoneForElement(el);
             const elZone = zoneInfo ? zoneInfo.name : 'default';
             if (elZone === prevZone) {
               const r = el.getBoundingClientRect();
               const cx = r.left + r.width / 2;
               const cy = r.top + r.height / 2;
               const prevCx = globalLastActiveRect.current.left + globalLastActiveRect.current.width / 2;
               const prevCy = globalLastActiveRect.current.top + globalLastActiveRect.current.height / 2;
               const dist = Math.hypot(cx - prevCx, cy - prevCy);
               if (dist < minDistance) {
                 minDistance = dist;
                 defaultEl = el;
               }
             }
           }
        }
        
        // 3. Fallback to preferred focus
        if (!defaultEl) {
          for (const el of candidates) {
            if (el.hasAttribute('data-preferred-focus') || el.classList.contains('active')) {
              defaultEl = el;
              break;
            }
          }
        }
        // 4. Fallback to top-left
        if (!defaultEl) {
          let minDistance = Infinity;
          for (const el of candidates) {
            const r = el.getBoundingClientRect();
            if (r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) {
              const dist = Math.hypot(r.left, r.top);
              if (dist < minDistance) {
                minDistance = dist;
                defaultEl = el;
              }
            }
          }
        }
        if (!defaultEl) defaultEl = candidates[0];

        if (defaultEl) {
          e.preventDefault();
          e.stopImmediatePropagation();
          
          const zoneInfo = getZoneForElement(defaultEl);
          const elZone = zoneInfo ? zoneInfo.name : 'default';
          lastFocusedInZone.current[elZone] = defaultEl;
          globalLastActiveZone.current = elZone;
          globalLastActiveRect.current = defaultEl.getBoundingClientRect();

          defaultEl.focus({ preventScroll: true });
          defaultEl.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
          setTimeout(() => {
            if (document.activeElement === defaultEl) {
              globalLastActiveRect.current = defaultEl.getBoundingClientRect();
            }
          }, 50);
        }
        return;
      }

      const srcRect = active.getBoundingClientRect();
      const srcCx = srcRect.left + srcRect.width / 2;
      const srcCy = srcRect.top + srcRect.height / 2;

      let bestEl: HTMLElement | null = null;
      let minScore = Infinity;

      // First pass: try to find within the SAME zone
      for (const dst of candidates) {
        const dstZoneInfo = getZoneForElement(dst);
        const dstZone = dstZoneInfo ? dstZoneInfo.name : 'default';

        if (dstZone !== activeZone) continue;

        const dstRect = dst.getBoundingClientRect();
        const dstCx = dstRect.left + dstRect.width / 2;
        const dstCy = dstRect.top + dstRect.height / 2;

        const dx = dstCx - srcCx;
        const dy = dstCy - srcCy;

        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

        let isDirectional = false;
        if (key === 'ArrowRight' && (dstRect.left >= srcRect.right - 20 || (dx > 0 && dx > Math.abs(dy) * 0.5))) isDirectional = true;
        else if (key === 'ArrowLeft' && (dstRect.right <= srcRect.left + 20 || (dx < 0 && Math.abs(dx) > Math.abs(dy) * 0.5))) isDirectional = true;
        else if (key === 'ArrowDown' && (dstRect.top >= srcRect.bottom - 20 || (dy > 0 && dy > Math.abs(dx) * 0.5))) isDirectional = true;
        else if (key === 'ArrowUp' && (dstRect.bottom <= srcRect.top + 20 || (dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.5))) isDirectional = true;

        if (isDirectional) {
          let primaryDist = 0;
          let orthogonalDist = 0;
          let isOrthogonalOverlap = false;

          if (key === 'ArrowRight' || key === 'ArrowLeft') {
            primaryDist = Math.abs(dx);
            orthogonalDist = Math.abs(dy);
            isOrthogonalOverlap = Math.max(srcRect.top, dstRect.top) < Math.min(srcRect.bottom, dstRect.bottom);
          } else {
            primaryDist = Math.abs(dy);
            orthogonalDist = Math.abs(dx);
            isOrthogonalOverlap = Math.max(srcRect.left, dstRect.left) < Math.min(srcRect.right, dstRect.right);
          }

          const penalty = isOrthogonalOverlap ? 1.0 : 4.0;
          const score = primaryDist + (orthogonalDist * penalty);

          if (score < minScore) {
            minScore = score;
            bestEl = dst;
          }
        }
      }

      // Second pass: if nothing found in same zone, try to find the best ADJACENT zone
      if (!bestEl) {
        minScore = Infinity;
        let bestAdjacentZone: string | null = null;
        let bestAdjacentEl: HTMLElement | null = null;

        for (const dst of candidates) {
          const dstZoneInfo = getZoneForElement(dst);
          const dstZone = dstZoneInfo ? dstZoneInfo.name : 'default';

          if (dstZone === activeZone) continue;

          const dstRect = dst.getBoundingClientRect();
          const dstCx = dstRect.left + dstRect.width / 2;
          const dstCy = dstRect.top + dstRect.height / 2;

          const dx = dstCx - srcCx;
          const dy = dstCy - srcCy;

          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

          let isDirectional = false;
          if (key === 'ArrowRight' && (dstRect.left >= srcRect.right - 20 || (dx > 0 && dx > Math.abs(dy) * 0.5))) isDirectional = true;
          else if (key === 'ArrowLeft' && (dstRect.right <= srcRect.left + 20 || (dx < 0 && Math.abs(dx) > Math.abs(dy) * 0.5))) isDirectional = true;
          else if (key === 'ArrowDown' && (dstRect.top >= srcRect.bottom - 20 || (dy > 0 && dy > Math.abs(dx) * 0.5))) isDirectional = true;
          else if (key === 'ArrowUp' && (dstRect.bottom <= srcRect.top + 20 || (dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.5))) isDirectional = true;

          if (isDirectional) {
            let primaryDist = 0;
            let orthogonalDist = 0;
            let isOrthogonalOverlap = false;

            if (key === 'ArrowRight' || key === 'ArrowLeft') {
              primaryDist = Math.abs(dx);
              orthogonalDist = Math.abs(dy);
              isOrthogonalOverlap = Math.max(srcRect.top, dstRect.top) < Math.min(srcRect.bottom, dstRect.bottom);
            } else {
              primaryDist = Math.abs(dy);
              orthogonalDist = Math.abs(dx);
              isOrthogonalOverlap = Math.max(srcRect.left, dstRect.left) < Math.min(srcRect.right, dstRect.right);
            }

            const penalty = isOrthogonalOverlap ? 1.0 : 8.0;
            const score = primaryDist + (orthogonalDist * penalty);

            if (score < minScore) {
              minScore = score;
              bestAdjacentZone = dstZone;
              bestAdjacentEl = dst;
            }
          }
        }

        if (bestAdjacentZone && bestAdjacentEl) {
          const lastEl = lastFocusedInZone.current[bestAdjacentZone];
          if (lastEl && document.body.contains(lastEl) && candidates.includes(lastEl)) {
             bestEl = lastEl;
          } else {
             bestEl = bestAdjacentEl;
          }
        }
      }

      if (bestEl) {
        e.preventDefault();
        e.stopImmediatePropagation();
        
        const bestZoneInfo = getZoneForElement(bestEl);
        const bestElZone = bestZoneInfo ? bestZoneInfo.name : 'default';
        lastFocusedInZone.current[bestElZone] = bestEl;
        globalLastActiveZone.current = bestElZone;
        globalLastActiveRect.current = bestEl.getBoundingClientRect();

        bestEl.focus({ preventScroll: true });
        bestEl.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
        setTimeout(() => {
          if (document.activeElement === bestEl) {
            globalLastActiveRect.current = bestEl.getBoundingClientRect();
          }
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
