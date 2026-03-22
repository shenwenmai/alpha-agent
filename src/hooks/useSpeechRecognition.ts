import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================
// Web Speech API 语音识别 Hook
// MVP 使用浏览器内置 API（免费，无 API 成本）
// ============================================================

interface SpeechRecognitionHook {
  /** 当前识别到的文本 */
  transcript: string;
  /** 临时（中间）结果 */
  interimTranscript: string;
  /** 是否正在监听 */
  isListening: boolean;
  /** 浏览器是否支持 */
  isSupported: boolean;
  /** 开始监听 */
  startListening: () => void;
  /** 停止监听 */
  stopListening: () => void;
  /** 清空文本 */
  resetTranscript: () => void;
  /** 错误信息 */
  error: string | null;
}

// 浏览器兼容性
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useSpeechRecognition(lang = 'zh-CN'): SpeechRecognitionHook {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isSupported = !!SpeechRecognitionAPI;

  // 清理
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('你的浏览器不支持语音识别，请使用 Chrome');
      return;
    }

    // Fix: 先停止旧实例，避免重复录入
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    setError(null);

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      const errorMap: Record<string, string> = {
        'no-speech': '没有检测到语音，请重试',
        'audio-capture': '无法使用麦克风，请检查权限',
        'not-allowed': '麦克风权限被拒绝',
        'network': '网络错误',
        'aborted': '识别被中断',
      };
      setError(errorMap[event.error] || `识别错误: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      setError('启动语音识别失败');
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  };
}
