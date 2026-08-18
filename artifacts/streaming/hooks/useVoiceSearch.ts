import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, NativeModules } from 'react-native';

let Voice: any = null;
if (Platform.OS !== 'web') {
  try {
    // Only initialize if the native module is actually linked (prevents crash in standard Expo Go)
    if (NativeModules.Voice) {
      Voice = require('@react-native-voice/voice').default;
    } else {
      console.warn("NativeModules.Voice is null. Voice search will be disabled.");
    }
  } catch (e) {
    console.error("Voice module not found", e);
  }
}

export const useVoiceSearch = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US'; 

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            onResult(transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setError(event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setError('Speech recognition not supported in this environment.');
      }
    } else if (Voice) {
      Voice.onSpeechStart = () => {
        setIsListening(true);
        setError(null);
      };
      Voice.onSpeechEnd = () => {
        setIsListening(false);
      };
      Voice.onSpeechError = (e: any) => {
        console.error("Native speech error:", e);
        setError(e.error?.message || "Speech error");
        setIsListening(false);
      };
      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value.length > 0) {
          onResult(e.value[0]);
        }
      };

      return () => {
        Voice.destroy().then(Voice.removeAllListeners);
      };
    }
  }, [onResult]);

  const toggleListening = useCallback(async () => {
    if (Platform.OS !== 'web' && Voice) {
      if (isListening) {
        try {
          await Voice.stop();
        } catch (e) {
          console.error("Failed to stop Voice", e);
        }
      } else {
        setError(null);
        try {
          await Voice.start('en-US');
        } catch (e) {
          console.error("Failed to start Voice", e);
        }
      }
      return;
    }

    if (Platform.OS === 'web') {
      try {
        if (typeof document !== 'undefined') {
          const input = document.querySelector('input');
          if (input) input.focus();
        }
        setTimeout(() => {
          fetch('/api/dictate').catch(console.error);
        }, 100);
      } catch (err) {
        console.error("Failed to trigger dictation", err);
      }
    }
  }, [isListening]);

  const isSupported = Platform.OS === 'web' || !!Voice;

  return {
    isListening,
    toggleListening,
    error,
    isSupported
  };
};
