'use client';

import { useState, useCallback } from 'react';

/**
 * Clean AI response by removing common hallucination artifacts
 * These patterns sometimes appear at the end of AI-generated content
 */
function cleanAIResponse(text: string): string {
  let cleaned = text;
  
  // Remove "End File#" and everything after it (common AI artifact)
  const endFileIndex = cleaned.indexOf('End File#');
  if (endFileIndex !== -1) {
    cleaned = cleaned.substring(0, endFileIndex);
  }
  
  // Remove "# Conversation:" and everything after it
  const conversationIndex = cleaned.indexOf('# Conversation:');
  if (conversationIndex !== -1) {
    cleaned = cleaned.substring(0, conversationIndex);
  }
  
  // Remove "## User Profile" and everything after it  
  const userProfileIndex = cleaned.indexOf('## User Profile');
  if (userProfileIndex !== -1) {
    cleaned = cleaned.substring(0, userProfileIndex);
  }
  
  // Remove "## Conversation History" and everything after it
  const historyIndex = cleaned.indexOf('## Conversation History');
  if (historyIndex !== -1) {
    cleaned = cleaned.substring(0, historyIndex);
  }
  
  // Clean up trailing whitespace and excessive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleaned;
}

/**
 * Type definitions for chat messages
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: 'edit' | 'ideate' | 'draft' | 'feedback' | 'general';
  draftContent?: string; // Clean post content for draft intent
  isStreamingProgress?: boolean; // True when showing rotating progress text during draft streaming
  isFollowUpQuestion?: boolean; // True when AI asks a clarifying question instead of generating draft
}

export interface ContextData {
  summary?: string;
  demographicData?: string;
  recentPosts?: string;
  engagementPatterns?: string;
}

/**
 * Custom hook for AI chat with embedded organization data
 * 
 * Example usage:
 * ```
 * const { messages, isLoading, error, sendMessage } = useAIChat({
 *   organizationId: 'org123',
 *   clerkUserId: 'user456',
 *   contextData: { summary: '...', demographics: '...' }
 * });
 * ```
 */
