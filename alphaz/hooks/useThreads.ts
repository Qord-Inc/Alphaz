import { useState, useCallback, useEffect } from 'react';
import {
  Thread,
  ThreadWithContent,
  ThreadMessage,
  ThreadDraft,
  listThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
  addMessage,
  saveDraft,
} from '@/lib/threadsApi';

interface UseThreadsOptions {
  userId: string | undefined;
  organizationId: string | undefined;
  enabled?: boolean;
}

interface UseThreadsReturn {
  // State
  threads: Thread[];
  currentThread: ThreadWithContent | null;
  isLoading: boolean;
  isLoadingThread: boolean;
  error: string | null;

  // Thread actions
  loadThreads: () => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  newThread: (title?: string) => Promise<Thread | null>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  removeThread: (threadId: string) => Promise<void>;
  clearCurrentThread: () => void;

  // Message actions
  appendMessage: (role: 'user' | 'assistant', content: string, intent?: string, threadId?: string) => Promise<ThreadMessage | null>;

  // Draft actions
  saveCurrentDraft: (
    content: string,
    options?: { draftId?: string; title?: string; editPrompt?: string; changes?: string[] }
  ) => Promise<ThreadDraft | null>;
}

export function useThreads({
  userId,
  organizationId,
  enabled = true,
}: UseThreadsOptions): UseThreadsReturn {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<ThreadWithContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load threads list
  const loadThreads = useCallback(async () => {
    if (!userId || !enabled) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await listThreads(userId, organizationId);
      setThreads(data);
    } catch (err: any) {
      console.error('Failed to load threads:', err);
      setError(err.message || 'Failed to load threads');
    } finally {
      setIsLoading(false);
    }
  }, [userId, organizationId, enabled]);

  // Select and load a thread
  const selectThread = useCallback(
    async (threadId: string) => {
      if (!userId) return;

      setIsLoadingThread(true);
      setError(null);
      try {
        const data = await getThread(threadId, userId, organizationId);
        setCurrentThread(data);
      } catch (err: any) {
        console.error('Failed to load thread:', err);
        setError(err.message || 'Failed to load thread');
      } finally {
        setIsLoadingThread(false);
      }
    },
    [userId, organizationId]
  );

  // Create new thread
  const newThread = useCallback(
    async (title?: string): Promise<Thread | null> => {
      if (!userId) return null;

      setError(null);
      try {
        const thread = await createThread(userId, organizationId, title);
        setThreads((prev) => [thread, ...prev]);
        setCurrentThread({ ...thread, messages: [], drafts: [] });
        return thread;
      } catch (err: any) {
        console.error('Failed to create thread:', err);
        setError(err.message || 'Failed to create thread');
        return null;
      }
    },
    [userId, organizationId]
  );

  // Rename thread
  const renameThread = useCallback(
    async (threadId: string, title: string) => {
      if (!userId) return;

      setError(null);
      try {
        const updated = await updateThread(threadId, userId, title);
        setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
        if (currentThread?.id === threadId) {
          setCurrentThread((prev) => (prev ? { ...prev, title } : null));
        }
      } catch (err: any) {
        console.error('Failed to rename thread:', err);
        setError(err.message || 'Failed to rename thread');
      }
    },
    [userId, currentThread]
  );

  // Delete thread
  const removeThread = useCallback(
    async (threadId: string) => {
      if (!userId) return;

      setError(null);
      try {
        await deleteThread(threadId, userId);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (currentThread?.id === threadId) {
          setCurrentThread(null);
        }
      } catch (err: any) {
        console.error('Failed to delete thread:', err);
        setError(err.message || 'Failed to delete thread');
      }
    },
    [userId, currentThread]
  );

  // Clear current thread (for starting fresh)
  const clearCurrentThread = useCallback(() => {
    setCurrentThread(null);
  }, []);

  // Add message to current thread (or specified threadId)
  const appendMessage = useCallback(
    async (
      role: 'user' | 'assistant',
      content: string,
      intent?: string,
      threadId?: string // Optional: pass directly for newly created threads
    ): Promise<ThreadMessage | null> => {
      const targetThreadId = threadId || currentThread?.id;
      if (!targetThreadId) return null;

      try {
        const msg = await addMessage(targetThreadId, role, content, intent);
        setCurrentThread((prev) =>
          prev && prev.id === targetThreadId 
            ? { ...prev, messages: [...prev.messages, msg] } 
            : prev
        );
        return msg;
      } catch (err: any) {
        console.error('Failed to add message:', err);
        return null;
      }
    },
    [currentThread]
  );

  // Save draft to current thread
  const saveCurrentDraft = useCallback(
    async (
      content: string,
      options?: { draftId?: string; title?: string; editPrompt?: string; changes?: string[] }
    ): Promise<ThreadDraft | null> => {
      if (!currentThread) return null;

      try {
        const draft = await saveDraft(currentThread.id, content, options);
        setCurrentThread((prev) => {
          if (!prev) return null;

          // If draftId provided, update existing draft; else add new
          if (options?.draftId) {
            return {
              ...prev,
              drafts: prev.drafts.map((d) => (d.id === options.draftId ? draft : d)),
            };
          }
          return { ...prev, drafts: [...prev.drafts, draft] };
        });
        return draft;
      } catch (err: any) {
        console.error('Failed to save draft:', err);
        return null;
      }
    },
    [currentThread]
  );

  // Auto-load threads on mount and when org changes
  useEffect(() => {
    if (userId && enabled) {
      loadThreads();
    }
  }, [userId, organizationId, enabled, loadThreads]);

  return {
    threads,
    currentThread,
    isLoading,
    isLoadingThread,
    error,
    loadThreads,
    selectThread,
    newThread,
    renameThread,
    removeThread,
    clearCurrentThread,
    appendMessage,
    saveCurrentDraft,
  };
}
