import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

// =============================================================================
// useSpeechRecognition
// -----------------------------------------------------------------------------
// Custom hook for browser speech recognition.
//
// Features:
// - Chrome / Edge support
// - Live transcription
// - Continuous listening
// - Start / Stop recording
// - Auto cleanup
// - Permission handling
// - Safe for React Strict Mode
// =============================================================================

export default function useSpeechRecognition(onTranscript) {
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef("");

    const [supported, setSupported] = useState(true);
    const [isRecording, setIsRecording] = useState(false);

    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            setIsRecording(true);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.onerror = (event) => {
            setIsRecording(false);

            switch (event.error) {
                case "not-allowed":
                    toast.error("Microphone permission denied.");
                    break;

                case "no-speech":
                    toast.error("No speech detected.");
                    break;

                case "audio-capture":
                    toast.error("No microphone found.");
                    break;

                default:
                    toast.error("Speech recognition failed.");
            }
        };

        recognition.onresult = (event) => {
            let transcript = finalTranscriptRef.current;

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {
                transcript += event.results[i][0].transcript;
            }

            if (onTranscript) {
                onTranscript(transcript);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
    }, [onTranscript]);

    const startRecording = useCallback((existingText = "") => {
        if (!recognitionRef.current) {
            toast.error("Speech Recognition is not supported.");
            return;
        }

        finalTranscriptRef.current = existingText;

        try {
            recognitionRef.current.start();
        } catch {
            // Ignore duplicate start() calls
        }
    }, []);

    const stopRecording = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    return {
        supported,
        isRecording,
        startRecording,
        stopRecording,
    };
}