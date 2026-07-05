import Login from "./Login";
import { auth } from "./firebase";
import {
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { useState, useEffect, useRef } from "react";

import Header from "./components/Header";
import UploadResume from "./components/UploadResume";
import InterviewStatus from "./components/InterviewStatus";
import QuestionPanel from "./components/QuestionPanel";
import AnswerPanel from "./components/AnswerPanel";

import { extractPdfText } from "./pdfReader";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://aiinterviewassistance-4.onrender.com/";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  API_BASE_URL.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

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
  const [company, setCompany] = useState("Oracle");
  const [customCompany, setCustomCompany] = useState("");
  const [interviewLevel, setInterviewLevel] = useState("Mid Level");
  const [interviewType, setInterviewType] = useState("Technical");
  const [skills, setSkills] = useState([]);
  const [isInterviewRunning, setIsInterviewRunning] = useState(false);

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const screenStreamRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("✅ WebSocket Connected");
    };

    socket.onmessage = (event) => {
      if (!event.data) return;

      let transcriptText = "";

      try {
        const payload = JSON.parse(event.data);
        transcriptText = payload.text || "";
      } catch {
        transcriptText = event.data;
      }

      if (!transcriptText.trim()) return;

      setQuestion((prev) => {
        const cleanedPrev = prev.trim();
        const cleanedText = transcriptText.trim();

        if (cleanedPrev.includes(cleanedText)) {
          return prev;
        }

        return cleanedPrev
          ? `${cleanedPrev} ${cleanedText}`
          : cleanedText;
      });
    };

    socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket Closed");
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [question]);

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    try {
      setResumeName(file.name);

      const text = await extractPdfText(file);
      setResumeText(text);

      const skillMatches =
        text.match(
          /Java|Spring Boot|Microservices|SQL|Oracle|React|AWS|Docker|Kubernetes|JPA|Hibernate|REST API|WebFlux|Jenkins/gi
        ) || [];

      setSkills([...new Set(skillMatches.map((skill) => skill.trim()))]);

      alert("Resume Uploaded Successfully");
    } catch (err) {
      console.error(err);
      alert("Unable to read Resume");
    }
  };

  const startInterviewMode = async () => {
    setQuestion("");
    setAnswerData(null);
    setIsInterviewRunning(true);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];

      if (!audioTrack) {
        alert("Please enable Share Tab Audio.");
        setIsInterviewRunning(false);
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

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

      const recorder = new MediaRecorder(destination.stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          socketRef.current?.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(event.data);
        }
      };

      recorder.onstop = () => {
        console.log("Recorder Stopped");
      };

      recorder.onerror = (e) => {
        console.log("Recorder Error", e);
      };

      recorder.start(300);
    } catch (err) {
      console.error(err);
      setIsInterviewRunning(false);
    }
  };

  const startInterviewFlow = () => {
    setInterviewStarted(true);
    setShowConfig(false);
    startInterviewMode();
  };

  const stopInterviewMode = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    audioContextRef.current?.close();
    audioContextRef.current = null;

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;

    setIsInterviewRunning(false);
  };

  const generateAnswer = async () => {
    if (!question.trim()) {
      alert("Question is Empty");
      return;
    }

    try {
      setLoading(true);
      setAnswerData("");

      const response = await fetch(`${API_BASE_URL}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          resumeText,
          company: company === "Others" ? customCompany : company,
          interviewLevel,
          interviewType,
        }),
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
    } catch (err) {
      console.error(err);
      setAnswerData("Unable to generate answer right now. Please try again.");
      alert("Failed to Generate");
    } finally {
      setLoading(false);
    }
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
          minHeight: "calc(100vh - 76px)",
          background: "#020617",
          padding: "25px",
          boxSizing: "border-box",
          fontFamily: "Segoe UI",
          color: "white",
        }}
      >
        {showConfig && (
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
              onClick={startInterviewFlow}
              style={{
                background: "#8b5cf6",
                color: "white",
                border: "none",
                padding: "15px 35px",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              🚀 Start Interview
            </button>
          </div>
        )}

        {isInterviewRunning && (
          <InterviewStatus stopInterviewMode={stopInterviewMode} />
        )}

        {interviewStarted && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "390px 1fr",
              gap: "30px",
              height: "calc(100vh - 145px)",
              minHeight: "620px",
            }}
          >
            <QuestionPanel
              question={question}
              setQuestion={setQuestion}
              textareaRef={textareaRef}
              isInterviewRunning={isInterviewRunning}
              setAnswerData={setAnswerData}
              loading={loading}
              generateAnswer={generateAnswer}
            />

            <AnswerPanel answerData={answerData} loading={loading} />
          </div>
        )}
      </div>
    </>
  );
}

export default App;
