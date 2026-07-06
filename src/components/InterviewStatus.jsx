function InterviewStatus({ stopInterviewMode }) {
  return (
    <div
      style={{
        height: "70px",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        marginTop: "14px",
      }}
    >
      <button
        onClick={stopInterviewMode}
        style={{
          width: "220px",
          height: "56px",
          background: "#dc2626",
          color: "white",
          border: "none",
          borderRadius: "14px",
          cursor: "pointer",
          fontWeight: "800",
          fontSize: "17px",
          transition: ".25s",
          boxShadow: "0 10px 25px rgba(220,38,38,.35)",
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
  );
}

export default InterviewStatus;