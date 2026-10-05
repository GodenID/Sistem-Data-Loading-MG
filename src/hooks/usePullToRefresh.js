import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL = 120;

/**
 * Pull-to-refresh untuk scroll halaman (window). Khusus sentuhan (HP):
 * tarik ke bawah saat posisi paling atas -> panggil onRefresh.
 * Mengembalikan { pull, refreshing } untuk indikator visual.
 */
export const usePullToRefresh = (onRefresh, enabled = true) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const refreshingRef = useRef(false);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (!enabledRef.current || refreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      gesture.current = { startY: e.touches[0].clientY };
    };

    const onTouchMove = (e) => {
      const g = gesture.current;
      if (!g) return;
      if (window.scrollY > 0) {
        gesture.current = null;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - g.startY;
      if (dy > 0) {
        // Tahan scroll browser agar indikator terlihat (khusus fase tarik)
        if (dy > 12) e.preventDefault();
        setPull(Math.min(dy * 0.6, MAX_PULL));
      } else {
        setPull(0);
      }
    };

    const onTouchEnd = async () => {
      const p = pullRef.current;
      gesture.current = null;
      if (p >= THRESHOLD && enabledRef.current && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(0);
        try {
          await onRefreshRef.current?.();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const pullRef = useRef(pull);
  pullRef.current = pull;

  return { pull, refreshing };
};
