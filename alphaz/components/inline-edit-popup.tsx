'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { X, Send, Sparkles } from 'lucide-react';

interface InlineEditPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onSubmit: (instruction: string, selectedText: string) => void;
  onClose: () => void;
}

export const InlineEditPopup = memo(({ 
  selectedText, 
  position, 
  onSubmit, 
  onClose 
}: InlineEditPopupProps) => {
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Auto-focus textarea when popup opens
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(instruction, selectedText);
      onClose();
    } catch (error) {
      console.error('Inline edit failed:', error);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-card border-2 border-primary shadow-2xl rounded-xl w-96 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Edit Selected Text</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Selected Text Preview */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="text-xs font-medium text-muted-foreground mb-1">Selected text:</div>
        <div className="text-sm text-foreground bg-card px-3 py-2 rounded border border-border max-h-20 overflow-y-auto">
          "{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <Textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="E.g., 'make this more professional', 'simplify this', 'add more details'..."
          className="min-h-[80px] text-sm resize-none"
          disabled={isSubmitting}
        />
        
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to submit
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!instruction.trim() || isSubmitting}
              className="bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Editing...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-2" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

InlineEditPopup.displayName = 'InlineEditPopup';
