"use client"

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser as useClerkUser } from "@clerk/nextjs";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAIChat } from "@/hooks/useAIChat";
import { useUser } from "@/hooks/useUser";
import { MarkdownMessage } from "@/components/markdown-message";
import { DraftPanel, Draft } from "@/components/draft-panel";
import { ThreadsPanel } from "@/components/threads-panel";
import { useThreads } from "@/hooks/useThreads";
import { saveDraft as saveDraftToApi, updateDraftVersion as updateDraftVersionApi } from "@/lib/threadsApi";
import { 
  Paperclip, 
  Mic, 
  BarChart3, 
  Send, 
  Menu, 
  Plus, 
  MessageSquare,
  X,
  Building2,
  User,
  Lock,
  Copy,
  FileText,
  Trash2,
  Loader as LoaderIcon
} from "lucide-react";

/**
 * Memoized single message component to prevent re-renders
 */
const ChatMessage = memo(({ 
  message, 
  onViewDraft,
  selectedDraftId,
  selectedDraftVersion,
}: { 
  message: { 
    id: string; 
    role: string; 
    content: string; 
    intent?: string;
    draftId?: string;
    draftVersion?: number;
    draftTitle?: string;
    isStreamingProgress?: boolean;
    timestamp?: Date;
  };
  onViewDraft?: (draftId: string, version?: number) => void;
  selectedDraftId?: string | null;
  selectedDraftVersion?: number | null;
}) => {
  // Format timestamp as exact time (e.g., "2:34 PM")
  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message.content]);

  const handleViewDraft = useCallback(() => {
    if (message.draftId && onViewDraft) {
      console.log('🔘 View Draft clicked:', { draftId: message.draftId, version: message.draftVersion });
      onViewDraft(message.draftId, message.draftVersion);
    }
  }, [message.draftId, message.draftVersion, onViewDraft]);

  // Render streaming progress card (greyed-out style with smooth text transitions)
  if (message.isStreamingProgress) {
    return (
      <div className="w-full flex justify-center">
        <div className="max-w-4xl w-full px-6">
          <div className="flex justify-start">
            <div className="relative w-full bg-slate-50 dark:bg-muted/50 border border-slate-200 dark:border-border rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-500 border-t-slate-500 dark:border-t-slate-300 animate-spin" />
                <span 
                  className="text-sm text-slate-500 dark:text-slate-400 transition-opacity duration-500 ease-in-out"
                  key={message.content} // Key change triggers CSS transition
                  style={{ animation: 'fadeInText 0.5s ease-in-out' }}
                >
                  {message.content}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Check if this is a draft/edit intent message (content should show in draft panel, not chat)
  const isDraftIntent = message.intent === 'draft' || message.intent === 'edit';
  
  // For draft/edit intents, ALWAYS render CTA card (never show full content in chat)
  // The actual content is displayed in the draft panel
  if (isDraftIntent) {
    const title = message.draftTitle || (message.intent === 'edit' ? 'Updated Draft' : 'Created Draft');
    const versionLabel = message.draftVersion ? `Version ${message.draftVersion}` : 'Version 1';
    
    // Check if this CTA is the active/selected one
    const isActive = message.draftId === selectedDraftId && 
                     message.draftVersion === selectedDraftVersion;

    return (
      <div className="w-full flex justify-center">
        <div className="max-w-4xl w-full px-6">
          <div className="flex justify-start">
            <button
              onClick={handleViewDraft}
              disabled={!message.draftId}
              className={`relative w-full text-left bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl px-4 py-3 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                message.draftId ? 'hover:shadow-md cursor-pointer' : 'opacity-70 cursor-default'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className={`text-sm font-medium ${isActive ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                    {title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {versionLabel}
                  </div>
                </div>
                {isActive && (
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="active" />
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Regular message (not draft/edit) - show full content in chat
  return (
    <div className="w-full flex justify-center">
      <div className="max-w-4xl w-full px-6">
        <div
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div className="flex flex-col gap-1">
            <div
              className={`rounded-lg px-4 py-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              <div className="text-sm">
                {message.role === "assistant" ? (
                  <MarkdownMessage content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </div>
              
              {/* Message actions for regular assistant messages */}
              {message.role === "assistant" && (
                <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                  <button
                    onClick={handleCopy}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    title="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
              )}
            </div>
            {/* Timestamp */}
            {message.timestamp && (
              <span className={`text-[10px] text-muted-foreground ${
                message.role === "user" ? "text-right" : "text-left"
              }`}>
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

/**
 * Date separator component (WhatsApp style)
 */
const DateSeparator = memo(({ date }: { date: Date }) => {
  const formatDate = (d: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();
    
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    
    // Format as "December 24, 2025"
    return d.toLocaleDateString(undefined, { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="sticky top-0 z-10 w-full flex justify-center py-2 pointer-events-none">
      <div className="px-3 py-1 bg-muted/95 dark:bg-muted/90 rounded-full shadow-sm backdrop-blur-sm pointer-events-auto">
        <span className="text-xs text-muted-foreground font-medium">
          {formatDate(date)}
        </span>
      </div>
    </div>
  );
});

DateSeparator.displayName = 'DateSeparator';

/**
 * Group messages by date for sticky headers
 */
interface MessageGroup {
  date: Date;
  dateKey: string;
  messages: any[];
}

/**
 * Memoized message list to prevent re-rendering all messages
 */
const MessageList = memo(({ 
  messages, 
  onViewDraft,
  selectedDraftId,
  selectedDraftVersion,
}: { 
  messages: any[]; 
  onViewDraft: (draftId: string, version?: number) => void;
  selectedDraftId?: string | null;
  selectedDraftVersion?: number | null;
}) => {
  // Group messages by date
  const messageGroups = useMemo(() => {
    const groups: MessageGroup[] = [];
    
    messages.forEach((message) => {
      const messageDate = message.timestamp ? new Date(message.timestamp) : new Date();
      const dateKey = messageDate.toDateString();
      
      const existingGroup = groups.find(g => g.dateKey === dateKey);
      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({
          date: messageDate,
          dateKey,
          messages: [message]
        });
      }
    });
    
    return groups;
  }, [messages]);

  return (
    <>
      {messageGroups.map((group) => (
        <div key={group.dateKey} className="relative">
          {/* Sticky date header */}
          <DateSeparator date={group.date} />
          
          {/* Messages for this date */}
          <div className="space-y-4">
            {group.messages.map((message) => (
              <ChatMessage 
                key={message.id}
                message={message} 
                onViewDraft={onViewDraft}
                selectedDraftId={selectedDraftId}
                selectedDraftVersion={selectedDraftVersion}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
});

MessageList.displayName = 'MessageList';

interface CreatePageProps {
  threadId?: string; // Optional thread ID from URL
}

export default function Create({ threadId }: CreatePageProps = {}) {
  // Router for navigation
  const router = useRouter();
  
  // Context and hooks
  const { selectedOrganization, isPersonalProfile } = useOrganization();
  const { user } = useUser();
  const { user: clerkUser } = useClerkUser();
  
  // UI state
  const [showThreadsPanel, setShowThreadsPanel] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isDraftPanelCollapsed, setIsDraftPanelCollapsed] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [selectedDraftVersion, setSelectedDraftVersion] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isPostingLinkedIn, setIsPostingLinkedIn] = useState(false);
  const [postStatus, setPostStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Streaming state for draft panel
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingIntent, setStreamingIntent] = useState<'draft' | 'edit' | null>(null);
  const [isStreamingDraft, setIsStreamingDraft] = useState(false);
  
  // Direct edit state
  const [isSavingDirectEdit, setIsSavingDirectEdit] = useState(false);
  
  // Map message IDs to draft metadata
  const messageDraftMap = useRef<Map<string, { draftId: string; version: number; intent: string }>>(new Map());
  
  // Track if we've already restored the current thread (prevent re-restore during active session)
  const lastRestoredThreadId = useRef<string | null>(null);
  
  // Track the last user edit prompt for draft versioning
  const lastEditPromptRef = useRef<string | null>(null);

  // Thread management - persist chats and drafts
  const {
    threads,
    currentThread,
    isLoading: isLoadingThreads,
    isLoadingThread,
    selectThread,
    newThread,
    renameThread,
    removeThread,
    clearCurrentThread,
    appendMessage,
    saveCurrentDraft,
  } = useThreads({
    userId: clerkUser?.id,
    organizationId: selectedOrganization?.id,
    enabled: !!selectedOrganization, // Only load threads when org is selected
  });

  // Load thread from URL on initial mount
  useEffect(() => {
    if (threadId && selectedOrganization && !isLoadingThreads) {
      // Only load if we don't already have this thread loaded
      if (currentThread?.id !== threadId) {
        selectThread(threadId);
      }
    }
  }, [threadId, selectedOrganization, isLoadingThreads, currentThread?.id, selectThread]);

  // Helpers for CTA titles
  const genericTitles = useMemo(() => [
    'Written the LinkedIn post',
    'Drafted your LinkedIn post',
    'Prepared your LinkedIn post',
    'Composed the LinkedIn post',
  ], []);

  const stableIndex = useCallback((key: string, mod: number) => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash + key.charCodeAt(i)) % 9973;
    return hash % mod;
  }, []);

  // Extract first bullet point from content
  const getFirstBulletPoint = useCallback((content: string) => {
    // Match lines starting with bullet markers (-, *, •, or numbered like 1.)
    const bulletRegex = /^[\s]*[-*•]\s*(.+)|^[\s]*\d+\.\s*(.+)/gm;
    const match = bulletRegex.exec(content);
    if (match) {
      const bulletText = (match[1] || match[2] || '').trim();
      // Clean markdown formatting
      return bulletText.replace(/[`*_#]/g, '').trim() || 'Edited the post';
    }
    return null;
  }, []);

  // Derive a readable title from draft content and version
  const getDraftTitle = useCallback((draftId: string, version?: number | null) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return 'Draft';

    // Version handling
    const targetVersion = version ?? draft.currentVersion;
    const versionData = draft.versions.find(v => v.version === targetVersion);

    // v1: generic friendly text
    if (targetVersion === 1) {
      const idx = stableIndex(draftId, genericTitles.length);
      return genericTitles[idx];
    }

    // Edits (v2+): prefer first bullet from the recorded changes
    const firstChange = versionData?.changes?.[0];
    if (firstChange) {
      const cleanedChange = firstChange.replace(/[`*_#]/g, '').trim();
      if (cleanedChange.length > 0) return cleanedChange;
    }

    // Next, try to pull a bullet from the edit prompt
    if (versionData?.editPrompt) {
      const cleanedPrompt = versionData.editPrompt.replace(/[`*_#]/g, '').trim();
      if (cleanedPrompt.length > 0) return cleanedPrompt;
    }

    // Next, try first bullet point from content (fallback)
    const content = versionData?.content || draft.content;
    const firstBullet = getFirstBulletPoint(content);
    if (firstBullet) {
      return firstBullet;
    }

    // Fallback: first non-empty line of content
    const firstLine = (content || '').split('\n').find(l => l.trim().length > 0) || 'Edited the post';
    const cleaned = firstLine
      .replace(/^[-*>\s]+/, '')
      .replace(/[`*_#]/g, '')
      .trim();

    return cleaned || 'Edited the post';
  }, [drafts, genericTitles, getFirstBulletPoint, stableIndex]);
  
  /**
   * Handle streaming content from AI (draft/edit intents)
   * This streams directly to the draft panel instead of chat
   */
  const handleDraftStream = useCallback((content: string, intent: 'draft' | 'edit') => {
    // If content is empty, this means we detected a follow-up question
    // and should stop streaming to draft panel
    if (!content || content.trim().length === 0) {
      console.log('🔄 Follow-up question detected, clearing draft stream');
      setIsStreamingDraft(false);
      setStreamingContent(null);
      setStreamingIntent(null);
      return;
    }
    
    setStreamingContent(content);
    setStreamingIntent(intent);
    setIsStreamingDraft(true);
    // Expand draft panel when streaming starts
    setIsDraftPanelCollapsed(false);
  }, []);
  
  /**
   * Handle completion of draft streaming
   * Creates the draft entry after streaming is complete
   * Also persists to database using activeThreadIdRef
   */
  const handleDraftStreamComplete = useCallback(async (content: string, intent: 'draft' | 'edit', messageId: string) => {
    console.log('🎯 Draft stream complete:', { intent, messageId, contentLength: content.length });
    
    // If content is empty, it was a follow-up question that got redirected to chat
    if (!content || content.trim().length === 0) {
      console.log('⚠️ Empty content, clearing streaming state');
      setIsStreamingDraft(false);
      setStreamingContent(null);
      setStreamingIntent(null);
      return;
    }
    
    // Import versioning utilities
    const { 
      createDraft, 
      createDraftVersion, 
      extractDraftFromEditResponse,
    } = require('@/lib/draftVersioning');
    
    // Get threadId from ref (more reliable than state)
    const threadId = activeThreadIdRef.current;
    
    if (intent === 'draft') {
      // NEW DRAFT: Create a new draft with v1
      const newDraft = createDraft(messageId, content, new Date());
      
      console.log('✅ Created new draft from stream:', newDraft.id);
      
      // Store message-draft mapping
      messageDraftMap.current.set(messageId, {
        draftId: newDraft.id,
        version: 1,
        intent: 'draft'
      });
      
      // Add draft first, then clear streaming state
      // This ensures the draft content is visible immediately
      setDrafts(prev => [...prev, newDraft]);
      
      // Select the new draft
      setSelectedDraftId(newDraft.id);
      setSelectedDraftVersion(1);
      
      // Persist draft to thread (use threadId from ref)
      if (threadId) {
        saveDraftToApi(threadId, content, { title: 'Draft' })
          .then(savedDraft => {
            console.log('✅ Draft persisted to DB:', savedDraft.id);
            // Update local draft with DB id for consistency
            setDrafts(prev => prev.map(d => 
              d.id === newDraft.id 
                ? { ...d, dbId: savedDraft.id } 
                : d
            ));
          })
          .catch(err => {
            console.error('Failed to persist draft:', err);
          });
      }
      
    } else if (intent === 'edit') {
      // EDIT VERSION: Create a new version of the most recent draft
      const { content: extractedContent, changes } = extractDraftFromEditResponse(content);
      
      // Get the edit prompt from ref (set by handleInlineEdit or from user input)
      const editPrompt = lastEditPromptRef.current || 'Edit request';
      // Clear the ref after using it
      lastEditPromptRef.current = null;
      
      setDrafts(prev => {
        if (prev.length === 0) return prev;
        
        // Get the most recent draft (last in array)
        const targetDraft = prev[prev.length - 1];
        
        // Create new version
        const updatedDraft = createDraftVersion(
          targetDraft,
          extractedContent,
          editPrompt,
          changes,
          new Date()
        );
        
        console.log(`📝 Created draft version ${updatedDraft.currentVersion} from stream`);
        
        // Store message-draft mapping
        messageDraftMap.current.set(messageId, {
          draftId: updatedDraft.id,
          version: updatedDraft.currentVersion,
          intent: 'edit'
        });
        
        // Select the updated version
        setSelectedDraftId(updatedDraft.id);
        setSelectedDraftVersion(updatedDraft.currentVersion);
        
        // Persist to DB (update existing draft with new version)
        if (threadId) {
          // Use dbId if available, otherwise the local id won't match DB
          const dbDraftId = (targetDraft as any).dbId;
          saveDraftToApi(threadId, extractedContent, {
            draftId: dbDraftId,
            title: targetDraft.title,
            editPrompt: editPrompt,
            changes,
          })
            .then(savedDraft => {
              console.log('✅ Draft version persisted to DB:', savedDraft.id, 'v' + savedDraft.current_version);
            })
            .catch(err => {
              console.error('Failed to persist draft version:', err);
            });
        }
        
        // Replace the draft with updated version
        return [...prev.slice(0, -1), updatedDraft];
      });
    }
    
    // Clear streaming state AFTER drafts are updated
    // Use setTimeout to ensure React has processed the draft state update
    setTimeout(() => {
      setIsStreamingDraft(false);
      setStreamingContent(null);
      setStreamingIntent(null);
    }, 100);
  }, []);

  /**
   * Handle AI message completion - persist to database
   */
  const handleAIMessageComplete = useCallback((content: string, intent: string | null, messageId: string) => {
    const threadId = activeThreadIdRef.current;
    if (!threadId || !content.trim()) return;
    
    // Persist AI response to the thread
    appendMessage('assistant', content, intent || undefined, threadId).catch(err => 
      console.error('Failed to persist AI message:', err)
    );
  }, [appendMessage]);
  
  // AI chat state
  const { messages, isLoading, error, currentIntent, sendMessage, clearChat, restoreMessages } = useAIChat({
    organizationId: selectedOrganization?.id || "",
    clerkUserId: clerkUser?.id || "",
    onDraftStream: handleDraftStream,
    onDraftStreamComplete: handleDraftStreamComplete,
    onAIMessageComplete: handleAIMessageComplete,
  });

  // Check if user is on personal profile (not organization)
  const isBlocked = isPersonalProfile;
  const isChatActive = messages.length > 0;
  const isDraftMode = currentIntent === 'draft' && isChatActive;
  // Show draft panel if we have drafts OR if AI is streaming draft content
  const hasDrafts = drafts.length > 0 || isStreamingDraft;
  
  // Debug logging
  console.log('📊 Create Page State:', {
    messagesCount: messages.length,
    draftsCount: drafts.length,
    hasDrafts,
    currentIntent,
    isLoading,
    isDraftPanelCollapsed,
    isStreamingDraft,
  });
  
  /**
   * Enrich messages with draft metadata
   * Note: depends on drafts to trigger re-enrichment when new drafts/versions are created
   */
  const enrichedMessages = useMemo(() => {
    console.log('🔄 Enriching messages, map size:', messageDraftMap.current.size);
    const enriched = messages.map(msg => {
      const draftInfo = messageDraftMap.current.get(msg.id);
      if (draftInfo) {
        const draftTitle = getDraftTitle(draftInfo.draftId, draftInfo.version);
        console.log('🔗 Enriching message', msg.id, 'with draft info:', { ...draftInfo, draftTitle });
        return {
          ...msg,
          intent: draftInfo.intent,
          draftId: draftInfo.draftId,
          draftVersion: draftInfo.version,
          draftTitle,
        };
      }
      return msg;
    });
    console.log('📨 Enriched messages:', enriched.filter(m => m.intent).map(m => ({ id: m.id, intent: m.intent, draftTitle: (m as any).draftTitle })));
    return enriched;
  }, [messages, drafts, getDraftTitle]);

  /**
   * Handle viewing a draft from a message CTA button
   */
  const handleViewDraft = useCallback((draftId: string, version?: number) => {
    // Expand the draft panel if collapsed
    setIsDraftPanelCollapsed(false);
    
    // Select the draft and version
    setSelectedDraftId(draftId);
    setSelectedDraftVersion(version ?? null);
  }, []);

  /**
   * Handle inline edit of selected text from draft
   */
  const handleInlineEdit = useCallback(async (instruction: string, selectedText: string) => {
    if (!drafts.length) return;
    
    const threadId = activeThreadIdRef.current;
    
    // Create a special message format for inline edits
    const inlineEditMessage = `Edit the following selected text and rewrite the whole post: "${selectedText}"\n\nInstruction: ${instruction}\n\nPlease provide the full updated post content.`;
    
    // Store the edit prompt for when the draft version is created
    lastEditPromptRef.current = instruction;
    
    // Persist user message to database
    if (threadId) {
      appendMessage('user', inlineEditMessage, undefined, threadId).catch(err => 
        console.error('Failed to persist inline edit message:', err)
      );
    }
    
    // Send the inline edit as a message
    await sendMessage(inlineEditMessage);
  }, [drafts, sendMessage, appendMessage]);

  /**
   * Handle direct content edit (like MS Word editing)
   * Overwrites the current version content in-place (no new version created)
   */
  const handleDirectContentEdit = useCallback(async (draftId: string, newContent: string, version: number) => {
    const threadId = activeThreadIdRef.current;
    if (!threadId) return;
    
    setIsSavingDirectEdit(true);
    
    try {
      // Find the draft being edited
      const draftIndex = drafts.findIndex(d => d.id === draftId);
      if (draftIndex === -1) {
        console.error('Draft not found:', draftId);
        return;
      }
      
      const targetDraft = drafts[draftIndex];
      const dbDraftId = (targetDraft as any).dbId;
      
      // Update locally - overwrite the current version content
      const updatedDraft = {
        ...targetDraft,
        content: newContent,
        versions: targetDraft.versions.map(v => 
          v.version === version 
            ? { ...v, content: newContent } 
            : v
        ),
      };
      
      // Update local state
      setDrafts(prev => [
        ...prev.slice(0, draftIndex),
        updatedDraft,
        ...prev.slice(draftIndex + 1),
      ]);
      
      // Persist to database - overwrite, not create new version
      if (dbDraftId) {
        await updateDraftVersionApi(dbDraftId, newContent, version);
      }
      
      console.log('✅ Direct edit saved (overwritten) successfully');
    } catch (err) {
      console.error('Failed to save direct edit:', err);
    } finally {
      setIsSavingDirectEdit(false);
    }
  }, [drafts]);

  /**
   * Handle selecting a thread from the history panel
   */
  const handleSelectThread = useCallback(async (threadId: string) => {
    // Clear current chat
    clearChat();
    setDrafts([]);
    messageDraftMap.current.clear();
    lastRestoredThreadId.current = null; // Reset so restore will run for new thread
    setSelectedDraftId(null);
    setSelectedDraftVersion(null);
    
    // Load the thread
    await selectThread(threadId);
    setShowThreadsPanel(false);
    
    // Navigate to the thread URL
    router.push(`/create/${threadId}`);
  }, [clearChat, selectThread, router]);

  /**
   * Handle creating a new thread (starts fresh chat)
   */
  const handleNewThread = useCallback(async () => {
    clearChat();
    setDrafts([]);
    messageDraftMap.current.clear();
    lastRestoredThreadId.current = null; // Allow restore on next thread load
    activeThreadIdRef.current = null;
    setSelectedDraftId(null);
    setSelectedDraftVersion(null);
    clearCurrentThread();
    setShowThreadsPanel(false);
    
    // Navigate to clean /create URL
    router.push('/create');
  }, [clearChat, clearCurrentThread, router]);

  /**
   * Handle deleting a thread
   */
  const handleDeleteThread = useCallback(async (threadId: string) => {
    await removeThread(threadId);
    // If we deleted the current thread, clear the chat
    if (currentThread?.id === threadId) {
      clearChat();
      setDrafts([]);
      messageDraftMap.current.clear();
    }
  }, [removeThread, currentThread, clearChat]);

  /**
   * Post the current draft to LinkedIn for the selected organization
   */
  const handlePostToLinkedIn = useCallback(async (content: string) => {
    if (!content) return;
    if (!selectedOrganization) {
      setPostStatus({ type: 'error', message: 'Select an organization to publish.' });
      return;
    }
    if (!user?.clerk_user_id) {
      setPostStatus({ type: 'error', message: 'User not loaded yet.' });
      return;
    }

    try {
      setIsPostingLinkedIn(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/linkedin/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: user.clerk_user_id,
          organizationId: selectedOrganization.id,
          content,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof data?.details === 'string' ? data.details : (data?.details?.message || data?.details?.messageText);
        const msg = data?.error || detail || 'Failed to post to LinkedIn';
        throw new Error(msg);
      }

      setPostStatus({ type: 'success', message: 'Published to LinkedIn.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish to LinkedIn';
      setPostStatus({ type: 'error', message: msg });
    } finally {
      setIsPostingLinkedIn(false);
    }
  }, [selectedOrganization, user?.clerk_user_id]);

  // Ref to track the active thread ID for message persistence
  const activeThreadIdRef = useRef<string | null>(null);
  
  // Keep ref in sync with currentThread
  useEffect(() => {
    activeThreadIdRef.current = currentThread?.id || null;
  }, [currentThread]);

  /**
   * Handle sending a message (memoized to prevent re-creation)
   */
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageToSend = inputValue;
    let threadIdForMessage: string | null = activeThreadIdRef.current;
    
    // Create a new thread if this is the first message and we don't have one
    if (messages.length === 0 && !currentThread && selectedOrganization) {
      const threadTitle = messageToSend.substring(0, 50) + (messageToSend.length > 50 ? '...' : '');
      const thread = await newThread(threadTitle);
      if (thread) {
        threadIdForMessage = thread.id;
        activeThreadIdRef.current = thread.id;
        // Persist user message to the new thread (pass threadId directly)
        appendMessage('user', messageToSend, undefined, thread.id).catch(err => 
          console.error('Failed to persist user message:', err)
        );
        // Update URL without causing navigation/reload (shallow update)
        window.history.replaceState(null, '', `/create/${thread.id}`);
      }
    } else if (threadIdForMessage) {
      // Persist user message to existing thread
      appendMessage('user', messageToSend, undefined, threadIdForMessage).catch(err => 
        console.error('Failed to persist user message:', err)
      );
    }
    
    // Trigger transition animation if this is the first message
    if (messages.length === 0) {
      setIsTransitioning(true);
      // Wait for animation to complete before sending
      setTimeout(() => {
        setIsTransitioning(false);
      }, 600);
    }
    
    // Collapse panel when sending new message (draft already saved by useEffect)
    if (isDraftMode && messages.length > 0) {
      setIsDraftPanelCollapsed(true);
    }
    
    // If we have drafts, this might be an edit request - store the prompt
    if (drafts.length > 0) {
      lastEditPromptRef.current = messageToSend;
    }
    
    setInputValue(""); // Clear input immediately for better UX
    await sendMessage(messageToSend);
  }, [inputValue, isLoading, sendMessage, messages.length, isDraftMode, messages, currentThread, selectedOrganization, newThread, appendMessage, drafts.length]);

  /**
   * Handle keyboard shortcut (Enter to send) - memoized
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [isLoading, handleSendMessage]);

  /**
   * Handle input change - memoized
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  /**
   * Auto-scroll to bottom when messages change
   */
  const scrollToBottom = useCallback((force = false) => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        // Scroll the container to bottom
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else if (messagesEndRef.current) {
        // Fallback to scrollIntoView
        messagesEndRef.current.scrollIntoView({ behavior: force ? 'auto' : 'smooth', block: 'end' });
      }
    });
  }, []);

  /**
   * Scroll to bottom when messages update or loading state changes
   */
  useEffect(() => {
    if (isChatActive) {
      // Immediate scroll for user messages, smooth for AI responses
      const isUserMessage = messages.length > 0 && messages[messages.length - 1]?.role === 'user';
      scrollToBottom(isUserMessage);
    }
  }, [messages, isLoading, isChatActive, scrollToBottom]);
  
  /**
   * Scroll to bottom immediately when user sends a message
   */
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        // Force immediate scroll for user messages
        setTimeout(() => scrollToBottom(true), 0);
      }
    }
  }, [messages.length, scrollToBottom]);

  /**
   * NOTE: Draft creation is now handled by handleDraftStreamComplete callback
   * which is called when AI streaming completes. This allows drafts to be
   * streamed directly to the draft panel instead of the chat.
   */

  /**
   * Restore messages and drafts when a thread is loaded
   * Only runs when switching to a DIFFERENT thread (not when currentThread object updates)
   */
  useEffect(() => {
    if (!currentThread) {
      lastRestoredThreadId.current = null;
      return;
    }
    
    // Skip if we've already restored this thread (prevents overwriting local state)
    if (lastRestoredThreadId.current === currentThread.id) {
      console.log('⏭️ Skipping restore - thread already loaded:', currentThread.id);
      return;
    }
    
    console.log('📥 Restoring thread:', currentThread.id);
    lastRestoredThreadId.current = currentThread.id;
    
    // Clear previous message-draft mappings
    messageDraftMap.current.clear();
    
    // Restore drafts first so we can map messages to them
    let restoredDrafts: Draft[] = [];
    if (currentThread.drafts && currentThread.drafts.length > 0) {
      restoredDrafts = currentThread.drafts.map(d => {
        const versions = (d.versions || []).sort((a, b) => a.version - b.version);
        const latestVersion = versions[versions.length - 1];
        
        return {
          id: d.id,
          dbId: d.id, // Store DB id for persistence
          messageId: d.id,
          content: latestVersion?.content || '',
          title: d.title || 'Draft',
          currentVersion: d.current_version,
          versions: versions.map(v => ({
            version: v.version,
            content: v.content,
            editPrompt: v.edit_prompt,
            changes: v.changes || [],
            timestamp: new Date(v.created_at),
          })),
          timestamp: new Date(d.created_at),
        };
      });
      
      setDrafts(restoredDrafts);
      
      // Select the first draft if any
      if (restoredDrafts.length > 0) {
        setSelectedDraftId(restoredDrafts[0].id);
        setSelectedDraftVersion(restoredDrafts[0].currentVersion);
      }
    } else {
      setDrafts([]);
    }
    
    // Restore messages from the thread
    if (currentThread.messages && currentThread.messages.length > 0) {
      // Sort messages by sequence
      const sortedMessages = [...currentThread.messages].sort((a, b) => a.seq - b.seq);
      
      // Track which draft/version to assign to each draft/edit message
      // We match draft intent messages to draft v1, edit intent messages to subsequent versions
      let currentDraftIndex = 0;
      let currentVersionForDraft = 1;
      
      // Convert thread messages to ChatMessage format
      const restoredMessages = sortedMessages.map(m => {
        const chatMessage = {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at),
          intent: m.intent as 'edit' | 'ideate' | 'draft' | 'feedback' | undefined,
        };
        
        // For draft/edit intent messages, link them to the restored drafts
        if (m.role === 'assistant' && (m.intent === 'draft' || m.intent === 'edit') && restoredDrafts.length > 0) {
          const targetDraft = restoredDrafts[currentDraftIndex];
          
          if (targetDraft) {
            if (m.intent === 'draft') {
              // New draft - version 1
              messageDraftMap.current.set(m.id, {
                draftId: targetDraft.id,
                version: 1,
                intent: 'draft'
              });
              currentVersionForDraft = 2; // Next edit will be v2
            } else if (m.intent === 'edit') {
              // Edit - next version
              const versionToUse = Math.min(currentVersionForDraft, targetDraft.currentVersion);
              messageDraftMap.current.set(m.id, {
                draftId: targetDraft.id,
                version: versionToUse,
                intent: 'edit'
              });
              currentVersionForDraft++;
              
              // If we've exceeded versions for this draft, move to next draft
              if (currentVersionForDraft > targetDraft.currentVersion + 1) {
                currentDraftIndex++;
                currentVersionForDraft = 1;
              }
            }
          }
        }
        
        return chatMessage;
      });
      
      restoreMessages(restoredMessages);
      console.log('✅ Restored', restoredMessages.length, 'messages from thread');
      console.log('✅ Mapped', messageDraftMap.current.size, 'messages to drafts');
    }
  }, [currentThread, restoreMessages]);

  return (
    <AppLayout>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowThreadsPanel(!showThreadsPanel)}
                title="Chat History"
              >
                <Menu className="h-5 w-5" />
              </Button>
              {selectedOrganization ? (
                <>
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-foreground">{selectedOrganization.name}</span>
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">Personal Profile</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={clearChat}
                title="New Chat"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          {/* Blocked State for Personal Profile */}
          {isBlocked ? (
            <main className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground mb-3">
                  Organization Required
                </h2>
                <p className="text-muted-foreground mb-6">
                  To create content with AI assistance, please select an organization from the sidebar. 
                  Personal profile content creation is coming soon.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Building2 className="h-4 w-4" />
                  <span>Switch to an organization in the sidebar to continue</span>
                </div>
              </div>
            </main>
          ) : (
            /* Chat Interface */
            <main className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Messages Area */}
              {/* Initial state - centered input before first message */}
              {!isChatActive && !isTransitioning && (
                <div 
                  className="flex-1 flex flex-col items-center justify-center px-6 -mt-24 transition-opacity duration-500 ease-in-out opacity-100"
                >
                <div className="w-full max-w-3xl">
                  <h1 
                    className={`text-5xl font-medium text-foreground text-center mb-12 transition-opacity duration-300 ${
                      !isChatActive && !isTransitioning ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    What are you writing today?
                  </h1>
                  
                  {/* Centered Input */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                    <Textarea
                      placeholder="Describe your LinkedIn post idea..."
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="min-h-[60px] border-0 text-base placeholder:text-muted-foreground resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-5 rounded-t-2xl bg-transparent text-foreground"
                      disabled={isLoading || isTransitioning}
                    />

                    {/* Action Bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 rounded-b-2xl border-t border-border">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <button className="hover:text-foreground transition">
                          <Paperclip className="h-5 w-5" />
                        </button>
                        <button className="hover:text-gray-600 transition">
                          <Mic className="h-5 w-5" />
                        </button>
                        <button className="hover:text-gray-600 transition">
                          <BarChart3 className="h-5 w-5" />
                        </button>
                      </div>

                      <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading || isTransitioning}
                        className="bg-orange-400 hover:bg-orange-500 text-white rounded-lg px-4 h-10 flex items-center gap-2 shadow-sm"
                      >
                        {isLoading ? (
                          <LoaderIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              )}
              
              {/* Chat messages area - when chat is active */}
              {(isChatActive || isTransitioning) && (
                // Chat messages area with draft panel
                <div className="flex-1 flex overflow-hidden relative">
                  {/* Chat Messages - Left Side (or full width) */}
                  <div 
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-6 pb-44 space-y-4"
                  >
                    <MessageList 
                      messages={enrichedMessages} 
                      onViewDraft={handleViewDraft}
                      selectedDraftId={selectedDraftId}
                      selectedDraftVersion={selectedDraftVersion}
                    />

                  {/* Loading indicator - only show when NOT streaming to draft panel */}
                  {isLoading && !isStreamingDraft && (
                    <div className="w-full flex justify-center">
                      <div className="max-w-4xl w-full px-6">
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2">
                              <LoaderIcon className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-gray-600">Thinking...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {error && (
                    <div className="w-full flex justify-center">
                      <div className="max-w-4xl w-full px-6">
                        <div className="flex justify-start">
                          <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 border border-red-200">
                            <p className="text-sm">{error}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                    {/* Invisible element at the end for auto-scroll */}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* Draft Panel - Right Side */}
                  {hasDrafts && (
                    <DraftPanel
                      drafts={drafts}
                      organizationName={selectedOrganization?.name || ''}
                      organizationImage={undefined}
                      isCollapsed={isDraftPanelCollapsed}
                      selectedDraftId={selectedDraftId}
                      selectedVersion={selectedDraftVersion}
                      streamingContent={streamingContent}
                      streamingIntent={streamingIntent}
                      isStreaming={isStreamingDraft}
                      onToggle={() => setIsDraftPanelCollapsed(!isDraftPanelCollapsed)}
                      onDeleteDraft={(id) => setDrafts(prev => prev.filter(d => d.id !== id))}
                      onCopyDraft={(content) => navigator.clipboard.writeText(content)}
                      onInlineEdit={handleInlineEdit}
                      onPostDraft={handlePostToLinkedIn}
                      isPosting={isPostingLinkedIn}
                      onContentEdit={handleDirectContentEdit}
                      isSavingEdit={isSavingDirectEdit}
                    />
                  )}
                </div>
              )}

              {/* Input Area - Floating textbox when chat is active */}
              <div 
                className={`absolute bottom-0 left-0 p-6 pb-8 transition-all duration-500 ease-in-out ${
                  isChatActive || isTransitioning
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-full opacity-0 pointer-events-none'
                }`}
                style={{
                  right: hasDrafts && !isDraftPanelCollapsed ? '600px' : '0',
                  transition: 'right 300ms ease-in-out, transform 500ms ease-in-out, opacity 500ms ease-in-out'
                }}
              >
                <div className="max-w-4xl mx-auto px-6">
                  <div className="bg-card rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all">
                      <Textarea
                        placeholder="Continue the conversation..."
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="min-h-[70px] border-0 text-base placeholder:text-muted-foreground resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-5 rounded-t-2xl bg-transparent text-foreground"
                        disabled={isLoading}
                      />

                      {/* Action Bar */}
                      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-muted/30 to-muted/10 rounded-b-2xl border-t border-border">
                        <div className="flex items-center gap-3">
                          <button className="text-muted-foreground hover:text-foreground transition-colors hover:scale-110 transition-transform">
                            <Paperclip className="h-5 w-5" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600 transition-colors hover:scale-110 transition-transform">
                            <Mic className="h-5 w-5" />
                          </button>
                          <button className="text-gray-400 hover:text-gray-600 transition-colors hover:scale-110 transition-transform">
                            <BarChart3 className="h-5 w-5" />
                          </button>
                        </div>

                        <Button
                          size="sm"
                          onClick={handleSendMessage}
                          disabled={!inputValue.trim() || isLoading}
                          className="bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-xl px-5 h-10 flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                        >
                          {isLoading ? (
                            <LoaderIcon className="h-5 w-5 animate-spin" />
                          ) : (
                            <Send className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
            </main>
          )}
        </div>

        {/* Threads Panel (Slide-out) */}
        <div 
          className={`absolute left-0 top-0 h-full w-80 bg-card border-r border-border shadow-lg transform transition-transform duration-300 ease-in-out z-10 ${
            showThreadsPanel ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Panel Header with Close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Chat History</h3>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowThreadsPanel(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Threads List */}
          <ThreadsPanel
            threads={threads}
            currentThreadId={currentThread?.id}
            isLoading={isLoadingThreads}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onRenameThread={renameThread}
          />
        </div>

        {/* Overlay when panel is open */}
        {showThreadsPanel && (
          <div 
            className="absolute inset-0 bg-black/10 z-0"
            onClick={() => setShowThreadsPanel(false)}
          />
        )}

        {/* Toast / status messages (centered) */}
        {postStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPostStatus(null)} />
            <div
              className={`relative w-full max-w-md rounded-2xl border shadow-2xl bg-card/95 backdrop-blur px-6 py-5 flex flex-col gap-4 ${
                postStatus.type === 'success'
                  ? 'border-emerald-200 dark:border-emerald-900/60'
                  : 'border-red-200 dark:border-red-900/60'
              }`}
              role="alertdialog"
              aria-live="polite"
              aria-label={postStatus.type === 'success' ? 'Publish success' : 'Publish error'}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 h-3 w-3 rounded-full ${
                    postStatus.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <div className="text-base text-foreground leading-relaxed">
                  {postStatus.message}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setPostStatus(null)}
                  className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}