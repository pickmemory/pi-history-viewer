import { useCallback, useEffect, useRef, useState } from "react";

/**
 * VSCode 风格的聊天 minimap：
 * - 把主滚动区里每条消息（[data-mm][data-role]）按实际高度等比缩略成色条
 * - 半透明 viewport 框标示当前可视区，随滚动实时移动
 * - 点击 / 拖拽 minimap 可快速跳转到对应位置
 */
interface MmBlock {
  role: string;
  top: number;
  height: number;
}

interface MmData {
  blocks: MmBlock[];
  total: number;
  mmH: number;
}

export function ChatMinimap({
  scrollRef,
  className = "",
}: {
  scrollRef: { current: HTMLDivElement | null };
  className?: string;
}) {
  const mmRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MmData>({ blocks: [], total: 1, mmH: 1 });
  const draggingRef = useRef(false);

  const updateView = useCallback(() => {
    const scroll = scrollRef.current;
    const mm = mmRef.current;
    const view = viewRef.current;
    if (!scroll || !mm || !view) return;
    const scale = mm.clientHeight / scroll.scrollHeight;
    view.style.transform = `translateY(${scroll.scrollTop * scale}px)`;
    view.style.height = `${Math.max(scroll.clientHeight * scale, 16)}px`;
  }, [scrollRef]);

  const recompute = useCallback(() => {
    const scroll = scrollRef.current;
    const mm = mmRef.current;
    if (!scroll || !mm) return;
    const content = scroll.firstElementChild as HTMLElement | null;
    if (!content) return;
    const cRect = content.getBoundingClientRect();
    const els = content.querySelectorAll<HTMLElement>("[data-mm]");
    const blocks: MmBlock[] = Array.from(els).map((e) => {
      const r = e.getBoundingClientRect();
      return {
        role: e.dataset.role || "agent",
        top: r.top - cRect.top,
        height: r.height || 1,
      };
    });
    setData({ blocks, total: scroll.scrollHeight, mmH: mm.clientHeight });
    updateView();
  }, [scrollRef, updateView]);

  useEffect(() => {
    recompute();
    const scroll = scrollRef.current;
    const content = scroll?.firstElementChild as HTMLElement | null;
    if (!scroll || !content) return;

    let scrollRaf = 0;
    const onScroll = () => {
      if (!scrollRaf)
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          updateView();
        });
    };
    scroll.addEventListener("scroll", onScroll, { passive: true });

    let recRaf = 0;
    const scheduleRecompute = () => {
      if (recRaf) return;
      recRaf = requestAnimationFrame(() => {
        recRaf = 0;
        recompute();
      });
    };
    const ro = new ResizeObserver(scheduleRecompute);
    ro.observe(scroll);
    ro.observe(content);
    const mm = mmRef.current;
    if (mm) ro.observe(mm);
    const mo = new MutationObserver(scheduleRecompute);
    mo.observe(content, { childList: true, subtree: true });

    return () => {
      scroll.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      if (recRaf) cancelAnimationFrame(recRaf);
    };
  }, [recompute, updateView, scrollRef]);

  const scrollToY = (clientY: number) => {
    const scroll = scrollRef.current;
    const mm = mmRef.current;
    if (!scroll || !mm) return;
    const r = mm.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientY - r.top) / r.height, 0), 1);
    const target = ratio * scroll.scrollHeight - scroll.clientHeight / 2;
    scroll.scrollTo({ top: Math.max(0, target) });
  };

  const scale = data.mmH / data.total;

  return (
    <div
      ref={mmRef}
      className={`relative overflow-hidden cursor-pointer select-none ${className}`}
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        scrollToY(e.clientY);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) scrollToY(e.clientY);
      }}
      onPointerUp={() => (draggingRef.current = false)}
      onPointerCancel={() => (draggingRef.current = false)}
      title="拖动或点击快速跳转"
    >
      {data.blocks.map((b, i) => {
        const top = b.top * scale;
        const h = Math.max(b.height * scale, b.role === "user" ? 3 : 2);
        return (
          <div
            key={i}
            className="absolute rounded-[2px]"
            style={{
              top,
              height: h,
              left: b.role === "user" ? "45%" : "8%",
              right: b.role === "user" ? "12%" : "8%",
              background:
                b.role === "user"
                  ? "rgba(99,102,241,0.6)"
                  : "rgba(100,116,139,0.4)",
            }}
          />
        );
      })}
      <div
        ref={viewRef}
        className="absolute left-0 right-0 bg-indigo-400/15 border-y border-indigo-400/40 pointer-events-none"
        style={{ height: 16, transform: "translateY(0px)" }}
      />
    </div>
  );
}
