import Login from "./Login";
import { auth } from "./firebase";
import {
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import { useState, useEffect, useRef } from "react";

import Header from "./components/Header";
import UploadResume from "./components/UploadResume";
import InterviewStatus from "./components/InterviewStatus";
import QuestionPanel from "./components/QuestionPanel";
import AnswerPanel from "./components/AnswerPanel";

import { extractPdfText } from "./pdfReader";

function App() {

  // ===========================
  // STATES
  // ===========================
  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState("");
  const [showConfig, setShowConfig] = useState(true);
  const [answerData, setAnswerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeName, setResumeName] =useState("");
  const [company, setCompany] = useState("Oracle");
  const [customCompany, setCustomCompany] = useState("");
  const [interviewLevel, setInterviewLevel] = useState("L1");
  const [interviewType, setInterviewType] = useState("Technical");
  const [skills, setSkills] = useState([]);

  const [isInterviewRunning, setIsInterviewRunning] = useState(false);
  const [displayedAnswer, setDisplayedAnswer] = useState(null);

  // ===========================
  // REFS
  // ===========================

  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const textareaRef = useRef(null);

  // ===========================
  // WEBSOCKET
  // ===========================

  useEffect(() => {

    socketRef.current =
      new WebSocket("ws://localhost:5001");

    socketRef.current.onopen = () => {

      console.log("✅ WebSocket Connected");

    };

    socketRef.current.onmessage = (event) => {

      if (!event.data.trim()) return;

      setQuestion((prev) => {

        if (prev.includes(event.data))
          return prev;

        return prev + " " + event.data;

      });

    };

    return () => {

      socketRef.current?.close();

    };

  }, []);

  // ===========================
// AUTHENTICATION
// ===========================

useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {

        setUser(currentUser);

    });

    return () => unsubscribe();

}, []);

  // ===========================
  // AUTO SCROLL QUESTION
  // ===========================

  useEffect(() => {

    if (textareaRef.current) {

      textareaRef.current.scrollTop =
        textareaRef.current.scrollHeight;

    }

  }, [question]);

  // ===========================
  // RESUME UPLOAD
  // ===========================

  const handleResumeUpload = async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

      setResumeName(file.name);

      const text = await extractPdfText(file);

      setResumeText(text);

      const skillMatches =
        text.match(
          /Java|Spring Boot|Microservices|SQL|Oracle|React|AWS|Docker|Kubernetes/gi
        ) || [];

      setSkills([...new Set(skillMatches)]);

      alert("Resume Uploaded Successfully");

    } catch (err) {

      console.error(err);

      alert("Unable to read Resume");

    }

  };

  // ===========================
  // START INTERVIEW
  // ===========================

  const startInterviewMode = async () => {

    setQuestion("");
    setAnswerData(null);

    setIsInterviewRunning(true);

    try {

      const stream =
        await navigator.mediaDevices.getDisplayMedia({

          video: true,

          audio: true,

        });
    const audioTrack = stream.getAudioTracks()[0];

      if (!audioTrack) {
          alert("Please enable Share Tab Audio.");
          setIsInterviewRunning(false);
          return;
      }

      audioTrack.onended = () => {

      console.log("Audio Track Ended");

      stopInterviewMode();

      };
      const audioContext =
        new AudioContext({

          sampleRate: 48000,

        });

      audioContextRef.current =
        audioContext;

      const source =
        audioContext.createMediaStreamSource(stream);

      const destination =
        audioContext.createMediaStreamDestination();

      source.connect(destination);

      const recorder =
        new MediaRecorder(destination.stream);

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable = (event) => {

        if (
          event.data.size > 0 &&
          socketRef.current?.readyState === WebSocket.OPEN
        ) {

          socketRef.current.send(event.data);

        }

      };

      recorder.start(500);
      recorder.onstop = () => {
    console.log("Recorder Stopped");
    };

    recorder.onerror = (e) => {
    console.log("Recorder Error", e);
    };

      alert("Interview Started");

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

  // ===========================
  // STOP INTERVIEW
  // ===========================

  const stopInterviewMode = () => {

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {

      mediaRecorderRef.current.stop();

    }

    audioContextRef.current?.close();

    setIsInterviewRunning(false);

  };

  // ===========================
  // GENERATE ANSWER
  // ===========================

  const typeAnswer = (fullAnswer) => {

    setDisplayedAnswer({
        ...fullAnswer,
        answer: ""
    });

    let index = 0;

    const interval = setInterval(() => {

        index++;

        setDisplayedAnswer({
            ...fullAnswer,
            answer: fullAnswer.answer.substring(0, index)
        });

        if(index >= fullAnswer.answer.length){

            clearInterval(interval);

            setAnswerData(fullAnswer);

        }

    },12);

};

  const generateAnswer = async () => {

    if (!question.trim()) {

      alert("Question is Empty");

      return;

    }

    try {

      setLoading(true);

      const response =
        await fetch(
          "http://localhost:5000/answer",
          {

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

          }
        );

      const data =
        await response.json();

      setAnswerData(null);
      typeAnswer(data);

    } catch (err) {

      console.error(err);

      alert("Failed to Generate");

    } finally {

      setLoading(false);

    }

  };

  if (!user) {
  return <Login setUser={setUser} />;
  }

  return (
  <>
    <Header
    user={user}
    logout={() => {
        signOut(auth);
        setUser(null);
    }}
    />

    <div
      style={{
          width: "100%",
          height: "100vh",
          background: "#020617",
          padding: "25px",
          boxSizing: "border-box",
          fontFamily: "Segoe UI",
          color: "white",
      }}
    >
      {/* Resume Upload */}
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
    <InterviewStatus
        company={company}
        interviewLevel={interviewLevel}
        interviewType={interviewType}
        stopInterviewMode={stopInterviewMode}
    />
    )}
      
    {interviewStarted && (

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "380px 1fr",
        gap: "30px",
        height: "calc(100vh - 210px)",
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

      <AnswerPanel
          answerData={displayedAnswer || answerData}
          loading={loading}
      />
    </div>

    )}
    </div>
  </>
);

}

export default App;