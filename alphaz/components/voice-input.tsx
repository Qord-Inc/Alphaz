"use client";

import { Mic, Square, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const {
    isRecording,
    isTranscribing,
    duration,
    error,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    onTranscriptionComplete: (text) => {
      onTranscript(text);
    },
    onError: (error) => {
      console.error('Recording error:', error);
    },
  });

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle mic button click
  const handleClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        className={`transition-all duration-200 ${
          isRecording
            ? 'text-red-500 hover:text-red-600'
            : isTranscribing
            ? 'text-orange-500'
            : 'text-muted-foreground hover:text-foreground'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Start voice input'}
      >
        {isTranscribing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <Square className="h-5 w-5 fill-current" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>
      
      {/* Duration indicator */}
      {isRecording && (
        <span className="text-xs font-mono text-red-500 tabular-nums">
          {formatDuration(duration)}
        </span>
      )}
      
      {/* Transcribing indicator */}
      {isTranscribing && (
        <span className="text-xs text-muted-foreground">
          Transcribing...
        </span>
      )}
    </div>
  );
}
