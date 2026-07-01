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

      {/* Header */}

      <div className="question-header">

        <h2 className="panel-title">
          🎤 Interview Question
        </h2>

        <div
          className={
            isInterviewRunning
              ? "status listening"
              : "status stopped"
          }
        >
          {isInterviewRunning
            ? "🟢 Listening"
            : "🔴 Stopped"}
        </div>

      </div>

      {/* Question */}

      <textarea
        ref={textareaRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="The interviewer's question will appear here..."
        className="question-box"
      />

      {/* Buttons */}

      <div className="button-row">

          <button
              className="clear-btn"
              onClick={()=>{
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
              {loading
                  ? "Generating..."
                  : "✨ Generate AI Answer"}
          </button>

      </div>
    </div>
  );

}

export default QuestionPanel;