import { memo, useEffect, useRef, useState } from "react";
import type { ChatMsg } from "../types";
import { ChatMinimap } from "./ChatMinimap";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const TOOL_ICON: Record<string, string> = {
  read: "📄",
  grep: "🔍",
  ls: "📁",
  find: "🔎",
  bash: "⚡",
  edit: "✏️",
  write: "📝",
  gh: "🐙",
  web_search: "🌐",
  agent: "🤖",
  mcp: "🔌",
};

function Avatar({ role }: { role: "user" | "agent" }) {
  if (role === "user") {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm">
        我
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm shrink-0 shadow-sm">
      🤖
    </div>
  );
}

/* ────────── 单条消息：IntersectionObserver 懒渲染 ────────── */
/* 视口外只渲染一个按内容预估高度的占位 div（不解析 markdown、不建重型 DOM），
   进入视口缓冲区后才渲染真实内容，且渲染后不回收（滚动平滑）。
   minimap 测量根 div 高度：占位时是预估、渲染后是真实，均成立。 */
const MessageItem = memo(function MessageItem({
  msg: m,
  scrollRef,
}: {
  msg: ChatMsg;
  scrollRef: { current: HTMLDivElement | null };
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const root = scrollRef.current;
    if (!el) return;
    // 拿不到滚动容器（极端情况）直接渲染，避免空白
    if (!root) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect(); // 渲染一次后不再回收
        }
      },
      { root, rootMargin: "1500px 0px", threshold: 0 }, // 上下各预留 ~2 屏缓冲
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRef]);

  // 预估占位高度（按文本量），让 minimap / 滚动条在未渲染时也大致准确
  const textLen = (m.text?.length || 0) + (m.thinking?.length || 0);
  const estimate = Math.min(900, Math.max(64, 50 + textLen * 0.28));

  return (
    <div
      ref={ref}
      data-mm
      data-role={m.role}
      className={`flex gap-2.5 md:gap-3 animate-fadeup ${
        m.role === "user" ? "flex-row-reverse" : ""
      }`}
      style={visible ? undefined : { minHeight: estimate }}
    >
      {visible && (
        <>
          <Avatar role={m.role} />
          <div className="max-w-[85%] md:max-w-[82%] min-w-0">
            <div
              className={`px-4 py-3 rounded-2xl shadow-sm ${
                m.role === "user"
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-tr-md"
                  : m.error
                  ? "bg-red-50 border border-red-200 text-red-900 rounded-tl-md"
                  : "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
              }`}
            >
              {/* 错误 / 中止提示 */}
              {m.error && (
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-base leading-none">⚠️</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-red-700">请求失败</div>
                    <pre className="mt-1 text-[11px] whitespace-pre-wrap break-all text-red-600 max-h-40 overflow-auto bg-red-100/70 rounded p-2">{m.error}</pre>
                  </div>
                </div>
              )}
              {m.aborted && !m.text && (
                <div className="text-sm text-slate-400 flex items-center gap-1.5">⊘ 已中止</div>
              )}
              {/* 工具调用 */}
              {m.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {m.tools.map((t, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium ${
                        t.isError
                          ? "bg-red-100 text-red-600"
                          : m.role === "user"
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {TOOL_ICON[t.name] ?? "🔧"} {t.name}
                      {t.isError ? " ✗" : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* 思考过程 */}
              {m.thinking && (
                <details
                  className={`mb-2 text-[12px] rounded-lg p-2 ${
                    m.role === "user" ? "bg-white/10" : "bg-slate-50"
                  }`}
                >
                  <summary
                    className={`cursor-pointer select-none flex items-center gap-1 ${
                      m.role === "user" ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    💭 思考过程
                  </summary>
                  <div
                    className={`whitespace-pre-wrap mt-1.5 italic leading-relaxed max-h-60 overflow-auto ${
                      m.role === "user" ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    {m.thinking}
                  </div>
                </details>
              )}

              {/* 正文 */}
              {m.text && (
                <div
                  className={`text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-headings:mb-1 prose-code:before:content-none prose-code:after:content-none ${
                    m.role === "user"
                      ? "prose-invert prose-code:text-indigo-100 prose-code:bg-white/15 prose-code:px-1 prose-code:rounded"
                      : "prose-slate prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1 prose-code:rounded prose-pre:bg-slate-800 prose-pre:text-slate-100"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node: _n, ...props }) => (
                        <div className="overflow-x-auto -mx-1 px-1 pb-1">
                          <table {...props} />
                        </div>
                      ),
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export const ChatWindow = memo(function ChatWindow({ msgs }: { msgs: ChatMsg[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  // 切换会话时回到顶部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [msgs]);

  // 监听滚动，更新是否在顶部/底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setAtTop(el.scrollTop < 4);
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    const content = el.firstElementChild;
    if (content) ro.observe(content);
    update();
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef]);

  return (
    <div className="flex-1 flex min-h-0 relative">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-3 md:px-6 xl:px-10 py-4 md:py-6">
          <div className="space-y-3.5">
            {msgs.map((m) => (
              <MessageItem key={m.id} msg={m} scrollRef={scrollRef} />
            ))}
          </div>
        </div>
      </div>
      <ChatMinimap
        scrollRef={scrollRef}
        className="hidden lg:block w-12 shrink-0 border-l border-slate-200 bg-slate-50/70"
      />
      {/* 回到顶部 / 底部 */}
      <div className="absolute bottom-4 right-4 lg:right-16 flex flex-col gap-1.5 z-10">
        {!atTop && (
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            title="回到顶部"
            className="w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
        {!atBottom && (
          <button
            onClick={() =>
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
            }
            title="回到底部"
            className="w-9 h-9 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
