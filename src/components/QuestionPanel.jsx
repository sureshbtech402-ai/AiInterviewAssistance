import "../styles/questionPanel.css";

function QuestionPanel({
  question,
  setQuestion,
  textareaRef,
  isInterviewRunning,
  setAnswerData,
  loading,
  generateAnswer,
}) {
  return (
    <div className="question-panel">

      <div className="question-header">
        <div>
          <h2 className="panel-title">
            🎤 Interview Question
          </h2>

          <p className="panel-subtitle">
            Live transcript from interviewer
          </p>
        </div>

        <div
          className={
            isInterviewRunning
              ? "status listening"
              : "status stopped"
          }
        >
          {isInterviewRunning ? "🟢 Listening" : "🔴 Stopped"}
        </div>
      </div>

      <div className="question-content">
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="The interviewer's question will appear here..."
          className="question-box"
        />
      </div>

      <div className="question-footer">
        <button
          className="clear-btn"
          onClick={() => {
            setQuestion("");
            setAnswerData(null);
          }}
        >
          🗑 Clear
        </button>

        <button
          disabled={loading}
          onClick={generateAnswer}
          className="generate-btn"
        >
          {loading ? "Generating..." : "✨ Generate AI Answer"}
        </button>
      </div>

    </div>
  );
}

export default QuestionPanel;