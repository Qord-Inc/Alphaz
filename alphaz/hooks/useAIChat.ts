'use client';

import { useState, useCallback } from 'react';

/**
 * Type definitions for chat messages
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: 'edit' | 'ideate' | 'draft' | 'feedback';
  draftContent?: string; // Clean post content for draft intent
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
}: {
  organizationId: string;
  clerkUserId: string;
  contextData?: ContextData;
  /** Called with each streaming chunk when intent is 'draft' or 'edit' */
  onDraftStream?: (content: string, intent: 'draft' | 'edit') => void;
  /** Called when draft streaming is complete */
  onDraftStreamComplete?: (content: string, intent: 'draft' | 'edit', messageId: string) => void;
}) {
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIntent, setCurrentIntent] = useState<'edit' | 'ideate' | 'draft' | 'feedback' | null>(null);

  /**
   * Send a message to the AI
   * Automatically fetches context from database if not provided
   */
  const sendMessage = useCallback(
    async (userMessage: string) => {
      // Validate input
      if (!userMessage.trim()) {
        setError('Message cannot be empty');
        return;
      }

      // Reset error
      setError(null);

      // Create user message object
      const newUserMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      // Add user message to chat
      setMessages((prev) => [...prev, newUserMessage]);

      // Show loading state
      setIsLoading(true);

      try {
        // Get context data (from props or fetch from database)
        console.log(`\n💬 [SEND MESSAGE] User message: "${userMessage.substring(0, 50)}..."`);

        const contextToSend = contextData || (await fetchContextData(organizationId, clerkUserId));

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
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        console.log(`\n📬 [RESPONSE RECEIVED]`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        
        // Extract intent from response headers
        const detectedIntent = response.headers.get('X-Intent') as 'edit' | 'ideate' | 'draft' | 'feedback' | null;
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
            console.log(`   Is follow-up question: ${isFollowUpQuestion}`);
            console.log(`   Streaming to draft: ${streamingToDraft}`);
            
            // Only call draft completion if it's actually a draft (not a follow-up question)
            if (streamingToDraft && !isFollowUpQuestion && onDraftStreamComplete) {
              onDraftStreamComplete(fullText, detectedIntent as 'draft' | 'edit', assistantMessageId);
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

          // Check if this is a follow-up question after we have enough content
          // Only check once when we have 50-150 chars (enough to detect question pattern)
          if (initialIsDraftIntent && !isFollowUpQuestion && fullText.length >= 50 && fullText.length < 200) {
            // Import the detection function
            const { isFollowUpQuestion: checkIsFollowUp } = require('@/lib/draftVersioning');
            isFollowUpQuestion = checkIsFollowUp(fullText);
            
            if (isFollowUpQuestion) {
              console.log(`🔄 Detected follow-up question, switching to chat stream`);
              streamingToDraft = false;
              
              // Signal to stop draft streaming
              if (onDraftStream) {
                onDraftStream('', detectedIntent as 'draft' | 'edit'); // Clear draft panel
              }
            }
          }

          if (streamingToDraft && !isFollowUpQuestion) {
            // Stream to draft panel via callback
            if (onDraftStream) {
              onDraftStream(fullText, detectedIntent as 'draft' | 'edit');
            }
            // Update chat message with a placeholder/CTA message
            const ctaMessage = detectedIntent === 'edit' 
              ? "✨ I've updated your draft. You can see the changes in the preview panel."
              : "✨ I've created a draft for you. You can view and edit it in the preview panel.";
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: ctaMessage }
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
    [messages, organizationId, clerkUserId, contextData, onDraftStream, onDraftStreamComplete]
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
