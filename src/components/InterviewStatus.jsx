import { useEffect, useState } from "react";

function InterviewStatus({
  company,
  interviewLevel,
  interviewType,
  stopInterviewMode,
}) {

  const [seconds, setSeconds] = useState(0);

  useEffect(() => {

    const timer = setInterval(() => {

      setSeconds((prev) => prev + 1);

    }, 1000);

    return () => clearInterval(timer);

  }, []);

  const formatTime = () => {

    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");

    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");

    const secs = String(seconds % 60).padStart(2, "0");

    return `${hrs}:${mins}:${secs}`;

  };

  return (

    <div
      style={{
        background: "#111827",
        border: "1px solid rgba(148,163,184,.15)",
        borderRadius: "20px",
        padding: "22px 30px",
        marginBottom: "25px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 10px 25px rgba(0,0,0,.35)",
      }}
    >

      {/* Left */}

      <div>

        <div
          style={{
            color: "#22c55e",
            fontSize: "24px",
            fontWeight: "700",
            marginBottom: "8px",
          }}
        >
          🟢 LIVE INTERVIEW
        </div>

        <div
          style={{
            color: "#cbd5e1",
            fontSize: "16px",
          }}
        >
          <b>Company:</b> {company}
          &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
          <b>Level:</b> {interviewLevel}
          &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
          <b>Type:</b> {interviewType}
        </div>

      </div>

      {/* Right */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
        }}
      >

        <div
          style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "14px",
            padding: "12px 18px",
            textAlign: "center",
            minWidth: "120px",
          }}
        >

          <div
            style={{
              color: "#94a3b8",
              fontSize: "13px",
            }}
          >
            Duration
          </div>

          <div
            style={{
              color: "#22c55e",
              fontWeight: "700",
              fontSize: "24px",
              marginTop: "4px",
            }}
          >
            {formatTime()}
          </div>

        </div>

        <button
          onClick={stopInterviewMode}
          style={{
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "14px",
            padding: "14px 22px",
            cursor: "pointer",
            fontWeight: "700",
            fontSize: "16px",
            transition: ".25s",
          }}
          onMouseOver={(e) => {
            e.target.style.background = "#ef4444";
          }}
          onMouseOut={(e) => {
            e.target.style.background = "#dc2626";
          }}
        >
          🛑 Stop Interview
        </button>

      </div>

    </div>

  );

}

export default InterviewStatus;