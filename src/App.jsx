import Login from "./Login";
import { auth } from "./firebase";
import {
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  useState,
  useEffect,
  useRef,
} from "react";

import Header from "./components/Header";
import UploadResume from "./components/UploadResume";
import QuestionPanel from "./components/QuestionPanel";
import AnswerPanel from "./components/AnswerPanel";

import { extractPdfText } from "./pdfReader";
import "./styles/app.css";

const trimTrailingSlash = (value) =>
  (value || "").replace(/\/+$/, "");

const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL ||
    "https://aiinterviewassistance-5.onrender.com"
);

const WS_URL = trimTrailingSlash(
  import.meta.env.VITE_WS_URL ||
    API_BASE_URL
      .replace(/^https:/, "wss:")
      .replace(/^http:/, "ws:")
);

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] =
    useState(true);

  const [question, setQuestion] =
    useState("");

  const [showConfig, setShowConfig] =
    useState(true);

  const [answerData, setAnswerData] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [
    interviewStarted,
    setInterviewStarted,
  ] = useState(false);

  const [resumeText, setResumeText] =
    useState("");

  const [resumeName, setResumeName] =
    useState("");

  const [
    resumeProfile,
    setResumeProfile,
  ] = useState(null);

  const [
    resumeProcessing,
    setResumeProcessing,
  ] = useState(false);

  const [company, setCompany] =
    useState("Oracle");

  const [
    customCompany,
    setCustomCompany,
  ] = useState("");

  const [
    interviewLevel,
    setInterviewLevel,
  ] = useState("Mid Level");

  const [
    interviewType,
    setInterviewType,
  ] = useState("Technical");

  const [skills, setSkills] =
    useState([]);

  const [
    isInterviewRunning,
    setIsInterviewRunning,
  ] = useState(false);

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
  const silenceTimerRef = useRef(null);
  const liveQuestionRef = useRef("");
  const questionLockedRef = useRef(false);

  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const ignoreStaleTranscriptRef =
    useRef(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (currentUser) => {
          setUser(currentUser);
          setAuthLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop =
        textareaRef.current.scrollHeight;
    }
  }, [question]);

  const showToast = (
    message,
    type = "info"
  ) => {
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

  const buildResumeContext = () => {
    if (!resumeProfile) {
      return (
        resumeText ||
        "Resume profile not available"
      );
    }

    const primarySkills = Array.isArray(
      resumeProfile.primarySkills
    )
      ? resumeProfile.primarySkills.join(", ")
      : "";

    const secondarySkills = Array.isArray(
      resumeProfile.secondarySkills
    )
      ? resumeProfile.secondarySkills.join(
          ", "
        )
      : "";

    const responsibilities =
      Array.isArray(
        resumeProfile.rolesAndResponsibilities
      )
        ? resumeProfile.rolesAndResponsibilities.join(
            "\n- "
          )
        : "";

    const tools = Array.isArray(
      resumeProfile.toolsAndTechnologies
    )
      ? resumeProfile.toolsAndTechnologies.join(
          ", "
        )
      : "";

    const achievements = Array.isArray(
      resumeProfile.achievements
    )
      ? resumeProfile.achievements.join(
          "\n- "
        )
      : "";

    const previousCompanies =
      Array.isArray(
        resumeProfile.previousCompanies
      )
        ? resumeProfile.previousCompanies
            .map((item) => {
              return [
                item.companyName || "",
                item.designation || "",
                item.duration || "",
              ]
                .filter(Boolean)
                .join(" | ");
            })
            .filter(Boolean)
            .join("\n")
        : "";

    const employmentHistory =
      Array.isArray(
        resumeProfile.employmentHistory
      )
        ? resumeProfile.employmentHistory
            .map((item) => {
              return [
                item.isCurrent
                  ? "Current"
                  : "Previous",
                item.companyName || "",
                item.designation || "",
                item.duration || "",
              ]
                .filter(Boolean)
                .join(" | ");
            })
            .filter(Boolean)
            .join("\n")
        : "";

    const previousProjects =
      Array.isArray(
        resumeProfile.previousProjectNames
      )
        ? resumeProfile.previousProjectNames.join(
            ", "
          )
        : "";

    return `
Candidate Name:
${resumeProfile.candidateName || ""}

Location:
${resumeProfile.location || ""}

Candidate Summary:
${resumeProfile.candidateSummary || ""}

Total Experience:
${resumeProfile.experience || ""}

Current Company:
${resumeProfile.currentCompany?.companyName || ""}

Current Designation:
${resumeProfile.currentCompany?.designation || ""}

Current Company Duration:
${resumeProfile.currentCompany?.duration || ""}

Previous Companies:
${previousCompanies}

Complete Employment History:
${employmentHistory}

Primary Skills:
${primarySkills}

Secondary Skills:
${secondarySkills}

Current Project:
${resumeProfile.currentProjectName || ""}

Previous Projects:
${previousProjects}

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

  const updateQuestionFromTranscript = (
    payload
  ) => {
    const text = (
      payload?.text || ""
    ).trim();

    if (
      !text ||
      questionLockedRef.current
    ) {
      return;
    }

    if (
      ignoreStaleTranscriptRef.current
    ) {
      ignoreStaleTranscriptRef.current =
        false;

      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
    }

    clearTimeout(
      silenceTimerRef.current
    );

    if (
      payload.isFinal ||
      payload.speechFinal
    ) {
      const previousFinal =
        finalTranscriptRef.current.trim();

      if (
        !previousFinal.endsWith(text)
      ) {
        finalTranscriptRef.current =
          previousFinal
            ? `${previousFinal} ${text}`
            : text;
      }

      interimTranscriptRef.current = "";
    } else {
      interimTranscriptRef.current =
        text;
    }

    const completeQuestion = [
      finalTranscriptRef.current,
      interimTranscriptRef.current,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    liveQuestionRef.current =
      completeQuestion;

    setQuestion(completeQuestion);

    silenceTimerRef.current =
      setTimeout(() => {
        questionLockedRef.current = true;
        interimTranscriptRef.current = "";

        const completedQuestion =
          finalTranscriptRef.current.trim();

        liveQuestionRef.current =
          completedQuestion;

        setQuestion(completedQuestion);

        console.log(
          "Question Completed"
        );
      }, 4000);
  };

  const openInterviewSocket = () => {
    return new Promise(
      (resolve, reject) => {
        if (
          socketRef.current
            ?.readyState === WebSocket.OPEN
        ) {
          return resolve(
            socketRef.current
          );
        }

        if (socketRef.current) {
          try {
            socketRef.current.close();
          } catch {
            console.log(
              "Previous socket closed"
            );
          }
        }

        const socket =
          new WebSocket(WS_URL);

        socketRef.current = socket;

        const timeout = setTimeout(
          () => {
            reject(
              new Error(
                "WebSocket connection timeout"
              )
            );
          },
          10000
        );

        socket.onopen = () => {
          clearTimeout(timeout);

          console.log(
            "✅ WebSocket Connected"
          );

          resolve(socket);
        };

        socket.onmessage = (event) => {
          if (!event.data) return;

          try {
            const payload =
              JSON.parse(event.data);

            if (
              payload.type ===
              "transcript"
            ) {
              updateQuestionFromTranscript(
                payload
              );
            } else if (payload.error) {
              console.error(
                "Deepgram Error:",
                payload.error
              );
            } else if (
              payload.status
            ) {
              console.log(
                "Deepgram Status:",
                payload.status
              );
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

          console.error(
            "WebSocket Error:",
            error
          );

          reject(error);
        };

        socket.onclose = () => {
          console.log(
            "WebSocket Closed"
          );
        };
      }
    );
  };

  const closeInterviewSocket = () => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        console.log(
          "Socket already closed"
        );
      }
    }

    socketRef.current = null;
  };

  const handleResumeUpload = async (
    event
  ) => {
    const file =
      event.target.files[0];

    if (!file) return;

    try {
      setResumeProcessing(true);
      setResumeName(file.name);
      setResumeProfile(null);
      setSkills([]);

      const text =
        await extractPdfText(file);

      setResumeText(text);

      const response = await fetch(
        `${API_BASE_URL}/resume-summary`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            resumeText: text,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to create resume profile"
        );
      }

      const data =
        await response.json();

      if (!data.resumeProfile) {
        throw new Error(
          "Resume profile is empty"
        );
      }

      setResumeProfile(
        data.resumeProfile
      );

      setSkills(
        Array.isArray(
          data.resumeProfile
            .primarySkills
        )
          ? data.resumeProfile
              .primarySkills
          : []
      );

      console.log(
        "Resume Profile:",
        data.resumeProfile
      );

      showToast(
        "Resume uploaded and professional profile created successfully!",
        "success"
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Unable to process resume. Please try another PDF.",
        "error"
      );

      setResumeName("");
      setResumeText("");
      setResumeProfile(null);
      setSkills([]);
    } finally {
      setResumeProcessing(false);
    }
  };

  const startInterviewMode =
    async () => {
      setQuestion("");
      setAnswerData(null);

      questionLockedRef.current =
        false;

      ignoreStaleTranscriptRef.current =
        false;

      liveQuestionRef.current = "";
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";

      clearTimeout(
        silenceTimerRef.current
      );

      try {
        setIsInterviewRunning(true);

        const stream =
          await navigator.mediaDevices.getDisplayMedia(
            {
              video: true,
              audio: true,
            }
          );

        screenStreamRef.current =
          stream;

        const audioTrack =
          stream.getAudioTracks()[0];

        if (!audioTrack) {
          showToast(
            "Select a Chrome tab and enable Share tab audio.",
            "error"
          );

          setIsInterviewRunning(false);

          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        const socket =
          await openInterviewSocket();

        audioTrack.onended = () => {
          stopInterviewMode();
        };

        const audioContext =
          new AudioContext({
            sampleRate: 48000,
          });

        audioContextRef.current =
          audioContext;

        const source =
          audioContext.createMediaStreamSource(
            stream
          );

        const destination =
          audioContext.createMediaStreamDestination();

        source.connect(destination);

        const mimeType =
          MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
          )
            ? "audio/webm;codecs=opus"
            : "audio/webm";

        const recorder =
          new MediaRecorder(
            destination.stream,
            {
              mimeType,
            }
          );

        mediaRecorderRef.current =
          recorder;

        recorder.ondataavailable = (
          event
        ) => {
          if (
            event.data &&
            event.data.size > 0 &&
            socket.readyState ===
              WebSocket.OPEN
          ) {
            socket.send(event.data);
          }
        };

        recorder.onstop = () => {
          console.log(
            "Recorder Stopped"
          );
        };

        recorder.onerror = (
          error
        ) => {
          console.error(
            "Recorder Error:",
            error
          );
        };

        recorder.start(100);
      } catch (error) {
        console.error(error);

        showToast(
          "Unable to start interview audio. Check sharing permissions.",
          "error"
        );

        stopInterviewMode();
      }
    };

  const streamAnswer = async (
    payload,
    fallbackMessage
  ) => {
    try {
      answerAbortRef.current?.abort();

      answerAbortRef.current =
        new AbortController();

      setLoading(true);
      setAnswerData("");

      const response = await fetch(
        `${API_BASE_URL}/answer`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          signal:
            answerAbortRef.current.signal,

          body: JSON.stringify(payload),
        }
      );

      if (
        !response.ok ||
        !response.body
      ) {
        throw new Error(
          "Failed to generate answer"
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let fullText = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) break;

        const chunk =
          decoder.decode(value, {
            stream: true,
          });

        fullText += chunk;

        setAnswerData(fullText);
      }
    } catch (error) {
      if (
        error.name === "AbortError"
      ) {
        return;
      }

      console.error(error);

      setAnswerData(
        fallbackMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const generateSelfIntroAnswer =
    async () => {
      const introQuestion =
        "Tell me about yourself";

      await streamAnswer(
        {
          question: introQuestion,

          resumeText:
            buildResumeContext(),

          company:
            "Ignore target company for self introduction",

          interviewLevel,

          interviewType,
        },

        "Unable to generate self introduction right now."
      );
    };

  const startInterviewFlow =
    async () => {
      if (resumeProcessing) {
        showToast(
          "Resume profile is still being generated. Please wait.",
          "info"
        );

        return;
      }

      if (!resumeProfile) {
        showToast(
          "Upload a resume and wait until profile generation completes.",
          "info"
        );

        return;
      }

      setInterviewStarted(true);
      setShowConfig(false);

      await startInterviewMode();

      setTimeout(() => {
        generateSelfIntroAnswer();
      }, 500);
    };

  const stopInterviewMode = () => {
    clearTimeout(
      silenceTimerRef.current
    );

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !==
        "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    mediaRecorderRef.current = null;

    if (
      audioContextRef.current &&
      audioContextRef.current.state !==
        "closed"
    ) {
      audioContextRef.current.close();
    }

    audioContextRef.current = null;

    screenStreamRef.current
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    screenStreamRef.current = null;

    closeInterviewSocket();

    setIsInterviewRunning(false);
  };

  const clearQuestionAndAnswer =
    () => {
      clearTimeout(
        silenceTimerRef.current
      );

      questionLockedRef.current =
        false;

      ignoreStaleTranscriptRef.current =
        true;

      liveQuestionRef.current = "";
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";

      setQuestion("");

      if (textareaRef.current) {
        textareaRef.current.scrollTop =
          0;
      }
    };

  const generateAnswer = async () => {
    questionLockedRef.current = true;

    if (!question.trim()) {
      showToast(
        "Question panel is empty.",
        "info"
      );

      return;
    }

    await streamAnswer(
      {
        question,

        resumeText:
          buildResumeContext(),

        company:
          company === "Others"
            ? customCompany
            : company,

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
    return (
      <Login setUser={setUser} />
    );
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
          interviewStarted
            ? "interview-active"
            : "config-active"
        }`}
      >
        {toast.visible && (
          <div
            className={`app-toast app-toast-${
              toast.type || "info"
            }`}
          >
            {toast.message}
          </div>
        )}

        {showConfig && (
          <div className="config-page-content">
            <UploadResume
              resumeName={
                resumeProcessing
                  ? "Processing Profile..."
                  : resumeName
              }
              handleResumeUpload={
                handleResumeUpload
              }
              skills={skills}
              company={company}
              setCompany={setCompany}
              customCompany={
                customCompany
              }
              setCustomCompany={
                setCustomCompany
              }
              interviewLevel={
                interviewLevel
              }
              setInterviewLevel={
                setInterviewLevel
              }
              interviewType={
                interviewType
              }
              setInterviewType={
                setInterviewType
              }
            />

            <div className="config-start-row">
              <button
                disabled={
                  resumeProcessing
                }
                onClick={
                  startInterviewFlow
                }
                className="start-interview-btn"
              >
                {resumeProcessing
                  ? "⏳ Generating Profile..."
                  : "🚀 Start AI Interview"}
              </button>
            </div>
          </div>
        )}

        {interviewStarted && (
          <div className="main-layout">
            <QuestionPanel
              question={question}
              setQuestion={setQuestion}
              textareaRef={
                textareaRef
              }
              isInterviewRunning={
                isInterviewRunning
              }
              loading={loading}
              generateAnswer={
                generateAnswer
              }
              clearQuestionAndAnswer={
                clearQuestionAndAnswer
              }
              stopInterviewMode={
                stopInterviewMode
              }
            />

            <AnswerPanel
              answerData={answerData}
              loading={loading}
            />
          </div>
        )}
      </main>
    </>
  );
}

export default App;