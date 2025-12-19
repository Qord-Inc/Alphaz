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
  onViewDraft 
}: { 
  message: { 
    id: string; 
    role: string; 
    content: string; 
    intent?: string;
    draftId?: string;
    draftVersion?: number;
  };
  onViewDraft?: (draftId: string, version?: number) => void;
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

  const showDraftButton = message.role === "assistant" && 
                          (message.intent === 'draft' || message.intent === 'edit') && 
                          message.draftId;
  
  if (message.role === "assistant") {
    console.log('🎯 Message:', message.id, {
      intent: message.intent,
      draftId: message.draftId,
      version: message.draftVersion,
      showButton: showDraftButton
    });
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
                {showDraftButton && (
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
  onViewDraft 
}: { 
  messages: any[]; 
  onViewDraft: (draftId: string, version?: number) => void;
}) => {
  return (
    <>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} onViewDraft={onViewDraft} />
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
  
  // Map message IDs to draft metadata
  const messageDraftMap = useRef<Map<string, { draftId: string; version: number; intent: string }>>(new Map());
  
  // AI chat state
  const { messages, isLoading, error, currentIntent, sendMessage, clearChat } = useAIChat({
    organizationId: selectedOrganization?.id || "",
    clerkUserId: clerkUser?.id || "",
  });

  // Check if user is on personal profile (not organization)
  const isBlocked = isPersonalProfile;
  const isChatActive = messages.length > 0;
  const isDraftMode = currentIntent === 'draft' && isChatActive;
  const hasDrafts = drafts.length > 0;
  
  /**
   * Enrich messages with draft metadata
   * Note: depends on drafts to trigger re-enrichment when new drafts/versions are created
   */
  const enrichedMessages = useMemo(() => {
    return messages.map(msg => {
      const draftInfo = messageDraftMap.current.get(msg.id);
      if (draftInfo) {
        console.log('🔗 Enriching message', msg.id, 'with draft info:', draftInfo);
        return {
          ...msg,
          intent: draftInfo.intent,
          draftId: draftInfo.draftId,
          draftVersion: draftInfo.version
        };
      }
      return msg;
    });
  }, [messages, drafts]);

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
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  /**
   * Scroll to bottom when messages update or loading state changes
   */
  useEffect(() => {
    if (isChatActive) {
      // Small delay to ensure DOM has updated
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isLoading, isChatActive, scrollToBottom]);

  /**
   * Auto-save draft when AI generates content
   * Handles both:
   * 1. New drafts (draft intent) - creates new draft
   * 2. Edit versions (edit intent on existing draft) - creates v2, v3, etc.
   */
  useEffect(() => {
    if (!isLoading && messages.length > 0 && (currentIntent === 'draft' || currentIntent === 'edit')) {
      const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      
      if (!lastAssistantMessage?.content) return;

      // Import versioning utilities
      const { 
        createDraft, 
        createDraftVersion, 
        extractDraftFromEditResponse,
        isFollowUpQuestion 
      } = require('@/lib/draftVersioning');

      // If it's a follow-up question, don't save as draft
      if (isFollowUpQuestion(lastAssistantMessage.content)) {
        console.log('🤔 AI asked a follow-up question, not saving as draft');
        return;
      }

      if (currentIntent === 'draft') {
        // NEW DRAFT: Create a new draft with v1
        const draftId = `draft-${lastAssistantMessage.id}`;
        setDrafts(prev => {
          const exists = prev.some(d => d.id === draftId);
          if (exists) return prev;
          
          const newDraft = createDraft(
            lastAssistantMessage.id,
            lastAssistantMessage.content,
            new Date()
          );
          
          console.log('📝 Created new draft:', newDraft.id);
          
          // Store message-draft mapping
          messageDraftMap.current.set(lastAssistantMessage.id, {
            draftId: newDraft.id,
            version: 1,
            intent: 'draft'
          });
          
          return [...prev, newDraft];
        });
        setIsDraftPanelCollapsed(false);
        
      } else if (currentIntent === 'edit' && drafts.length > 0) {
        // EDIT VERSION: Create a new version of the most recent draft
        const { content, changes } = extractDraftFromEditResponse(lastAssistantMessage.content);
        
        setDrafts(prev => {
          if (prev.length === 0) return prev;
          
          // Get the most recent draft (last in array)
          const targetDraft = prev[prev.length - 1];
          
          // Create new version
          const updatedDraft = createDraftVersion(
            targetDraft,
            content,
            lastUserMessage?.content || 'Edit request',
            changes,
            new Date()
          );
          
          console.log(`📝 Created draft version ${updatedDraft.currentVersion} for ${updatedDraft.id}`);
          
          // Store message-draft mapping
          messageDraftMap.current.set(lastAssistantMessage.id, {
            draftId: updatedDraft.id,
            version: updatedDraft.currentVersion,
            intent: 'edit'
          });
          
          // Replace the draft with updated version
          return [...prev.slice(0, -1), updatedDraft];
        });
        setIsDraftPanelCollapsed(false);
      }
    }
  }, [isLoading, messages, currentIntent, drafts.length]);

  return (
    <AppLayout>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card">
            <div className="flex items-center gap-2">
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
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowThreadsPanel(!showThreadsPanel)}
                title="Chat History"
              >
                <Menu className="h-5 w-5" />
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
                  {/* Draft Panel - Left Side */}
                  {hasDrafts && (
                    <DraftPanel
                      drafts={drafts}
                      organizationName={selectedOrganization?.name || ''}
                      organizationImage={undefined}
                      isCollapsed={isDraftPanelCollapsed}
                      selectedDraftId={selectedDraftId}
                      selectedVersion={selectedDraftVersion}
                      onToggle={() => setIsDraftPanelCollapsed(!isDraftPanelCollapsed)}
                      onDeleteDraft={(id) => setDrafts(prev => prev.filter(d => d.id !== id))}
                      onCopyDraft={(content) => navigator.clipboard.writeText(content)}
                    />
                  )}
                  
                  {/* Chat Messages - Right Side (or full width) */}
                  <div 
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-6 pb-44 space-y-4"
                  >
                    <MessageList messages={enrichedMessages} onViewDraft={handleViewDraft} />

                  {/* Loading indicator */}
                  {isLoading && (
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
                </div>
              )}

              {/* Input Area - Floating textbox when chat is active */}
              <div 
                className={`absolute bottom-0 right-0 p-6 pb-8 transition-all duration-500 ease-in-out ${
                  isChatActive || isTransitioning
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-full opacity-0 pointer-events-none'
                }`}
                style={{
                  left: hasDrafts && !isDraftPanelCollapsed ? '600px' : '0',
                  transition: 'left 300ms ease-in-out, transform 500ms ease-in-out, opacity 500ms ease-in-out'
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
          className={`absolute right-0 top-0 h-full w-80 bg-card border-l border-border shadow-lg transform transition-transform duration-300 ease-in-out z-10 ${
            showThreadsPanel ? 'translate-x-0' : 'translate-x-full'
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