import Login from "./Login";
import { auth } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useState, useEffect, useRef } from "react";

import Header from "./components/Header";
import UploadResume from "./components/UploadResume";
import InterviewStatus from "./components/InterviewStatus";
import QuestionPanel from "./components/QuestionPanel";
import AnswerPanel from "./components/AnswerPanel";

import { extractPdfText } from "./pdfReader";

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
  const [loading, setLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);

  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [resumeProfile, setResumeProfile] = useState(null);
  const [resumeProcessing, setResumeProcessing] = useState(false);

  const [company, setCompany] = useState("Oracle");
  const [customCompany, setCustomCompany] = useState("");
  const [interviewLevel, setInterviewLevel] = useState("Mid Level");
  const [interviewType, setInterviewType] = useState("Technical");
  const [skills, setSkills] = useState([]);

  const [isInterviewRunning, setIsInterviewRunning] = useState(false);

  // Elegant Notification Toast State (Replaces banned alert functions)
  const [toast, setToast] = useState({ message: "", type: "", visible: false });

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const screenStreamRef = useRef(null);
  const textareaRef = useRef(null);

  const answerAbortRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const liveQuestionRef = useRef("");
  const questionLockedRef = useRef(false);

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

  // Show safe toast notification
  const showToast = (message, type = "info") => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4500);
  };

  // Prepares structural profile summary into plain text context
  const buildResumeContext = () => {
    if (!resumeProfile) {
      return resumeText || "Resume profile not available";
    }

    const primarySkills = Array.isArray(resumeProfile.primarySkills)
      ? resumeProfile.primarySkills.join(", ")
      : "";

    const secondarySkills = Array.isArray(resumeProfile.secondarySkills)
      ? resumeProfile.secondarySkills.join(", ")
      : "";

    const responsibilities = Array.isArray(
      resumeProfile.rolesAndResponsibilities
    )
      ? resumeProfile.rolesAndResponsibilities.join("\n- ")
      : "";

    const tools = Array.isArray(resumeProfile.toolsAndTechnologies)
      ? resumeProfile.toolsAndTechnologies.join(", ")
      : "";

    const achievements = Array.isArray(resumeProfile.achievements)
      ? resumeProfile.achievements.join("\n- ")
      : "";

    return `
Candidate Summary:
${resumeProfile.candidateSummary || ""}

Experience:
${resumeProfile.experience || ""}

Primary Skills:
${primarySkills}

Secondary Skills:
${secondarySkills}

Project Name:
${resumeProfile.projectName || ""}

Project Domain:
${resumeProfile.projectDomain || ""}

Project Summary:
${resumeProfile.projectSummary || ""}

Roles and Responsibilities:
- ${responsibilities}

Tools and Technologies:
${tools}

Achievements:
- ${achievements}

Self Introduction:
${resumeProfile.selfIntroduction || ""}

Project Explanation:
${resumeProfile.projectExplanation || ""}

Roles Explanation:
${resumeProfile.rolesExplanation || ""}
`.trim();
  };

  const updateQuestionFromTranscript = (payload) => {
    const text = (payload?.text || "").trim();

    if (!text) return;
    if (questionLockedRef.current) return;

    liveQuestionRef.current = text;

    setQuestion((prev) => {
      const cleanedPrev = prev.trim();

      if (!cleanedPrev) return text;

      if (
        cleanedPrev.endsWith(text) ||
        cleanedPrev.includes(text)
      ) {
        return cleanedPrev;
      }

      return `${cleanedPrev} ${text}`.trim();
    });

    clearTimeout(silenceTimerRef.current);

    silenceTimerRef.current = setTimeout(() => {
      questionLockedRef.current = true;
      console.log("Question Completed");
    }, 5000);
  };

  const openInterviewSocket = () => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        return resolve(socketRef.current);
      }

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, 10000);

      socket.onopen = () => {
        clearTimeout(timeout);
        console.log("✅ WebSocket Connected");
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
          } else if (payload.status) {
            console.log("Deepgram Status:", payload.status);
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
        console.log("WebSocket Closed");
      };
    });
  };

  const closeInterviewSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {}
    }

    socketRef.current = null;
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    try {
      setResumeProcessing(true);
      setResumeName(file.name);
      setResumeProfile(null);

      // Extract raw text from client-side PDF reader engine
      const text = await extractPdfText(file);
      setResumeText(text);

      // Trigger the backend API extraction process to structure facts correctly and build professional responses
      const response = await fetch(`${API_BASE_URL}/resume-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resumeText: text }),
      });

      if (!response.ok) {
        throw new Error("Unable to parse professional profile via AI extraction endpoint.");
      }

      const data = await response.json();

      if (!data.resumeProfile) {
        throw new Error("AI extraction failed to generate professional profiles.");
      }

      setResumeProfile(data.resumeProfile);
      setSkills(data.resumeProfile.primarySkills || []);

      showToast("Resume uploaded and AI professional profile created successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Unable to process Resume. Please try again with another file format.", "error");
      setResumeName("");
    } finally {
      setResumeProcessing(false);
    }
  };

  const startInterviewMode = async () => {
    setQuestion("");
    setAnswerData(null);

    questionLockedRef.current = false;
    liveQuestionRef.current = "";
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
        showToast("Please select a Chrome tab and enable 'Share tab audio' checkbox.", "error");
        setIsInterviewRunning(false);
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const socket = await openInterviewSocket();

      audioTrack.onended = () => {
        console.log("Audio Track Ended");
        stopInterviewMode();
      };

      const audioContext = new AudioContext({
        sampleRate: 48000,
      });

      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const destination = audioContext.createMediaStreamDestination();

      source.connect(destination);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(destination.stream, {
        mimeType,
      });

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

      recorder.onstop = () => {
        console.log("Recorder Stopped");
      };

      recorder.onerror = (e) => {
        console.error("Recorder Error", e);
      };

      recorder.start(100);
    } catch (err) {
      console.error(err);
      showToast("Unable to start interview audio. Please verify share permissions.", "error");
      stopInterviewMode();
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

        const chunk = decoder.decode(value, {
          stream: true,
        });

        fullText += chunk;
        setAnswerData(fullText);
      }
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error(err);
      setAnswerData(fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  const generateSelfIntroAnswer = async () => {
    const introQuestion =
      "Introduce yourself and present an overview of your professional profile.";

    await streamAnswer(
      {
        question: introQuestion,
        resumeText: buildResumeContext(),
        company: "Do not use company dropdown for self introduction",
        interviewLevel,
        interviewType,
      },
      "Unable to generate self introduction right now."
    );
  };

  const startInterviewFlow = async () => {
    if (resumeProcessing) {
      showToast("Resume profile is still being generated. Please wait...", "info");
      return;
    }

    if (!resumeProfile) {
      showToast("Please upload a resume first and wait until the AI profile completes.", "info");
      return;
    }

    setInterviewStarted(true);
    setShowConfig(false);

    await startInterviewMode();

    setTimeout(() => {
      generateSelfIntroAnswer();
    }, 700);
  };

  const stopInterviewMode = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    mediaRecorderRef.current = null;

    if (
      audioContextRef.current &&
      audioContextRef.current.state !== "closed"
    ) {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    closeInterviewSocket();
    setIsInterviewRunning(false);
  };

  const clearQuestionAndAnswer = () => {
    questionLockedRef.current = false;
    liveQuestionRef.current = "";
    clearTimeout(silenceTimerRef.current);

    setQuestion("");
    setAnswerData(null);
  };

  const generateAnswer = async () => {
    questionLockedRef.current = true;

    if (!question.trim()) {
      showToast("Question panel is currently empty.", "info");
      return;
    }

    await streamAnswer(
      {
        question,
        resumeText: buildResumeContext(),
        company: company === "Others" ? customCompany : company,
        interviewLevel,
        interviewType,
      },
      "Unable to generate answer right now. Please try again."
    );
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

      <div
        style={{
          width: "100%",
          height: "calc(100vh - 68px)",
          background: "#020617",
          padding: "14px",
          overflow: "hidden",
          boxSizing: "border-box",
          fontFamily: "Segoe UI",
          color: "white",
          position: "relative",
        }}
      >
        {/* Floating Toast Notification System */}
        {toast.visible && (
          <div
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              padding: "12px 24px",
              borderRadius: "8px",
              color: "white",
              fontWeight: "600",
              zIndex: 9999,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
              animation: "fadeIn 0.3s ease",
              background:
                toast.type === "success"
                  ? "#10b981"
                  : toast.type === "error"
                  ? "#ef4444"
                  : "#3b82f6",
            }}
          >
            {toast.message}
          </div>
        )}

        {showConfig && (
          <UploadResume
            resumeName={
              resumeProcessing
                ? "Processing Profile via AI Extraction Engine..."
                : resumeName
            }
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
        )}

        {showConfig && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "25px",
            }}
          >
            <button
              disabled={resumeProcessing}
              onClick={startInterviewFlow}
              style={{
                background: resumeProcessing ? "#475569" : "#8b5cf6",
                color: "white",
                border: "none",
                padding: "15px 35px",
                borderRadius: "12px",
                cursor: resumeProcessing ? "not-allowed" : "pointer",
                fontSize: "18px",
                fontWeight: "bold",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
                transition: "all 0.2s ease-in-out",
              }}
            >
              {resumeProcessing
                ? "⏳ Generating AI Profile..."
                : "🚀 Start Interview"}
            </button>
          </div>
        )}

        {interviewStarted && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "380px 1fr",
                gap: "18px",
                height: "calc(100vh - 170px)",
                overflow: "hidden",
              }}
            >
              <QuestionPanel
                question={question}
                setQuestion={setQuestion}
                textareaRef={textareaRef}
                isInterviewRunning={isInterviewRunning}
                loading={loading}
                generateAnswer={generateAnswer}
                clearQuestionAndAnswer={clearQuestionAndAnswer}
              />

              <AnswerPanel answerData={answerData} loading={loading} />
            </div>

            {isInterviewRunning && (
              <InterviewStatus stopInterviewMode={stopInterviewMode} />
            )}
          </>
        )}
      </div>
    </>
  );
}

export default App;