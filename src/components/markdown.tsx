import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({
  content,
  className,
  size = "sm",
}: {
  content: string;
  className?: string;
  size?: "sm" | "xs";
}) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-pre:overflow-x-auto prose-pre:bg-surface-secondary prose-code:before:content-none prose-code:after:content-none",
        size === "xs" &&
          "prose-p:text-[13px] prose-li:text-[13px] prose-strong:text-[13px] prose-a:text-[13px] prose-th:text-[13px] prose-td:text-[13px] prose-code:text-[12px] prose-pre:text-[12px] prose-h3:text-base prose-h4:text-[15px] prose-h5:text-sm",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
