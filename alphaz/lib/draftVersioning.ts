/**
 * Draft Versioning System
 * 
 * Manages versioned drafts with parent-child relationships
 * When a draft is edited, creates v2, v3, etc. under the original draft
 */

export interface DraftVersion {
  version: number;
  content: string;
  timestamp: Date;
  changes?: string[]; // List of changes made in this version
  editPrompt?: string; // The user's edit request that created this version
}

export interface Draft {
  id: string; // Base ID (e.g., "draft-123")
  content: string; // Current version content
  timestamp: Date;
  title?: string;
  versions: DraftVersion[]; // Version history
  currentVersion: number; // Current version number (1, 2, 3, etc.)
  parentMessageId?: string; // Reference to the original assistant message
}

/**
 * Create a new draft from an AI response
 */
export function createDraft(
  messageId: string,
  content: string,
  timestamp: Date = new Date()
): Draft {
  return {
    id: `draft-${messageId}`,
    content,
    timestamp,
    versions: [
      {
        version: 1,
        content,
        timestamp,
      }
    ],
    currentVersion: 1,
    parentMessageId: messageId,
  };
}

/**
 * Create a new version of an existing draft
 */
export function createDraftVersion(
  existingDraft: Draft,
  newContent: string,
  editPrompt: string,
  changes?: string[],
  timestamp: Date = new Date()
): Draft {
  const newVersion = existingDraft.currentVersion + 1;
  
  return {
    ...existingDraft,
    content: newContent, // Update current content to new version
    currentVersion: newVersion,
    versions: [
      ...existingDraft.versions,
      {
        version: newVersion,
        content: newContent,
        timestamp,
        changes,
        editPrompt,
      }
    ],
  };
}

/**
 * Get a specific version of a draft
 */
export function getDraftVersion(draft: Draft, version: number): DraftVersion | null {
  return draft.versions.find(v => v.version === version) || null;
}

/**
 * Revert draft to a specific version
 */
export function revertToVersion(draft: Draft, version: number): Draft {
  const targetVersion = getDraftVersion(draft, version);
  if (!targetVersion) {
    return draft;
  }
  
  return {
    ...draft,
    content: targetVersion.content,
    currentVersion: version,
  };
}

/**
 * Check if a draft has multiple versions
 */
export function hasMultipleVersions(draft: Draft): boolean {
  return draft.versions.length > 1;
}

/**
 * Get version summary for display
 */
export function getVersionSummary(draft: Draft): string {
  if (draft.versions.length === 1) {
    return 'Original';
  }
  return `v${draft.currentVersion} of ${draft.versions.length}`;
}

/**
 * Extract draft content from edit response
 * Handles both structured and unstructured responses
 */
