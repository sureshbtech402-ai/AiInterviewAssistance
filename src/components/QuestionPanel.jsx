import "../styles/questionPanel.css";

function QuestionPanel({
  question,
  setQuestion,
  textareaRef,
  loading,
  generateAnswer,
  clearQuestionAndAnswer,
}) {
  return (
    <div className="question-panel">
      <div className="question-header">
        <h2 className="panel-title">Question</h2>
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
          disabled={loading || !question.trim()}
          onClick={generateAnswer}
          className="generate-btn"
        >
          {loading ? "⚡ Generating..." : "✨ Generate Answer"}
        </button>
      </div>
    </div>
  );
}

export default QuestionPanel;