import { useEffect, useState } from 'react';
import {
  CANVAS_MIN,
  DEFAULT_PREVIEW_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  PREVIEW_MAX,
  PREVIEW_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from '../constants/layout';
import { clamp } from '../utils/helpers';

/**
 * Lebar & visibilitas sidebar/preview, plus logika drag-resize.
 * containerRef = elemen area utama (dipakai untuk menghitung batas lebar).
 */
export function usePanelResize(containerRef) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const [resizeTarget, setResizeTarget] = useState(null); // null | 'sidebar' | 'preview'

  // Listener hanya dipasang selama drag aktif dan selalu dibersihkan (termasuk saat unmount)
  useEffect(() => {
    if (!resizeTarget) return;

    const handleMouseMove = (e) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (resizeTarget === 'sidebar') {
        const otherWidth = isPreviewVisible ? previewWidth : 0;
        const max = Math.min(SIDEBAR_MAX, rect.width - otherWidth - CANVAS_MIN);
        setSidebarWidth(clamp(e.clientX - rect.left, SIDEBAR_MIN, max));
      } else {
        const otherWidth = isSidebarVisible ? sidebarWidth : RAIL_WIDTH;
        const max = Math.min(PREVIEW_MAX, rect.width - otherWidth - CANVAS_MIN);
        setPreviewWidth(clamp(rect.right - e.clientX, PREVIEW_MIN, max));
      }
    };

    const stopResize = () => setResizeTarget(null);

    // Kunci kursor & cegah seleksi teks selama drag, walau pointer keluar dari handle
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
    window.addEventListener('blur', stopResize);

    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
      window.removeEventListener('blur', stopResize);
    };
  }, [containerRef, resizeTarget, isSidebarVisible, isPreviewVisible, sidebarWidth, previewWidth]);

  const startResize = (target) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setResizeTarget(target);
  };

  const resetWidth = (target) => () => {
    if (target === 'sidebar') setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    else setPreviewWidth(DEFAULT_PREVIEW_WIDTH);
  };

  return {
    sidebar: {
      visible: isSidebarVisible,
      width: sidebarWidth,
      toggle: () => setIsSidebarVisible((v) => !v),
    },
    preview: {
      visible: isPreviewVisible,
      width: previewWidth,
      toggle: () => setIsPreviewVisible((v) => !v),
    },
    resizeTarget,
    isResizing: resizeTarget !== null,
    startResize,
    resetWidth,
    // Animasi dimatikan selama drag supaya lebar mengikuti kursor tanpa lag
    panelTransition: resizeTarget ? 'none' : 'width 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
  };
}
