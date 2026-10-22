import React, { useCallback, useRef } from 'react';
import { postToPlugin } from '../utils/messaging';

interface ResizeHandleProps {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  minWidth = 340,
  minHeight = 460,
  maxWidth = 1000,
  maxHeight = 1200,
}) => {
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: window.innerWidth,
      h: window.innerHeight,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(startPosRef.current.w + dx)));
      const newHeight = Math.max(minHeight, Math.min(maxHeight, Math.round(startPosRef.current.h + dy)));

      postToPlugin({
        type: 'RESIZE',
        width: newWidth,
        height: newHeight,
      });
    },
    [minWidth, minHeight, maxWidth, maxHeight]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="Drag to resize plugin window"
      className="fixed bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 opacity-30 hover:opacity-100 transition-opacity select-none touch-none"
    >
      <svg
        className="w-2.5 h-2.5 text-neutral-400"
        viewBox="0 0 10 10"
        fill="currentColor"
      >
        <circle cx="8" cy="8" r="1" />
        <circle cx="4" cy="8" r="1" />
        <circle cx="8" cy="4" r="1" />
      </svg>
    </div>
  );
};
