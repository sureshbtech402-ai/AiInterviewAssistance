function InterviewStatus({ stopInterviewMode }) {
  return (
    <button
      onClick={stopInterviewMode}
      style={{
        position: "fixed",
        right: "35px",
        bottom: "30px",
        zIndex: 9999,
        background: "#dc2626",
        color: "white",
        border: "none",
        borderRadius: "16px",
        padding: "16px 26px",
        cursor: "pointer",
        fontWeight: "800",
        fontSize: "17px",
        boxShadow: "0 15px 35px rgba(220,38,38,.45)",
      }}
    >
      🛑 Stop Interview
    </button>
  );
}

export default InterviewStatus;