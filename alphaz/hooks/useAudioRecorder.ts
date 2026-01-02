import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderProps {
  onTranscriptionComplete?: (text: string) => void;
  onError?: (error: string) => void;
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  duration: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  cancelRecording: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function useAudioRecorder({
  onTranscriptionComplete,
  onError,
}: UseAudioRecorderProps = {}): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset refs
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    startTimeRef.current = null;
  }, []);

  // Monitor audio levels for visual feedback
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume (0-1 range)
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);
    
    setAudioLevel(normalizedLevel);

    // Continue monitoring
    animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDuration(0);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;

      // Set up audio context for level monitoring
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start monitoring audio levels
      monitorAudioLevel();

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm'
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      
      // Track duration
      startTimeRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setDuration(elapsed);
        }
      }, 100);

    } catch (err: any) {
      console.error('Failed to start recording:', err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Microphone access denied. Please allow microphone access to use voice input.'
        : 'Failed to start recording. Please check your microphone.';
      
      setError(errorMessage);
      onError?.(errorMessage);
      cleanup();
    }
  }, [cleanup, monitorAudioLevel, onError]);

  // Stop recording and transcribe
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setAudioLevel(0);
        
        // Stop duration tracking
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        const recordingDuration = duration;

        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
          });

          // Check if recording is too short
          if (recordingDuration < 1) {
            throw new Error('Recording too short. Please speak for at least 1 second.');
          }

          setIsTranscribing(true);

          // Send to backend for transcription
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('duration', recordingDuration.toString());

          const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Transcription failed');
          }

          const { text } = await response.json();

          if (!text || text.trim() === '') {
            throw new Error('No speech detected. Please try again.');
          }

          // Success - call callback
          onTranscriptionComplete?.(text.trim());

        } catch (err: any) {
          console.error('Transcription error:', err);
          const errorMessage = err.message || 'Failed to transcribe audio. Please try again.';
          setError(errorMessage);
          onError?.(errorMessage);
        } finally {
          setIsTranscribing(false);
          setDuration(0);
          cleanup();
          resolve();
        }
      };

      // Stop the media recorder
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    });
  }, [isRecording, duration, cleanup, onTranscriptionComplete, onError]);

  // Cancel recording without transcribing
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      setDuration(0);
      setError(null);
      cleanup();
    }
  }, [isRecording, cleanup]);

  return {
    isRecording,
    isTranscribing,
    audioLevel,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
