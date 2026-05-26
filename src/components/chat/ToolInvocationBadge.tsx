"use client";

import { Loader2, FilePlus, FilePen, Trash2, RefreshCw, FileSearch } from "lucide-react";
import type { ToolInvocation } from "ai";

function getLabel(toolName: string, args: Record<string, unknown>): { icon: React.ReactNode; text: string } {
  const filename = typeof args.path === "string"
    ? args.path.split("/").pop() ?? args.path
    : null;

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":
        return { icon: <FilePlus className="w-3 h-3" />, text: filename ? `Creating ${filename}` : "Creating file" };
      case "str_replace":
      case "insert":
        return { icon: <FilePen className="w-3 h-3" />, text: filename ? `Editing ${filename}` : "Editing file" };
      case "view":
        return { icon: <FileSearch className="w-3 h-3" />, text: filename ? `Reading ${filename}` : "Reading file" };
      default:
        return { icon: <FilePen className="w-3 h-3" />, text: filename ? `Modifying ${filename}` : "Modifying file" };
    }
  }

  if (toolName === "file_manager") {
    switch (args.command) {
      case "rename":
        return { icon: <RefreshCw className="w-3 h-3" />, text: filename ? `Renaming ${filename}` : "Renaming file" };
      case "delete":
        return { icon: <Trash2 className="w-3 h-3" />, text: filename ? `Deleting ${filename}` : "Deleting file" };
      default:
        return { icon: <FilePen className="w-3 h-3" />, text: "Managing file" };
    }
  }

  return { icon: <FilePen className="w-3 h-3" />, text: toolName };
}

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolInvocationBadge({ toolInvocation }: ToolInvocationBadgeProps) {
  const done = toolInvocation.state === "result";
  const { icon, text } = getLabel(toolInvocation.toolName, toolInvocation.args as Record<string, unknown>);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {done ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600 shrink-0" />
      )}
      <span className="text-neutral-600">{icon}</span>
      <span className="text-neutral-700">{text}</span>
    </div>
  );
}