export function useAIChat({
  organizationId,
  clerkUserId,
  contextData,
  onDraftStream,
  onDraftStreamComplete,
  onAIMessageComplete,
}: {
  organizationId: string;
  clerkUserId: string;
  contextData?: ContextData;
  /** Called with each streaming chunk when intent is 'draft' or 'edit' */
  onDraftStream?: (content: string, intent: 'draft' | 'edit') => void;
  /** Called when draft streaming is complete */
  onDraftStreamComplete?: (content: string, intent: 'draft' | 'edit', messageId: string) => void;
  /** Called when any AI message streaming is complete (for persistence) */
  onAIMessageComplete?: (content: string, intent: string | null, messageId: string) => void;
}) {
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIntent, setCurrentIntent] = useState<'edit' | 'ideate' | 'draft' | 'feedback' | 'general' | null>(null);

  /**
   * Send a message to the AI
   * Automatically fetches context from database if not provided
   */
  const sendMessage = useCallback(
    async (userMessage: string, displayContent?: string) => {
      // Validate input
      if (!userMessage.trim()) {
        setError('Message cannot be empty');
        return;
      }

      // Reset error
      setError(null);

      // Create user message object
      // displayContent is shown in UI, userMessage is sent to API
      const newUserMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayContent || userMessage,
        timestamp: new Date(),
      };

      // Add user message to chat
      setMessages((prev) => [...prev, newUserMessage]);

      // Show loading state
      setIsLoading(true);

      try {
        // Get context data (from props or fetch from database)
        console.log(`\n💬 [SEND MESSAGE] User message: "${userMessage.substring(0, 50)}..."`);
        console.log(`   contextData prop:`, contextData);
        console.log(`   contextData is truthy:`, !!contextData);
        console.log(`   organizationId:`, organizationId);

        // For organization accounts: fetch context if not provided
        // For personal accounts: use provided context (don't fetch)
        const contextToSend = contextData !== undefined 
          ? contextData 
          : (organizationId ? await fetchContextData(organizationId, clerkUserId) : {});

        console.log(`\n🔧 [PREPARING REQUEST]`);
        console.log(`   Message count: ${messages.length + 1} (including new message)`);
        console.log(`   Context provided: ${contextToSend && Object.keys(contextToSend).length > 0 ? 'YES ✅' : 'NO ❌'}`);
        
        if (contextToSend) {
          console.log(`   Context breakdown:`);
          console.log(`      - Summary: ${contextToSend.summary?.length || 0} chars`);
          console.log(`      - Demographics: ${contextToSend.demographicData?.length || 0} chars`);
          console.log(`      - Posts: ${contextToSend.recentPosts?.length || 0} chars`);
          console.log(`      - Patterns: ${contextToSend.engagementPatterns?.length || 0} chars`);
        }

        // Prepare messages for API (exclude timestamps for API call)
        const messagesForAPI = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Add current user message
        messagesForAPI.push({
          role: 'user',
          content: userMessage,
        });

        console.log(`\n📤 [CALLING API] /api/chat`);
        console.log(`   Request payload:`);
        console.log(`      - Messages: ${messagesForAPI.length}`);
        console.log(`      - Organization ID: ${organizationId}`);
        console.log(`      - User ID: ${clerkUserId}`);
        console.log(`      - Context data included: ${contextToSend ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   Stream enabled: YES ✅ (real-time response)`);

        // Call the API with streaming
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messagesForAPI,
            organizationId,
            clerkUserId,
            contextData: contextToSend,
          }),
        });

        // Handle API errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // Check for personalization requirement error
          if (errorData.error === 'NO_PERSONALIZATION' && errorData.requiresPersonalization) {
            throw new Error('REQUIRES_PERSONALIZATION');
          }
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        console.log(`\n📬 [RESPONSE RECEIVED]`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        
        // Extract intent from response headers
        const detectedIntent = response.headers.get('X-Intent') as 'edit' | 'ideate' | 'draft' | 'feedback' | 'general' | null;
        if (detectedIntent) {
          console.log(`   🎯 Intent: ${detectedIntent.toUpperCase()}`);
          setCurrentIntent(detectedIntent);
        }

        // Create assistant message object first (empty, will be filled as stream arrives)
        const assistantMessageId = `assistant-${Date.now()}`;
        
        // Check if this is a draft/edit intent - will stream to draft panel unless it's a follow-up question
        const initialIsDraftIntent = detectedIntent === 'draft' || detectedIntent === 'edit';
        
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          intent: detectedIntent || undefined,
        };

        // Add empty assistant message to chat
        setMessages((prev) => [...prev, assistantMessage]);

        // Process the streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let chunkCount = 0;
        
        // Track if we've detected this is a follow-up question (not a real draft)
        let isFollowUpQuestion = false;
        // Track if we're currently streaming to draft panel
        let streamingToDraft = initialIsDraftIntent;
        
        // Progress phrase rotation - time-based for smooth transitions
        const progressPhrases = [
          'Generating the draft…',
          'Polishing your post…',
          'Shaping your copy…',
          'Refining tone and flow…',
          'Adding final touches…',
        ];
        let currentPhraseIndex = 0;
        let lastPhraseChangeTime = Date.now();

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        console.log(`📖 [READING STREAM] Starting to receive chunks...`);
        console.log(`   Initial draft intent: ${initialIsDraftIntent ? 'YES' : 'NO'}`);

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log(`\n✅ [STREAM COMPLETE]`);
            console.log(`   Total chunks received: ${chunkCount}`);
            console.log(`   Final message length: ${fullText.length} chars`);
            
            // Clean up common AI hallucination artifacts (file paths, git diffs, etc.)
            fullText = cleanAIResponse(fullText);
            console.log(`   Cleaned message length: ${fullText.length} chars`);
            
            // For draft/edit intents, use AI to classify if response is actual draft or follow-up question
            if (initialIsDraftIntent && fullText.trim()) {
              try {
                console.log(`🔍 [CLASSIFYING RESPONSE] Calling API to detect draft vs question...`);
                const classifyResponse = await fetch('/api/classify-response', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: fullText, intent: detectedIntent }),
                });
                
                if (classifyResponse.ok) {
                  const { responseType } = await classifyResponse.json();
                  isFollowUpQuestion = responseType === 'question';
                  console.log(`   Classification result: ${responseType.toUpperCase()}`);
                }
              } catch (classifyError) {
                console.error('Response classification failed:', classifyError);
                // Default to treating as draft on error
                isFollowUpQuestion = false;
              }
            }
            
            console.log(`   Is follow-up question: ${isFollowUpQuestion}`);
            console.log(`   Streaming to draft: ${streamingToDraft}`);
            
            // Only call draft completion if it's actually a draft (not a follow-up question)
            // IMPORTANT: Store the actual draft content in the message for conversation memory
            // The Create page will handle showing CTA buttons, but we need the content
            // in the message so the AI has context for follow-up requests like "shorten the post"
            if (streamingToDraft && !isFollowUpQuestion && onDraftStreamComplete) {
              // Clear streaming flag AND store actual draft content in the message
              // This is critical for AI memory - without this, the AI won't know what "the post" is
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: fullText, isStreamingProgress: false, draftContent: fullText }
                    : msg
                )
              );
              onDraftStreamComplete(fullText, detectedIntent as 'draft' | 'edit', assistantMessageId);
            }
            
            // For follow-up questions: ensure final content is set and streaming flag is cleared
            // This triggers the UI to switch from streaming to the follow-up question style
            if (isFollowUpQuestion) {
              // Clear the intent
              setCurrentIntent(null);
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: fullText, isStreamingProgress: false, intent: undefined, isFollowUpQuestion: true }
                    : msg
                )
              );
              
              // Signal to clear draft panel if it was streaming there
              if (streamingToDraft && onDraftStream) {
                onDraftStream('', detectedIntent as 'draft' | 'edit');
              }
            }
            
            // Call AI message complete callback for persistence (all messages)
            // Use null intent if it was a follow-up question (intent was cleared)
            if (onAIMessageComplete && fullText.trim()) {
              onAIMessageComplete(fullText, isFollowUpQuestion ? null : detectedIntent, assistantMessageId);
            }
            break;
          }

          // Decode chunk
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          chunkCount++;

          // Log progress every 5 chunks
          if (chunkCount % 5 === 0) {
            console.log(`   Received ${chunkCount} chunks (${fullText.length} chars so far)...`);
          }

          // Note: Follow-up question detection is now done via API after stream completes
          // During streaming, we optimistically stream to draft panel for draft/edit intents

          if (streamingToDraft) {
            // Stream to draft panel via callback
            if (onDraftStream) {
              onDraftStream(fullText, detectedIntent as 'draft' | 'edit');
            }
            
            // Time-based phrase rotation (every 1.8 seconds for smooth UX)
            const now = Date.now();
            if (now - lastPhraseChangeTime >= 1000) {
              currentPhraseIndex = (currentPhraseIndex + 1) % progressPhrases.length;
              lastPhraseChangeTime = now;
            }
            
            const progressText = progressPhrases[currentPhraseIndex];

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: progressText, isStreamingProgress: true }
                  : msg
              )
            );
          } else {
            // Normal streaming to chat (either not draft intent OR detected as follow-up question)
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullText }
                  : msg
              )
            );
          }
        }

        console.log(`\n✅ [CHAT COMPLETE]`);
        console.log(`   Total messages: ${messages.length + 2} (including user and AI)`);
        console.log(`   User message length: ${userMessage.length} chars`);
        console.log(`   AI response length: ${fullText.length} chars`);
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to send message';
        console.error('[CHAT] Error:', errorMessage);
        setError(errorMessage);

        // Optionally remove the user message if API call failed
        // setMessages((prev) => prev.filter((msg) => msg.id !== newUserMessage.id));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, organizationId, clerkUserId, contextData, onDraftStream, onDraftStreamComplete, onAIMessageComplete]
  );

  /**
   * Fetch organization context from database
   * Returns formatted analytics and post data
   */
  async function fetchContextData(
    orgId: string,
    userId: string
  ): Promise<ContextData> {
    try {
      console.log(`\n📥 [CONTEXT FETCH] Starting...`);
      console.log(`   Organization ID (LinkedIn Org): ${orgId}`);
      console.log(`   User ID (Clerk ID): ${userId}`);
      console.log(`   Frontend Proxy: /api/embeddings/organization/${userId}/${orgId}/context`);
      console.log(`   (Proxy calls Backend: http://localhost:5000/api/embeddings/...)`);

      const response = await fetch(
        `/api/embeddings/organization/${userId}/${orgId}/context`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`❌ [CONTEXT FETCH] Failed with status ${response.status}`);
        console.warn(`   Error: ${errorData.error || 'Unknown error'}`);
        console.warn(`   💡 Check if backend is running: npm start (in alphaz-backend folder)`);
        return {};
      }

      const data = await response.json();

      console.log(`✅ [CONTEXT FETCH] Success!`);
      console.log(`   Embeddings count: ${data.embeddings?.length || 0}`);
      console.log(`   Top posts count: ${data.topPosts?.length || 0}`);

      // Log each embedding type
      if (data.embeddings && Array.isArray(data.embeddings)) {
        const contentTypes: { [key: string]: number } = {};
        data.embeddings.forEach((e: any) => {
          contentTypes[e.content_type] = (contentTypes[e.content_type] || 0) + 1;
        });
        console.log(`   Embedding types:`, contentTypes);

        // Log summary content
        const summaryEmbed = data.embeddings.find((e: any) => e.content_type === 'summary');
        if (summaryEmbed) {
          console.log(
            `   Summary content length: ${summaryEmbed.content?.length || 0} chars`
          );
        }

        // Log demographic content
        const demoEmbed = data.embeddings.find((e: any) => e.content_type === 'demographic_data');
        if (demoEmbed) {
          console.log(
            `   Demographic content length: ${demoEmbed.content?.length || 0} chars`
          );
        }

        // Log post performance embeddings
        const postEmbeds = data.embeddings.filter((e: any) => e.content_type === 'post_performance');
        if (postEmbeds.length > 0) {
          console.log(`   Post embeddings: ${postEmbeds.length} posts`);
          postEmbeds.slice(0, 3).forEach((p: any, i: number) => {
            console.log(
              `      Post ${i + 1}: ${p.content?.substring(0, 50)}... (${p.content?.length || 0} chars)`
            );
          });
        }
      }

      // Format the context data for the AI
      const formattedContext = {
        summary: formatEmbeddings(data.embeddings, 'summary'),
        demographicData: formatEmbeddings(data.embeddings, 'demographic_data'),
        recentPosts: formatEmbeddings(data.embeddings, 'post_performance'),
        engagementPatterns: data.topPosts
          ? formatTopPosts(data.topPosts)
          : undefined,
      };

      console.log(`\n📋 [CONTEXT FORMATTED]`);
      console.log(`   Summary: ${formattedContext.summary?.length || 0} chars`);
      console.log(`   Demographic: ${formattedContext.demographicData?.length || 0} chars`);
      console.log(`   Posts: ${formattedContext.recentPosts?.length || 0} chars`);
      console.log(`   Patterns: ${formattedContext.engagementPatterns?.length || 0} chars`);

      return formattedContext;
    } catch (error) {
      console.error('[CHAT] Error fetching context:', error);
      return {}; // Return empty context on error, chat can still work
    }
  }

  /**
   * Clear all messages from chat history
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /**
   * Remove a specific message from chat
   */
  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  /**
   * Restore messages from a saved thread (for loading past conversations)
   */
  const restoreMessages = useCallback((savedMessages: ChatMessage[]) => {
    setMessages(savedMessages);
    setError(null);
  }, []);

  return {
    // State
    messages,
    isLoading,
    error,
    currentIntent,

    // Actions
    sendMessage,
    clearChat,
    removeMessage,
    restoreMessages,
  };
}

/**
 * Helper function to format embeddings for display
 */
function formatEmbeddings(embeddings: any[], contentType: string): string {
  const relevant = embeddings.filter((e) => e.content_type === contentType);

  if (relevant.length === 0) return '';

  return relevant
    .map((e) => e.content)
    .join('\n\n---\n\n')
    .substring(0, 2000); // Limit to 2000 chars to save tokens
}

/**
 * Helper function to format top posts
 */
function formatTopPosts(posts: any[]): string {
  if (!posts.length) return '';

  const formatted = posts
    .slice(0, 5)
    .map(
      (post) =>
        `Post: "${post.post_content?.substring(0, 100)}..." (Engagement: ${post.engagement_rate?.toFixed(1)}%)`
    )
    .join('\n');

  return `Top Performing Posts:\n${formatted}`;
}
