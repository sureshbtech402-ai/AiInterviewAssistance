function InterviewConfig({
  company,
  setCompany,
  interviewLevel,
  setInterviewLevel,
  interviewType,
  setInterviewType,
  startInterviewMode,
}) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: "18px",
        padding: "25px",
        marginBottom: "25px",
      }}
    >
      <h2
        style={{
          color: "#38bdf8",
          marginBottom: "20px",
        }}
      >
        ⚙ Interview Configuration
      </h2>

      {/* Company */}

      <div style={{ marginBottom: "18px" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Company
        </label>

        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            background: "#1e293b",
            color: "white",
            border: "1px solid #334155",
          }}
        >
          <option>Generic</option>
          <option>Amazon</option>
          <option>Microsoft</option>
          <option>Google</option>
          <option>Accenture</option>
          <option>TCS</option>
          <option>Infosys</option>
          <option>Capgemini</option>
          <option>Wipro</option>
        </select>
      </div>

      {/* Interview Level */}

      <div style={{ marginBottom: "18px" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Interview Level
        </label>

        <select
          value={interviewLevel}
          onChange={(e) => setInterviewLevel(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            background: "#1e293b",
            color: "white",
            border: "1px solid #334155",
          }}
        >
          <option>L1</option>
          <option>L2</option>
          <option>L3</option>
          <option>Senior</option>
        </select>
      </div>

      {/* Interview Type */}

      <div style={{ marginBottom: "25px" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Interview Type
        </label>

        <select
          value={interviewType}
          onChange={(e) => setInterviewType(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            background: "#1e293b",
            color: "white",
            border: "1px solid #334155",
          }}
        >
          <option>Java Backend</option>
          <option>Spring Boot</option>
          <option>Microservices</option>
          <option>System Design</option>
          <option>DSA</option>
          <option>HR Interview</option>
          <option>Manager Round</option>
        </select>
      </div>

      <button
        onClick={startInterviewMode}
        style={{
          width: "100%",
          padding: "15px",
          borderRadius: "12px",
          border: "none",
          background: "#7c3aed",
          color: "white",
          fontWeight: "bold",
          fontSize: "17px",
          cursor: "pointer",
        }}
      >
        🚀 Start Interview
      </button>
    </div>
  );
}

export default InterviewConfig;