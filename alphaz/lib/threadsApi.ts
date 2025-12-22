/**
 * Thread API service for chat persistence
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface ThreadMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  seq: number;
  created_at: string;
}

export interface DraftVersion {
  id: string;
  draft_id: string;
  version: number;
  content: string;
  edit_prompt?: string;
  changes?: string[];
  created_at: string;
}

export interface ThreadDraft {
  id: string;
  thread_id: string;
  title?: string;
  current_version: number;
  created_at: string;
  updated_at: string;
  versions?: DraftVersion[];
}

export interface Thread {
  id: string;
  user_clerk_id: string;
  organization_id?: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface ThreadWithContent extends Thread {
  messages: ThreadMessage[];
  drafts: ThreadDraft[];
}

// =====================================================
// Thread CRUD
// =====================================================

export async function listThreads(
  userId: string,
  organizationId?: string
): Promise<Thread[]> {
  const params = new URLSearchParams({ userId });
  if (organizationId) params.append('organizationId', organizationId);

  const res = await fetch(`${API_URL}/api/threads?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list threads');
  return data.threads;
}

export async function createThread(
  userId: string,
  organizationId?: string,
  title?: string
): Promise<Thread> {
  const res = await fetch(`${API_URL}/api/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, organizationId, title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create thread');
  return data.thread;
}

export async function getThread(
  threadId: string,
  userId: string,
  organizationId?: string
): Promise<ThreadWithContent> {
  const params = new URLSearchParams({ userId });
  if (organizationId) params.append('organizationId', organizationId);

  const res = await fetch(`${API_URL}/api/threads/${threadId}?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get thread');
  return { ...data.thread, messages: data.messages, drafts: data.drafts };
}

export async function updateThread(
  threadId: string,
  userId: string,
  title: string
): Promise<Thread> {
  const res = await fetch(`${API_URL}/api/threads/${threadId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update thread');
  return data.thread;
}

export async function deleteThread(
  threadId: string,
  userId: string
): Promise<void> {
  const params = new URLSearchParams({ userId });
  const res = await fetch(`${API_URL}/api/threads/${threadId}?${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete thread');
  }
}

// =====================================================
// Messages
// =====================================================

export async function addMessage(
  threadId: string,
  role: 'user' | 'assistant',
  content: string,
  intent?: string
): Promise<ThreadMessage> {
  const res = await fetch(`${API_URL}/api/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content, intent }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add message');
  return data.message;
}

// =====================================================
// Drafts
// =====================================================

export async function saveDraft(
  threadId: string,
  content: string,
  options?: {
    draftId?: string;
    title?: string;
    editPrompt?: string;
    changes?: string[];
  }
): Promise<ThreadDraft> {
  const res = await fetch(`${API_URL}/api/threads/${threadId}/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftId: options?.draftId,
      title: options?.title,
      content,
      editPrompt: options?.editPrompt,
      changes: options?.changes,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save draft');
  return data.draft;
}

export async function getDraft(draftId: string): Promise<ThreadDraft> {
  const res = await fetch(`${API_URL}/api/drafts/${draftId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get draft');
  return data.draft;
}

export async function deleteDraft(draftId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/drafts/${draftId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete draft');
  }
}
