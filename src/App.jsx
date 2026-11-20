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
  const [screenshotImage, setScreenshotImage] = useState(null);
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

  const isInterviewRunningRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  // Pre-warm Render backend on initial app load to eliminate cold-start issues
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`).catch(() => {});
  }, []);

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

  const startMediaRecorder = (stream) => {
    if (!stream || stream.getAudioTracks().length === 0) {
      return;
    }

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

    if (
      !audioContextRef.current ||
      audioContextRef.current.state === "closed"
    ) {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const destination = audioContextRef.current.createMediaStreamDestination();
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
        socketRef.current?.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(event.data);
      }
    };

    recorder.start(100);
  };

  const openInterviewSocket = () => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return resolve(socketRef.current);
      }

      if (socketRef.current) {
        try {
          socketRef.current.onclose = null;
          socketRef.current.close();
        } catch {
          // Socket cleanup
        }
      }

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout - server waking up"));
      }, 35000);

      socket.onopen = () => {
        clearTimeout(timeout);
        clearTimeout(reconnectTimerRef.current);
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
        // Auto-reconnect silently if screen + audio is still shared
        if (
          isInterviewRunningRef.current &&
          screenStreamRef.current &&
          screenStreamRef.current.getAudioTracks().length > 0
        ) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(async () => {
            if (!isInterviewRunningRef.current || !screenStreamRef.current) {
              return;
            }
            try {
              await openInterviewSocket();
              startMediaRecorder(screenStreamRef.current);
              console.log("🔄 Interview audio socket reconnected automatically.");
            } catch (err) {
              console.error("Auto-reconnect failed, retrying...", err);
            }
          }, 1500);
        }
      };
    });
  };

  const closeInterviewSocket = () => {
    clearTimeout(reconnectTimerRef.current);
    if (socketRef.current) {
      try {
        socketRef.current.onclose = null;
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

    fetch(`${API_BASE_URL}/health`).catch(() => {});

    setResumeFile(file);
    setResumeName(file.name);
    setResumeProfile(null);
    setSkills([]);
    showToast("Resume attached! Ready to start.", "success");
  };

  const stopInterviewMode = () => {
    isInterviewRunningRef.current = false;
    clearTimeout(silenceTimerRef.current);
    clearTimeout(reconnectTimerRef.current);

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
      isInterviewRunningRef.current = true;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = stream;

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopInterviewMode();
      });

      const audioTrack = stream.getAudioTracks()[0];

      if (!audioTrack) {
        // Allow screen-only / screenshot mode when no tab audio is shared
        showToast(
          "Screen shared in Screenshot Mode (no tab audio detected).",
          "info"
        );
        return true;
      }

      audioTrack.addEventListener("ended", () => {
        stopInterviewMode();
      });

      await openInterviewSocket();
      startMediaRecorder(stream);
      return true;
    } catch (error) {
      console.error(error);
      showToast(
        "Unable to start screen sharing. Check permissions.",
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
    setScreenshotImage(null);
    setAnswerData("");

    questionLockedRef.current = false;
    waitingForNextQuestionRef.current = false;
    ignoreStaleTranscriptRef.current = false;

    liveQuestionRef.current = "";
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";

    clearTimeout(silenceTimerRef.current);

    let audioStarted;
    try {
      audioStarted = await startInterviewMode();
    } catch (err) {
      console.error("Screen/Audio start failed:", err);
      showToast("Screen sharing permission failed. Try again.", "error");
      return;
    }

    if (!audioStarted) {
      return;
    }

    setInterviewStarted(true);
    setShowConfig(false);

    let profile = resumeProfile;

    if (!profile) {
      setLoading(true);
      setAnswerData(
        "⏳ Reading your resume and preparing your interview profile..."
      );

      try {
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
            // Keep default message
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
      } catch (extractError) {
        console.error("Resume Extraction Error:", extractError);
        setAnswerData(
          "⚠️ Could not extract profile details. You can continue speaking or take screenshots directly."
        );
        showToast("Resume extraction failed. Server might be waking up.", "error");
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setAnswerData("⏳ Preparing your self-introduction...");

    const introQuestion = "Tell me about yourself";
    setQuestion(introQuestion);

    try {
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

      if (generatedIntro?.trim()) {
        saveConversationTurn(introQuestion, generatedIntro);
      }
    } catch (introError) {
      console.error("Self-intro generation failed:", introError);
      setAnswerData("Self-introduction generation failed. Please click Generate Answer.");
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
    setScreenshotImage(null);

    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
    }
  };

  const takeTabScreenshot = async () => {
    const stream = screenStreamRef.current;
    if (!stream) {
      showToast("Start the interview first to share screen tab.", "error");
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      showToast("Screen video track is not active.", "error");
      return;
    }

    try {
      const video = document.createElement("video");
      video.srcObject = new MediaStream([videoTrack]);
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve) => {
        video.onloadeddata = resolve;
      });
      await video.play();

      // Wait one animation frame so Chrome renders the actual tab image
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / (video.videoWidth || 1600));
      canvas.width = (video.videoWidth || 1280) * scale;
      canvas.height = (video.videoHeight || 720) * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Image = canvas.toDataURL("image/jpeg", 0.85);
      video.pause();
      video.srcObject = null;

      setScreenshotImage(base64Image);
      showToast("Screenshot captured! 📸", "success");
    } catch (err) {
      console.error("Screenshot capture failed:", err);
      showToast("Failed to capture screenshot.", "error");
    }
  };

  const generateAnswer = async () => {
    questionLockedRef.current = true;

    if (!question.trim() && !screenshotImage) {
      showToast("Question panel is empty.", "info");
      questionLockedRef.current = false;
      return;
    }

    const askedQuestion = question.trim();

    const generatedAnswer = await streamAnswer(
      {
        question: askedQuestion,
        screenshot: screenshotImage || null,
        company: company === "Others" ? customCompany : company,
        interviewLevel,
        interviewType,
        history: conversationHistoryRef.current,
        resumeProfile,
      },
      "Unable to generate answer right now. Please try again."
    );

    if (generatedAnswer?.trim()) {
      saveConversationTurn(askedQuestion || "Analyze screenshot", generatedAnswer);
    }

    setScreenshotImage(null);
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
              stopInterviewMode={stopInterviewMode}
              loading={loading}
              generateAnswer={generateAnswer}
              clearQuestionAndAnswer={clearQuestionAndAnswer}
              screenshotImage={screenshotImage}
              onTakeScreenshot={takeTabScreenshot}
              onRemoveScreenshot={() => setScreenshotImage(null)}
            />

            <AnswerPanel answerData={answerData} loading={loading} />
          </div>
        )}
      </main>
    </>
  );
}

export default App;