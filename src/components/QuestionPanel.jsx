import "../styles/questionPanel.css";

function QuestionPanel({
  question,
  setQuestion,
  textareaRef,
  isInterviewRunning,
  loading,
  generateAnswer,
  clearQuestionAndAnswer,
  stopInterviewMode,
}) {
  return (
    <div className="question-panel">
      <div className="question-header">
        <div className="title-wrapper">
          <div className="title-icon">🎤</div>

          <div>
            <h2 className="panel-title">Question</h2>

            <p className="panel-subtitle">
              Live transcript from interviewer
            </p>
          </div>
        </div>

        <div
          className={
            isInterviewRunning
              ? "status listening"
              : "status stopped"
          }
        >
          <span className="status-dot"></span>

          {isInterviewRunning ? "Listening" : "Stopped"}
        </div>
      </div>

      <div className="question-content">
        <textarea
          ref={textareaRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="The interviewer's question will appear here..."
          className="question-box"
        />
      </div>

      <div className="question-footer">
        <button
          type="button"
          className="clear-btn"
          onClick={clearQuestionAndAnswer}
        >
          🗑 Clear
        </button>

        <button
          type="button"
          onClick={stopInterviewMode}
          disabled={!isInterviewRunning}
          className={
            isInterviewRunning
              ? "stop-btn"
              : "stop-btn disabled"
          }
        >
          ⏹ Stop
        </button>

        <button
          type="button"
          disabled={loading || !question.trim()}
          onClick={generateAnswer}
          className="generate-btn"
        >
          {loading
            ? "⚡ Generating..."
            : "✨ Generate AI Answer"}
        </button>
      </div>
    </div>
  );
}

export default QuestionPanel;