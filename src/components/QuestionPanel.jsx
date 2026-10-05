import "../styles/questionPanel.css";

function QuestionPanel({
  question,
  setQuestion,
  textareaRef,
  loading,
  generateAnswer,
  clearQuestionAndAnswer,
  screenshotImage,
  onTakeScreenshot,
  onRemoveScreenshot,
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

        {screenshotImage && (
          <div className="screenshot-preview-bar">
            <span className="screenshot-badge-text">📸 Attached:</span>
            <img
              src={screenshotImage}
              alt="Screenshot preview"
              className="screenshot-thumb"
            />
            <button
              type="button"
              onClick={onRemoveScreenshot}
              className="screenshot-remove-btn"
            >
              ✕ Remove
            </button>
          </div>
        )}
      </div>

      <div className="question-footer">
        {/* Top Row: Clear and Generate Answer */}
        <div className="footer-top-row">
          <button
            type="button"
            className="clear-btn"
            onClick={clearQuestionAndAnswer}
          >
            🗑 Clear
          </button>

          <button
            type="button"
            disabled={loading || (!question.trim() && !screenshotImage)}
            onClick={generateAnswer}
            className="generate-btn"
          >
            {loading ? "⚡ Generating..." : "✨ Generate Answer"}
          </button>
        </div>

        {/* Bottom Row: Dedicated Screenshot Button */}
        <button
          type="button"
          onClick={onTakeScreenshot}
          className={`screenshot-btn ${screenshotImage ? "screenshot-attached" : ""}`}
          disabled={loading}
        >
          {screenshotImage ? "✓ Screen Attached" : "📸 Take Screenshot"}
        </button>
      </div>
    </div>
  );
}

export default QuestionPanel;