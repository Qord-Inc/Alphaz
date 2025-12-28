"use client";

import { useState, useCallback, memo } from "react";
import {
  MessageSquare,
  Trash2,
  MoreVertical,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Thread } from "@/lib/threadsApi";

interface ThreadsPanelProps {
  threads: Thread[];
  currentThreadId?: string;
  isLoading?: boolean;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onDeleteThread: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
}

const ThreadItem = memo(
  ({
    thread,
    isSelected,
    onSelect,
    onDelete,
    onRename,
  }: {
    thread: Thread;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onRename?: (newTitle: string) => void;
  }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(thread.title || "");

    const handleRename = useCallback(() => {
      if (editTitle.trim() && onRename) {
        onRename(editTitle.trim());
      }
      setIsEditing(false);
    }, [editTitle, onRename]);

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      
      // Compare calendar dates, not time differences
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    };

    return (
      <div
        className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted text-foreground"
        }`}
        onClick={onSelect}
      >
        <MessageSquare className="h-4 w-4 flex-shrink-0" />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsEditing(false);
              }}
              autoFocus
              className="flex-1 bg-background border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleRename}
              className="p-0.5 hover:bg-muted rounded"
            >
              <Check className="h-3.5 w-3.5 text-green-500" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="p-0.5 hover:bg-muted rounded"
            >
              <X className="h-3.5 w-3.5 text-red-500" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {thread.title || "New Thread"}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(thread.updated_at)}
              </div>
            </div>

            {/* Menu button */}
            <div
              className="relative opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-muted rounded"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-md z-20 min-w-[120px]">
                  {onRename && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setIsEditing(true);
                        setEditTitle(thread.title || "");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive text-left"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }
);

ThreadItem.displayName = "ThreadItem";

export function ThreadsPanel({
  threads,
  currentThreadId,
  isLoading,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
}: ThreadsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Threads</h3>
        <button
          onClick={onNewThread}
          className="p-1.5 hover:bg-muted rounded-md transition-colors"
          title="New thread"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No threads yet.
            <br />
            <button
              onClick={onNewThread}
              className="mt-2 text-primary hover:underline"
            >
              Start a new thread
            </button>
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={thread.id === currentThreadId}
              onSelect={() => onSelectThread(thread.id)}
              onDelete={() => onDeleteThread(thread.id)}
              onRename={
                onRenameThread
                  ? (newTitle) => onRenameThread(thread.id, newTitle)
                  : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