export function extractDraftFromEditResponse(response: string): {
  content: string;
  changes?: string[];
} {
  // Try to parse structured response first
  // Look for patterns like:
  // 1. Revised post / Here's the updated post
  // 2. Changes made / Key changes / Improvements
  
  const lines = response.split('\n');
  let content = '';
  let changes: string[] = [];
  let currentSection: 'content' | 'changes' | null = null;
  
  // Headers that indicate the start of content section (more comprehensive matching)
  // Matches: "1. Revised post", "## Revised post", "Revised post:", "Here's the updated version", etc.
  const contentHeaders = /^(?:1\.?\s*|##?\s*)?(?:Revised|Updated|Edited|Here'?s?\s+(?:the\s+)?(?:revised|updated|edited|new)|New|Modified)\s*(?:post|version|draft|content|LinkedIn\s*post)?:?\s*$/i;
  
  // Headers that indicate the start of changes section
  // Matches: "2. Changes made", "## Changes", "Changes made:", "Key changes:", etc.
  const changesHeaders = /^(?:2\.?\s*|##?\s*)?(?:Changes\s*(?:made)?|Improvements|Key\s+changes|What\s+(?:I\s+)?(?:changed|improved|updated)|Modifications|Updates\s+made):?\s*$/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines at the start
    if (!trimmedLine && !content && !currentSection) continue;
    
    // Detect section headers
    if (trimmedLine.match(contentHeaders)) {
      currentSection = 'content';
      continue;
    } else if (trimmedLine.match(changesHeaders)) {
      currentSection = 'changes';
      continue;
    }
    
    // Collect content based on current section
    if (currentSection === 'content') {
      // Stop collecting content if we hit a changes section marker
      if (trimmedLine.match(changesHeaders)) {
        currentSection = 'changes';
        continue;
      }
      // Preserve original line (don't trim) to maintain spacing
      content += line + '\n';
    } else if (currentSection === 'changes' && trimmedLine) {
      // Extract bullet points or numbered items
      const cleaned = trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
      if (cleaned && !cleaned.match(contentHeaders)) {
        changes.push(cleaned);
      }
    } else if (!currentSection) {
      // No section detected yet - might be unstructured
      // But check if we're hitting a changes section marker
      if (trimmedLine.match(changesHeaders)) {
        currentSection = 'changes';
        continue;
      }
      // Collect as content
      content += line + '\n';
    }
  }
  
  // If no structured format detected (no headers found), try to split on common patterns
  if (!changes.length && content.trim()) {
    // Look for changes section at the end (common pattern: content followed by "Changes:" or similar)
    const changesMatch = content.match(/\n\n(?:2\.\s*)?(?:Changes(?:\s+made)?|Key changes|Improvements|What (?:I )?changed|Updates made):?\s*\n([\s\S]+)$/i);
    if (changesMatch) {
      // Extract the changes part
      const changesText = changesMatch[1];
      content = content.replace(changesMatch[0], '').trim();
      
      // Parse bullet points from changes
      const bulletLines = changesText.split('\n').filter(l => l.trim());
      bulletLines.forEach(line => {
        const cleaned = line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        if (cleaned) {
          changes.push(cleaned);
        }
      });
    }
  }
  
  // Clean up content - remove trailing whitespace
  content = content.trim();
  
  // If still no content, use the entire response
  if (!content) {
    content = response.trim();
  }
  
  // Final cleanup: Remove any remaining header patterns at the start of content
  // This catches cases where the header wasn't properly detected as a separate line
  content = content
    .replace(/^(?:1\.?\s*)?(?:Revised|Updated|Edited)\s*(?:post|version|draft|content|LinkedIn\s*post)?:?\s*\n+/i, '')
    .replace(/^(?:Here'?s?\s+(?:the\s+)?(?:revised|updated|edited|new)\s*(?:post|version|draft|content)?:?\s*\n+)/i, '')
    .trim();
  
  return {
    content,
    changes: changes.length > 0 ? changes : undefined,
  };
}

/**
 * Check if a message is an edit response
 * Based on presence of numbered sections or change descriptions
 */
export function isEditResponse(content: string): boolean {
  const patterns = [
    /^1\./m,
    /Revised post/i,
    /Updated post/i,
    /^2\./m,
    /Changes made/i,
    /Improvements/i,
    /What.*improved/i,
  ];
  
  return patterns.some(pattern => pattern.test(content));
}

/**
 * Check if a message is a follow-up question (not a draft)
 */
export function isFollowUpQuestion(content: string): boolean {
  // Check if it's clearly NOT a structured edit response
  const hasStructuredFormat = /^1\.|Revised post/im.test(content);
  if (hasStructuredFormat) {
    return false; // It's a structured edit response
  }
  
  // If content is long (>300 chars), it's likely a draft, not a question
  if (content.length > 300) {
    return false;
  }
  
  // Check if it starts with a question word (strong indicator of clarifying question)
  const startsWithQuestion = /^(Could you|Can you|Would you|Should I|Do you want|Do you mean|What|Which|How|Why|Where|When)/i.test(content.trim());
  
  // Check for clarification phrases
  const hasClarificationPhrase = /clarify|which (one|type|style|tone|version|approach)|what do you mean|more specific|help me understand|not sure (what|which|how)/i.test(content);
  
  // Only return true if it STARTS with a question OR has clarification phrases
  // A question mark at the end alone is not enough (drafts can end with questions)
  return startsWithQuestion || hasClarificationPhrase;
}
