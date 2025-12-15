"use client"

import { useState, useEffect } from "react";
import { useUser as useClerkUser } from "@clerk/nextjs";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAIChat } from "@/hooks/useAIChat";
import { useUser } from "@/hooks/useUser";
import { MarkdownMessage } from "@/components/markdown-message";
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
  Trash2,
  Loader as LoaderIcon
} from "lucide-react";

export default function Create() {
  // Context and hooks
  const { selectedOrganization, isPersonalProfile } = useOrganization();
  const { user } = useUser();
  const { user: clerkUser } = useClerkUser();
  
  // UI state
  const [showThreadsPanel, setShowThreadsPanel] = useState(false);
  const [inputValue, setInputValue] = useState("");
  
  // AI chat state
  const { messages, isLoading, error, sendMessage, clearChat } = useAIChat({
    organizationId: selectedOrganization?.id || "",
    clerkUserId: clerkUser?.id || "",
  });

  // Check if user is on personal profile (not organization)
  const isBlocked = isPersonalProfile;
  const isChatActive = messages.length > 0;

  /**
   * Handle sending a message
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    await sendMessage(inputValue);
    setInputValue(""); // Clear input after sending
  };

  /**
   * Handle keyboard shortcut (Enter to send)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AppLayout>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {selectedOrganization ? (
                <>
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-800">{selectedOrganization.name}</span>
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-500">Personal Profile</span>
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
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Lock className="h-8 w-8 text-gray-400" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Organization Required
                </h2>
                <p className="text-gray-500 mb-6">
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
              {!isChatActive ? (
                // Initial state - before user sends first message
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
                  <div className="text-center max-w-2xl">
                    <h1 className="text-4xl font-semibold text-gray-800 mb-2">
                      What are you writing today?
                    </h1>
                    <p className="text-gray-500 mb-8">
                      Create content for <span className="font-medium text-blue-600">{selectedOrganization?.name}</span>
                    </p>
                    
                    {/* Quick prompts */}
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400 mb-4">Try asking:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={() => {
                            setInputValue("Create a post about our latest product launch");
                            setTimeout(() => {
                              const textarea = document.querySelector('textarea');
                              textarea?.focus();
                            }, 0);
                          }}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-full transition"
                        >
                          Product Launch
                        </button>
                        <button
                          onClick={() => {
                            setInputValue("Write about company culture and team growth");
                            setTimeout(() => {
                              const textarea = document.querySelector('textarea');
                              textarea?.focus();
                            }, 0);
                          }}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-full transition"
                        >
                          Team Spotlight
                        </button>
                        <button
                          onClick={() => {
                            setInputValue("Share an industry insight or thought leadership idea");
                            setTimeout(() => {
                              const textarea = document.querySelector('textarea');
                              textarea?.focus();
                            }, 0);
                          }}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-full transition"
                        >
                          Industry Insight
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Chat messages area - when chat is active
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-2xl rounded-lg px-4 py-3 ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-800"
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
                          <div className="flex gap-2 mt-3 pt-2 border-t border-gray-300">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(message.content);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              title="Copy message"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <LoaderIcon className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-gray-600">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {error && (
                    <div className="flex justify-start">
                      <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 border border-red-200">
                        <p className="text-sm">{error}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Input Area */}
              <div className="border-t border-gray-200 bg-white p-4">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-white rounded-xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-50 transition">
                    <Textarea
                      placeholder="Ask me to write a post, refine content, or get ideas..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="min-h-[50px] border-0 text-base placeholder:text-gray-400 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-4"
                      disabled={isLoading}
                    />

                    {/* Action Bar */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-b-lg border-t border-gray-100">
                      <div className="flex items-center gap-1">
                        {isChatActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearChat}
                            className="text-gray-500 hover:text-gray-700 text-xs"
                            title="Clear chat"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear
                          </Button>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 flex items-center gap-2"
                      >
                        {isLoading ? (
                          <LoaderIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Send
                      </Button>
                    </div>
                  </div>

                  {/* Keyboard hint */}
                  {!isChatActive && (
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      💡 Tip: Use Shift+Enter for new lines
                    </p>
                  )}
                </div>
              </div>
            </main>
          )}
        </div>

        {/* Chat Info Panel (Slide-out) */}
        <div 
          className={`absolute right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-lg transform transition-transform duration-300 ease-in-out z-10 ${
            showThreadsPanel ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Chat Info</h3>
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