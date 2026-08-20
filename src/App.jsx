import Login from "./Login";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useRef } from "react";

import Header from "./components/Header";
import UploadResume from "./components/UploadResume";
import QuestionPanel from "./components/QuestionPanel";
import AnswerPanel from "./components/AnswerPanel";

import "./styles/app.css";

const trimTrailingSlash = (value) => (value || "").replace(/\/+$/, "");

const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL ||
    "https://aiinterviewassistance-5.onrender.com"
);

const WS_URL = trimTrailingSlash(
  import.meta.env.VITE_WS_URL ||
    API_BASE_URL.replace(/^https:/, "wss:").replace(/^http:/, "ws:")
);

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [question, setQuestion] = useState("");
  const [showConfig, setShowConfig] = useState(true);
  const [answerData, setAnswerData] = useState(null);
  const [, setConversationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [resumeName, setResumeName] = useState("");
  const [resumeProfile, setResumeProfile] = useState(null);

  const [company, setCompany] = useState("Oracle");
  const [customCompany, setCustomCompany] = useState("");
  const [interviewLevel, setInterviewLevel] = useState("Mid Level");
  const [interviewType, setInterviewType] = useState("Technical");
  const [skills, setSkills] = useState([]);

  const [isInterviewRunning, setIsInterviewRunning] = useState(false);

  const [toast, setToast] = useState({
    message: "",
    type: "",
    visible: false,
  });

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const screenStreamRef = useRef(null);
  const textareaRef = useRef(null);

  const answerAbortRef = useRef(null);
  const conversationHistoryRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const liveQuestionRef = useRef("");
  const questionLockedRef = useRef(false);
  const waitingForNextQuestionRef = useRef(false);

  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const ignoreStaleTranscriptRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [question]);

  const showToast = (message, type = "info") => {
    setToast({
      message,
      type,
      visible: true,
    });

    setTimeout(() => {
      setToast((previous) => ({
        ...previous,
        visible: false,
      }));
    }, 4500);
  };

  const saveConversationTurn = (askedQuestion, generatedAnswer) => {
    const cleanQuestion = String(askedQuestion || "").trim();
    const cleanAnswer = String(generatedAnswer || "").trim();

    if (!cleanQuestion || !cleanAnswer) {
      return;
    }

    const updatedHistory = [
      ...conversationHistoryRef.current,
      { role: "user", content: cleanQuestion },
      { role: "assistant", content: cleanAnswer },
    ].slice(-6);

    conversationHistoryRef.current = updatedHistory;
    setConversationHistory(updatedHistory);
  };

  const updateQuestionFromTranscript = (payload) => {
    const text = (payload?.text || "").trim();

    if (waitingForNextQuestionRef.current && text) {
      waitingForNextQuestionRef.current = false;
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      liveQuestionRef.current = "";
      setQuestion("");
    }

    if (!text || questionLockedRef.current) {
      return;
    }

    if (ignoreStaleTranscriptRef.current) {
      ignoreStaleTranscriptRef.current = false;
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
    }

    clearTimeout(silenceTimerRef.current);

    if (payload.isFinal || payload.speechFinal) {
      const previousFinal = finalTranscriptRef.current.trim();

      if (!previousFinal.endsWith(text)) {
        finalTranscriptRef.current = previousFinal
          ? `${previousFinal} ${text}`
          : text;
      }

      interimTranscriptRef.current = "";
    } else {
      interimTranscriptRef.current = text;
    }

    const completeQuestion = [
      finalTranscriptRef.current,
      interimTranscriptRef.current,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    liveQuestionRef.current = completeQuestion;
    setQuestion(completeQuestion);

    silenceTimerRef.current = setTimeout(() => {
      interimTranscriptRef.current = "";
      const completedQuestion = finalTranscriptRef.current.trim();
      liveQuestionRef.current = completedQuestion;
      setQuestion(completedQuestion);
    }, 4000);
  };

  const openInterviewSocket = () => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return resolve(socketRef.current);
      }

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          // Socket cleanup
        }
      }

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, 10000);

      socket.onopen = () => {
        clearTimeout(timeout);
        resolve(socket);
      };

      socket.onmessage = (event) => {
        if (!event.data) return;

        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "transcript") {
            updateQuestionFromTranscript(payload);
          } else if (payload.error) {
            console.error("Deepgram Error:", payload.error);
          }
        } catch {
          updateQuestionFromTranscript({
            type: "transcript",
            text: event.data,
            isFinal: true,
          });
        }
      };

      socket.onerror = (error) => {
        clearTimeout(timeout);
        console.error("WebSocket Error:", error);
        reject(error);
      };

      socket.onclose = () => {
        // Socket closed
      };
    });
  };

  const closeInterviewSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // Socket cleanup
      }
    }
    socketRef.current = null;
  };

  const handleResumeUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      showToast("Please upload a PDF resume.", "error");
      return;
    }

    setResumeFile(file);
    setResumeName(file.name);
    setResumeProfile(null);
    setSkills([]);
    showToast("Resume attached! Ready to start.", "success");
  };

  const stopInterviewMode = () => {
    clearTimeout(silenceTimerRef.current);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Safe stop
      }
    }
    mediaRecorderRef.current = null;

    if (
      audioContextRef.current &&
      audioContextRef.current.state !== "closed"
    ) {
      try {
        audioContextRef.current.close();
      } catch {
        // Safe close
      }
    }
    audioContextRef.current = null;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    closeInterviewSocket();
    setIsInterviewRunning(false);
  };

  const startInterviewMode = async () => {
    setQuestion("");
    questionLockedRef.current = false;
    waitingForNextQuestionRef.current = false;
    ignoreStaleTranscriptRef.current = false;

    liveQuestionRef.current = "";
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    clearTimeout(silenceTimerRef.current);

    try {
      setIsInterviewRunning(true);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];

      if (!audioTrack) {
        showToast(
          "Select a Chrome tab and enable 'Share tab audio'.",
          "error"
        );
        setIsInterviewRunning(false);
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      // Handle user stopping screen share via Chrome native bar
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopInterviewMode();
      });

      audioTrack.addEventListener("ended", () => {
        stopInterviewMode();
      });

      const socket = await openInterviewSocket();

      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(destination.stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (
          event.data &&
          event.data.size > 0 &&
          socket.readyState === WebSocket.OPEN
        ) {
          socket.send(event.data);
        }
      };

      recorder.start(100);
      return true;
    } catch (error) {
      console.error(error);
      showToast(
        "Unable to start interview audio. Check sharing permissions.",
        "error"
      );
      stopInterviewMode();
      return false;
    }
  };

  const streamAnswer = async (payload, fallbackMessage) => {
    try {
      answerAbortRef.current?.abort();
      answerAbortRef.current = new AbortController();

      setLoading(true);
      setAnswerData("");

      const response = await fetch(`${API_BASE_URL}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: answerAbortRef.current.signal,
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to generate answer");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setAnswerData(fullText);
      }

      return fullText.trim();
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.error(error);
      setAnswerData(fallbackMessage);
      return "";
    } finally {
      setLoading(false);
    }
  };

  const startInterviewFlow = async () => {
    if (!resumeFile && !resumeProfile) {
      showToast("Please upload a PDF resume first.", "info");
      return;
    }

    answerAbortRef.current?.abort();

    conversationHistoryRef.current = [];
    setConversationHistory([]);

    setQuestion("");
    setAnswerData("");

    questionLockedRef.current = false;
    waitingForNextQuestionRef.current = false;
    ignoreStaleTranscriptRef.current = false;

    liveQuestionRef.current = "";
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    clearTimeout(silenceTimerRef.current);

    try {
      // 1. Direct user gesture: Ask for Screen & Audio permission first
      const audioStarted = await startInterviewMode();
      if (!audioStarted) {
        return;
      }

      setInterviewStarted(true);
      setShowConfig(false);

      let profile = resumeProfile;

      // 2. Extract profile if not already cached
      if (!profile) {
        setLoading(true);
        setAnswerData(
          "⏳ Reading your resume and preparing your interview profile..."
        );

        const formData = new FormData();
        formData.append("resume", resumeFile);

        const response = await fetch(`${API_BASE_URL}/resume-summary`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = "Unable to create resume profile";
          try {
            const errorData = await response.json();
            if (errorData?.error) errorMessage = errorData.error;
          } catch {
            // Keep fallback message
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.resumeProfile) {
          throw new Error("Resume profile is empty");
        }

        profile = data.resumeProfile;
        setResumeProfile(profile);

        if (Array.isArray(profile.primarySkills)) {
          setSkills(profile.primarySkills);
        }
      }

      // 3. Generate self-introduction
      setLoading(true);
      setAnswerData("⏳ Preparing your self-introduction...");

      const introQuestion = "Tell me about yourself";
      setQuestion(introQuestion); // Set question in UI for context consistency

      const generatedIntro = await streamAnswer(
        {
          question: introQuestion,
          company: company === "Others" ? customCompany : company,
          interviewLevel,
          interviewType,
          history: [],
          resumeProfile: profile,
        },
        "Unable to generate self-introduction right now. Please try again."
      );

      if (!generatedIntro?.trim()) {
        throw new Error("Self-introduction generation failed");
      }

      saveConversationTurn(introQuestion, generatedIntro);
    } catch (error) {
      console.error("Interview Start Error:", error);
      setAnswerData("Unable to start the interview. Please try again.");
      showToast("Unable to start interview.", "error");
    } finally {
      setLoading(false);
    }
  };

  const clearQuestionAndAnswer = () => {
    clearTimeout(silenceTimerRef.current);
    questionLockedRef.current = false;
    ignoreStaleTranscriptRef.current = true;

    liveQuestionRef.current = "";
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    setQuestion("");

    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
    }
  };

  const generateAnswer = async () => {
    questionLockedRef.current = true;

    if (!question.trim()) {
      showToast("Question panel is empty.", "info");
      questionLockedRef.current = false;
      return;
    }

    const askedQuestion = question.trim();

    const generatedAnswer = await streamAnswer(
      {
        question: askedQuestion,
        company: company === "Others" ? customCompany : company,
        interviewLevel,
        interviewType,
        history: conversationHistoryRef.current,
        resumeProfile,
      },
      "Unable to generate answer right now. Please try again."
    );

    if (generatedAnswer?.trim()) {
      saveConversationTurn(askedQuestion, generatedAnswer);
    }

    questionLockedRef.current = false;
    waitingForNextQuestionRef.current = true;
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "white",
          fontFamily: "Segoe UI",
          fontSize: "22px",
          fontWeight: "700",
        }}
      >
        Loading AI Interview Assistant...
      </div>
    );
  }

  if (!user) {
    return <Login setUser={setUser} />;
  }

  return (
    <>
      <Header
        user={user}
        logout={() => {
          stopInterviewMode();
          signOut(auth);
          setUser(null);
        }}
      />

      <main
        className={`app-container ${
          interviewStarted ? "interview-active" : "config-active"
        }`}
      >
        {toast.visible && (
          <div className={`app-toast app-toast-${toast.type || "info"}`}>
            {toast.message}
          </div>
        )}

        {showConfig && (
          <div className="config-page-content">
            <UploadResume
              resumeName={resumeName}
              handleResumeUpload={handleResumeUpload}
              skills={skills}
              company={company}
              setCompany={setCompany}
              customCompany={customCompany}
              setCustomCompany={setCustomCompany}
              interviewLevel={interviewLevel}
              setInterviewLevel={setInterviewLevel}
              interviewType={interviewType}
              setInterviewType={setInterviewType}
            />
            <div className="config-start-row">
              <button
                disabled={!resumeFile && !resumeProfile}
                onClick={startInterviewFlow}
                className="start-interview-btn"
              >
                🚀 Start AI Interview
              </button>
            </div>
          </div>
        )}

        {interviewStarted && (
          <div className="main-layout">
            <QuestionPanel
              question={question}
              setQuestion={setQuestion}
              textareaRef={textareaRef}
              isInterviewRunning={isInterviewRunning}
              loading={loading}
              generateAnswer={generateAnswer}
              clearQuestionAndAnswer={clearQuestionAndAnswer}
              stopInterviewMode={stopInterviewMode}
            />

            <AnswerPanel answerData={answerData} loading={loading} />
          </div>
        )}
      </main>
    </>
  );
}

export default App;