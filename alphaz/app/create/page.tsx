"use client"

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useUser as useClerkUser } from "@clerk/nextjs";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAIChat } from "@/hooks/useAIChat";
import { useUser } from "@/hooks/useUser";
import { MarkdownMessage } from "@/components/markdown-message";
import { DraftPanel, Draft } from "@/components/draft-panel";
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
  };
  onViewDraft?: (draftId: string, version?: number) => void;
  selectedDraftId?: string | null;
  selectedDraftVersion?: number | null;
}) => {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message.content]);

  const handleViewDraft = useCallback(() => {
    if (message.draftId && onViewDraft) {
      console.log('🔘 View Draft clicked:', { draftId: message.draftId, version: message.draftVersion });
      onViewDraft(message.draftId, message.draftVersion);
    }
  }, [message.draftId, message.draftVersion, onViewDraft]);

  const showDraftCTA = message.role === "assistant" && 
                          (message.intent === 'draft' || message.intent === 'edit') && 
                          message.draftId;
  
  if (message.role === "assistant") {
    console.log('🎯 Message:', message.id, {
      intent: message.intent,
      draftId: message.draftId,
      version: message.draftVersion,
      showCTA: showDraftCTA,
      draftTitle: message.draftTitle
    });
  }

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
  
  // Transition state: draft/edit intent with empty content, waiting for draft info
  // Don't render anything during this brief transition to avoid flash of empty message
  const isDraftIntent = message.intent === 'draft' || message.intent === 'edit';
  if (isDraftIntent && !message.draftId && message.content === '') {
    return null;
  }

  // Render CTA card for draft/edit intents
  if (showDraftCTA) {
    const title = message.draftTitle || 'Draft';
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
              className="relative w-full text-left bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className={`text-sm font-medium ${isActive ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
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

  return (
    <div className="w-full flex justify-center">
      <div className="max-w-4xl w-full px-6">
        <div
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
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
            
            {/* Message actions */}
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
                
                {/* View Draft CTA */}
                {showDraftCTA && (
                  <button
                    onClick={handleViewDraft}
                    className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 px-2 py-1 rounded transition-colors"
                    title="View this draft in the sidebar"
                  >
                    <FileText className="h-3 w-3" />
                    View {message.intent === 'edit' && message.draftVersion ? `v${message.draftVersion}` : 'Draft'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

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
  return (
    <>
      {messages.map((message) => (
        <ChatMessage 
          key={message.id} 
          message={message} 
          onViewDraft={onViewDraft}
          selectedDraftId={selectedDraftId}
          selectedDraftVersion={selectedDraftVersion}
        />
      ))}
    </>
  );
});

MessageList.displayName = 'MessageList';

export default function Create() {
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
  
  // Streaming state for draft panel
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingIntent, setStreamingIntent] = useState<'draft' | 'edit' | null>(null);
  const [isStreamingDraft, setIsStreamingDraft] = useState(false);
  
  // Map message IDs to draft metadata
  const messageDraftMap = useRef<Map<string, { draftId: string; version: number; intent: string }>>(new Map());

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

    // Edits (v2+): get first bullet point from content
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
   */
  const handleDraftStreamComplete = useCallback((content: string, intent: 'draft' | 'edit', messageId: string) => {
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
      
    } else if (intent === 'edit') {
      // EDIT VERSION: Create a new version of the most recent draft
      const { content: extractedContent, changes } = extractDraftFromEditResponse(content);
      
      setDrafts(prev => {
        if (prev.length === 0) return prev;
        
        // Get the most recent draft (last in array)
        const targetDraft = prev[prev.length - 1];
        
        // Create new version
        const updatedDraft = createDraftVersion(
          targetDraft,
          extractedContent,
          'Edit request',
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
  
  // AI chat state
  const { messages, isLoading, error, currentIntent, sendMessage, clearChat } = useAIChat({
    organizationId: selectedOrganization?.id || "",
    clerkUserId: clerkUser?.id || "",
    onDraftStream: handleDraftStream,
    onDraftStreamComplete: handleDraftStreamComplete,
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
    
    // Create a special message format for inline edits
    const inlineEditMessage = `Edit the following selected text and rewrite the whole post: "${selectedText}"\n\nInstruction: ${instruction}\n\nPlease provide the full updated post content.`;
    
    // Send the inline edit as a message
    await sendMessage(inlineEditMessage);
  }, [drafts, sendMessage]);

  /**
   * Handle sending a message (memoized to prevent re-creation)
   */
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageToSend = inputValue;
    
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
    
    setInputValue(""); // Clear input immediately for better UX
    await sendMessage(messageToSend);
  }, [inputValue, isLoading, sendMessage, messages.length, isDraftMode, messages]);

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

        {/* Chat Info Panel (Slide-out) */}
        <div 
          className={`absolute left-0 top-0 h-full w-80 bg-card border-r border-border shadow-lg transform transition-transform duration-300 ease-in-out z-10 ${
            showThreadsPanel ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Chat Info</h3>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowThreadsPanel(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Chat Info Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Organization</h4>
              <p className="text-sm text-gray-600">{selectedOrganization?.name}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Messages</h4>
              <p className="text-sm text-gray-600">{messages.length} messages in this chat</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Tips</h4>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>Describe what you want to post</li>
                <li>Ask for refinements or variations</li>
                <li>Request specific tone or style</li>
                <li>Get suggestions based on your audience</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Context Used</h4>
              <p className="text-xs text-gray-600">
                AI uses your organization's analytics, past posts, and audience demographics to create relevant content.
              </p>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="p-4 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="w-full text-sm text-red-600 hover:text-red-700"
            >
              Clear Chat
            </Button>
          </div>
        </div>

        {/* Overlay when panel is open */}
        {showThreadsPanel && (
          <div 
            className="absolute inset-0 bg-black/10 z-0"
            onClick={() => setShowThreadsPanel(false)}
          />
        )}
      </div>
    </AppLayout>
  );
}