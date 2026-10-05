import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { downloadSinglePhoto } from '../utils/downloadZip';

const SWIPE_THRESHOLD = 60;

/**
 * Lightbox galeri serius:
 * - swipe kiri/kanan (HP), keyboard (desktop), panah, strip thumbnail
 * - pinch-zoom + double-tap zoom + scroll zoom (foto), counter, download per foto
 *
 * @param {{url: string, mediaType?: 'image'|'video', filename?: string}[]} items
 */
const Lightbox = ({ items = [], index = 0, onClose, onIndex }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragX, setDragX] = useState(0); // live swipe offset saat zoom 1
  const [isDownloading, setIsDownloading] = useState(false);
  const containerRef = useRef(null);
  const gesture = useRef(null);
  const lastTap = useRef(0);

  const current = items[index];
  const isVideo = current?.mediaType === 'video';

  const goTo = useCallback((next) => {
    if (items.length === 0) return;
    const wrapped = (next + items.length) % items.length;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragX(0);
    onIndex(wrapped);
  }, [items.length, onIndex]);

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  // Reset zoom saat pindah foto
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setDragX(0);
  }, [index]);

  // Keyboard (desktop)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, prev, next]);

  // Kunci scroll body selama lightbox terbuka
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  // Double-tap / double-click: toggle zoom 1x <-> 2.5x
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !isVideo) {
      if (zoom > 1) {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      } else {
        setZoom(2.5);
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  // Gesture sentuh: swipe (zoom 1) / pan (zoom > 1) / pinch-zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        gesture.current = {
          mode: 'swipe',
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          baseOffset: { ...offsetRef.current },
        };
      } else if (e.touches.length === 2) {
        gesture.current = {
          mode: 'pinch',
          startDist: dist(e.touches[0], e.touches[1]),
          startZoom: zoomRef.current,
        };
      }
    };

    const onTouchMove = (e) => {
      const g = gesture.current;
      if (!g) return;
      if (g.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const ratio = dist(e.touches[0], e.touches[1]) / g.startDist;
        setZoom(Math.min(4, Math.max(1, g.startZoom * ratio)));
      } else if (g.mode === 'swipe' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - g.startX;
        const dy = e.touches[0].clientY - g.startY;
        if (zoomRef.current > 1 && !isVideoRef.current) {
          // Pan saat zoom: cegah scroll browser
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) e.preventDefault();
          setOffset({
            x: g.baseOffset.x + dx,
            y: g.baseOffset.y + dy,
          });
        } else if (!isVideoRef.current && Math.abs(dx) > Math.abs(dy)) {
          // Swipe horizontal saat zoom 1: media mengikuti jari
          if (Math.abs(dx) > 8) e.preventDefault();
          setDragX(dx);
        }
      }
    };

    const onTouchEnd = (e) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.mode !== 'swipe' || e.touches.length !== 0) return;
      if (zoomRef.current > 1) {
        // Jepit pan agar tidak lepas jauh
        setOffset(prev => ({
          x: Math.max(-220, Math.min(220, prev.x)),
          y: Math.max(-220, Math.min(220, prev.y)),
        }));
        return;
      }
      if (isVideoRef.current) { setDragX(0); return; }
      if (dragXRef.current <= -SWIPE_THRESHOLD) nextRef.current();
      else if (dragXRef.current >= SWIPE_THRESHOLD) prevRef.current();
      setDragX(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Ref mirror untuk handler sentuh (hindari closure basi)
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const dragXRef = useRef(dragX);
  dragXRef.current = dragX;
  const isVideoRef = useRef(isVideo);
  isVideoRef.current = isVideo;
  const nextRef = useRef(next);
  nextRef.current = next;
  const prevRef = useRef(prev);
  prevRef.current = prev;

  // Scroll mouse (desktop): zoom foto (body sudah dikunci, tak perlu preventDefault)
  const handleWheel = (e) => {
    if (isVideo) return;
    setZoom(z => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.25 : -0.25))));
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (!current || isDownloading) return;
    try {
      setIsDownloading(true);
      const fallbackName = `media-${index + 1}.${current.mediaType === 'video' ? 'mp4' : 'jpg'}`;
      await downloadSinglePhoto(current.url, current.filename || fallbackName);
    } catch (err) {
      console.error('Download gagal:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/95 flex flex-col animate-fade-in"
      onClick={onClose}
    >
      {/* Bar atas: counter + download + tutup */}
      <div className="flex items-center justify-between px-4 py-3" onClick={e => e.stopPropagation()}>
        <p className="text-white/80 text-sm font-medium">
          {index + 1} / {items.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            title="Download foto ini"
          >
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Tutup"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Area media */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center overflow-hidden px-12 sm:px-16"
        onClick={e => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {isVideo ? (
          <video
            key={current.url}
            src={current.url}
            className="max-w-full max-h-full rounded-lg"
            controls
            autoPlay
            playsInline
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div
            className="max-w-full max-h-full flex items-center justify-center"
            style={{
              transform: `translate(${offset.x + (zoom === 1 ? dragX : 0)}px, ${offset.y}px) scale(${zoom})`,
              transition: gesture.current ? 'none' : 'transform 0.2s ease-out',
              opacity: zoom === 1 && Math.abs(dragX) > 40 ? 1 - Math.min(0.4, Math.abs(dragX) / 400) : 1,
              touchAction: 'none',
            }}
            onClick={handleTap}
          >
            <img
              key={current.url}
              src={current.url}
              alt={`Media ${index + 1}`}
              className="max-w-full max-h-[62vh] sm:max-h-[68vh] object-contain rounded-lg select-none"
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Strip thumbnail */}
      {items.length > 1 && (
        <div
          className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3 justify-start sm:justify-center"
          onClick={e => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={item.url + i}
              onClick={() => goTo(i)}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === index ? 'border-white scale-105' : 'border-transparent opacity-50 hover:opacity-90'
              }`}
            >
              {item.mediaType === 'video' ? (
                <video src={item.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lightbox;
