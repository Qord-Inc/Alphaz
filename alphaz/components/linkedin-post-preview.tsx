'use client';

import { Building2 } from 'lucide-react';
import { memo } from 'react';

interface LinkedInPostPreviewProps {
  organizationName: string;
  organizationImage?: string;
  postContent: string;
  timestamp?: string;
}

export const LinkedInPostPreview = memo(({ 
  organizationName, 
  organizationImage, 
  postContent,
  timestamp = 'Just now'
}: LinkedInPostPreviewProps) => {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Post Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Organization Avatar */}
          <div className="flex-shrink-0">
            {organizationImage ? (
              <img 
                src={organizationImage} 
                alt={organizationName}
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>

          {/* Organization Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate">
              {organizationName}
            </h3>
            <p className="text-xs text-muted-foreground">
              Company • Follow
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {timestamp} • 🌎
            </p>
          </div>

          {/* More Options */}
          <button className="text-muted-foreground hover:bg-muted rounded p-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
          {postContent || (
            <span className="text-muted-foreground italic">
              Your post content will appear here...
            </span>
          )}
        </div>
      </div>

      {/* Post Stats */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <div className="w-4 h-4 rounded-full bg-blue-500 border border-white flex items-center justify-center">
                <span className="text-white text-[8px]">👍</span>
              </div>
              <div className="w-4 h-4 rounded-full bg-red-500 border border-white flex items-center justify-center">
                <span className="text-white text-[8px]">❤️</span>
              </div>
              <div className="w-4 h-4 rounded-full bg-green-500 border border-white flex items-center justify-center">
                <span className="text-white text-[8px]">💡</span>
              </div>
            </div>
            <span>0</span>
          </div>
          <div className="flex items-center gap-3">
            <span>0 comments</span>
            <span>•</span>
            <span>0 reposts</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 border-t border-border">
        <div className="flex items-center justify-around">
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            <span className="text-sm font-medium">Like</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-medium">Comment</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm font-medium">Repost</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-muted rounded transition text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="text-sm font-medium">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
});

LinkedInPostPreview.displayName = 'LinkedInPostPreview';
