import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeConversation, analyzeAudioConversation } from './services/geminiService';
import { BotMessageSquare, Loader, AlertTriangle, MessageCircle, Sparkles, Mic, Upload, FileAudio, Square } from 'lucide-react';

type InputMode = 'text' | 'audio';

const AnalysisDisplay = ({ result, isLoading, error }: { result: string | null, isLoading: boolean, error: string | null }) => {
  const formatAnalysis = (text: string): string => {
    return text
      .split('\n')
      .map(line => {
        // ### Heading
        if (line.startsWith('### ')) {
          return `<h3 class="text-lg font-semibold text-sky-400 mt-6 mb-3 border-b border-slate-700 pb-2">${line.replace('### ', '')}</h3>`;
        }
        // * **[Participant A]:**
        if (line.match(/^\*\s*\*\*(.*)\:\*\*/)) {
          return `<div class="mt-4"><strong class="font-semibold text-slate-100">${line.replace(/^\*\s*/, '').replace(/\*/g, '')}</strong></div>`;
        }
        // * **Main Consensus:**
        if (line.match(/^\*\s*\*\*(.*)\*\*/)) {
            return `<div class="mt-4"><strong class="font-semibold text-slate-100">${line.replace(/^\*\s*/, '').replace(/\*/g, '')}</strong></div>`;
        }
        //     * **Main Emotion:** Sad
        if (line.match(/^\s+\*\s*\*\*(.*:)\*\*\s(.*)/)) {
            const match = line.match(/^\s+\*\s*\*\*(.*:)\*\*\s(.*)/);
            if (!match) return '';
            const key = match[1];
            const value = match[2];
            if (value.startsWith('"') && value.endsWith('"')) {
                 return `<p class="ml-5 text-slate-400"><strong class="font-medium text-slate-300">${key}</strong> <em class="text-amber-300 not-italic">${value}</em></p>`;
            }
            return `<p class="ml-5 text-slate-400"><strong class="font-medium text-slate-300">${key}</strong> ${value}</p>`;
        }
        //     * A list item
        if (line.match(/^\s+\*/)) {
             return `<li class="ml-10 list-disc text-slate-400">${line.replace(/^\s+\*/, '').trim()}</li>`;
        }
         // Handle simple list items for the new summary section
        if (line.match(/^-\s(.+)/)) {
          return `<li class="ml-6 list-disc text-slate-400">${line.substring(2)}</li>`;
        }
        return line; // Return un-matched lines as-is, which might be part of the summary.
      })
      .join('\n') // Re-join with newlines initially to preserve paragraphs
      .replace(/\n/g, '<br />'); // Then replace newlines with <br> for HTML rendering
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-sky-400">
        <Loader className="h-10 w-10 animate-spin" />
        <p className="text-lg font-medium">Analyzing conversation...</p>
        <p className="text-sm text-slate-400">Audio processing may take a few moments.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
        <AlertTriangle className="h-10 w-10" />
        <p className="text-lg font-medium">An Error Occurred</p>
        <p className="text-sm text-slate-400 text-center">{error}</p>
      </div>
    );
  }

  if (result) {
    return (
      <div>
        <div dangerouslySetInnerHTML={{ __html: formatAnalysis(result) }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
      <BotMessageSquare className="h-12 w-12" />
      <p className="text-lg font-medium">Analysis will appear here</p>
      <p className="text-sm text-center">Provide a conversation and click "Analyze" to begin.</p>
    </div>
  );
};

export default function App() {
  const [conversationText, setConversationText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InputMode>('text');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const recordedFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
            setAudioFile(recordedFile);
            stream.getTracks().forEach(track => track.stop()); // Stop the microphone access
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        setAudioFile(null); // Clear previous recording/file
        setRecordingTime(0);
        recordingIntervalRef.current = window.setInterval(() => {
            setRecordingTime(prevTime => prevTime + 1);
        }, 1000);

    } catch (err) {
        console.error("Error starting recording:", err);
        setError("Microphone access was denied. Please allow microphone access in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if(recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
        if(recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const handleAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      let result;
      if (activeTab === 'text') {
        if (!conversationText.trim()) {
          setError("Please enter a conversation to analyze.");
          setIsLoading(false);
          return;
        }
        result = await analyzeConversation(conversationText);
      } else { // audio tab
        if (!audioFile) {
          setError("Please upload or record an audio file to analyze.");
          setIsLoading(false);
          return;
        }
        result = await analyzeAudioConversation(audioFile);
      }
      setAnalysisResult(result);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [conversationText, activeTab, audioFile]);
  
  const isAnalyzeDisabled = isLoading || (activeTab === 'text' && !conversationText.trim()) || (activeTab === 'audio' && !audioFile);
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
            <div className="flex justify-center items-center gap-3">
                <MessageCircle className="h-8 w-8 text-sky-400" />
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">
                    Conversation Analyst AI
                </h1>
            </div>
          <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">
            Objectively analyze your conversations to understand emotional dynamics and key discussion points.
          </p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Input Column */}
          <div className="flex flex-col gap-4">
             <div className="border-b border-slate-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('text')} className={`${activeTab === 'text' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>
                        Text Input
                    </button>
                    <button onClick={() => setActiveTab('audio')} className={`${activeTab === 'audio' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>
                        Audio Input
                    </button>
                </nav>
             </div>
            
            <div className="w-full h-96 min-h-[24rem] bg-slate-800 border border-slate-700 rounded-lg p-4 flex flex-col">
                {activeTab === 'text' ? (
                     <textarea
                        value={conversationText}
                        onChange={(e) => setConversationText(e.target.value)}
                        placeholder="Paste the conversation text here..."
                        className="w-full h-full bg-transparent focus:outline-none text-slate-300 resize-none"
                        disabled={isLoading}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center gap-6">
                        <label htmlFor="audio-upload" className="w-full cursor-pointer bg-slate-700/50 hover:bg-slate-700 border-2 border-dashed border-slate-600 rounded-lg p-6 flex flex-col items-center justify-center text-center transition-colors">
                            <Upload className="h-10 w-10 text-slate-500 mb-2"/>
                            <span className="font-semibold text-slate-300">Click to upload an audio file</span>
                            <span className="text-xs text-slate-500 mt-1">MP3, WAV, M4A, etc.</span>
                            <input id="audio-upload" type="file" className="hidden" accept="audio/*" onChange={handleFileChange} disabled={isLoading || isRecording} />
                        </label>
                        <div className="text-slate-500 font-semibold">OR</div>
                        {isRecording ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="text-red-400 text-2xl font-mono animate-pulse">{formatTime(recordingTime)}</div>
                                <button onClick={stopRecording} className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 transition-colors">
                                    <Square className="h-5 w-5 fill-white"/>
                                    Stop Recording
                                </button>
                            </div>
                        ) : (
                            <button onClick={startRecording} disabled={isLoading} className="flex items-center justify-center gap-2 bg-sky-600/20 text-sky-300 font-bold py-2 px-6 rounded-lg hover:bg-sky-600/40 border border-sky-600 transition-colors">
                                <Mic className="h-5 w-5"/>
                                Record Audio
                            </button>
                        )}
                        {audioFile && (
                            <div className="mt-4 w-full bg-slate-700/50 p-3 rounded-lg flex items-center gap-3 text-sm">
                                <FileAudio className="h-5 w-5 text-sky-400 flex-shrink-0"/>
                                <span className="text-slate-300 truncate font-medium" title={audioFile.name}>{audioFile.name}</span>
                                <span className="text-slate-400 ml-auto flex-shrink-0">({(audioFile.size / 1024).toFixed(1)} KB)</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzeDisabled}
              className="flex items-center justify-center gap-2 w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-sky-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isLoading ? (
                <>
                  <Loader className="animate-spin h-5 w-5" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Analyze Conversation
                </>
              )}
            </button>
          </div>

          {/* Output Column */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-slate-100">Analysis Report</h2>
            <div className="w-full h-96 min-h-[24rem] bg-slate-800/50 border border-slate-700 rounded-lg p-6 overflow-y-auto">
              <AnalysisDisplay result={analysisResult} isLoading={isLoading} error={error} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}