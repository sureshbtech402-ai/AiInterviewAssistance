import "../styles/answerPanel.css";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function AnswerPanel({ answerData, loading }) {
  const projectText =
    answerData?.projectAnswer ||
    answerData?.resumeExample ||
    "Project related answer will appear here.";

  return (
    <div className="answer-panel">
      <div className="answer-header">
        <div>
          <h2 className="answer-title">🤖 AI Interview Answer</h2>
          <p className="answer-subtitle">
            Short, simple and interview-ready response
          </p>
        </div>
      </div>

      <div className="answer-body">
        {loading ? (
          <div className="loading-container">
            <div className="loader"></div>
            <div className="loading-text">Generating your answer...</div>
          </div>
        ) : !answerData ? (
          <div className="empty-container">
            <div className="empty-icon">💡</div>
            <h3>No Answer Yet</h3>
            <p>
              Click <b>Generate AI Answer</b> to receive an interview response.
            </p>
          </div>
        ) : (
          <>
            <div className="answer-card">
              <div className="section-title">🎯 Interview Ready Answer</div>
              <div className="section-content">
                <ReactMarkdown>{answerData.answer || ""}</ReactMarkdown>
              </div>
            </div>

            <div className="answer-card">
              <div className="section-title">⭐ Key Points</div>
              <ul className="keypoints-list">
                {answerData.keyPoints?.map((point, index) => (
                  <li key={index}>
                    <ReactMarkdown>{point}</ReactMarkdown>
                  </li>
                ))}
              </ul>
            </div>

            <div className="answer-card">
              <div className="section-title">📄 Project Related Answer</div>
              <div className="section-content">
                <ReactMarkdown>{projectText}</ReactMarkdown>
              </div>
            </div>

            {answerData.code && (
              <div className="answer-card">
                <div className="section-title">
                  💻 {answerData.language || "Code"}
                </div>

                <div className="copy-row">
                  <button
                    className="copy-btn"
                    onClick={() =>
                      navigator.clipboard.writeText(answerData.code)
                    }
                  >
                    📋 Copy Code
                  </button>
                </div>

                <SyntaxHighlighter
                  language={
                    answerData.language
                      ?.toLowerCase()
                      .replace("spring boot", "java") || "java"
                  }
                  style={oneDark}
                  customStyle={{
                    borderRadius: "16px",
                    fontSize: "17px",
                    padding: "24px",
                    marginTop: "18px",
                    lineHeight: "1.7",
                  }}
                >
                  {answerData.code}
                </SyntaxHighlighter>

                {answerData.timeComplexity && (
                  <>
                    <div className="section-title">⏱ Time Complexity</div>
                    <div className="section-content">
                      {answerData.timeComplexity}
                    </div>
                  </>
                )}

                {answerData.spaceComplexity && (
                  <>
                    <div className="section-title">📦 Space Complexity</div>
                    <div className="section-content">
                      {answerData.spaceComplexity}
                    </div>
                  </>
                )}

                {answerData.output && (
                  <>
                    <div className="section-title">▶ Sample Output</div>
                    <pre className="output-block">{answerData.output}</pre>
                  </>
                )}

                {answerData.codeExplanation && (
                  <>
                    <div className="section-title">📘 Code Explanation</div>
                    <div className="section-content">
                      <ReactMarkdown>
                        {answerData.codeExplanation}
                      </ReactMarkdown>
                    </div>
                  </>
                )}

                {answerData.notes && (
                  <>
                    <div className="section-title">📝 Notes</div>
                    <div className="section-content">
                      <ReactMarkdown>{answerData.notes}</ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {answerData && (
        <div className="copy-footer">
          <button
            className="copy-btn"
            onClick={() =>
              navigator.clipboard.writeText(
                JSON.stringify(answerData, null, 2)
              )
            }
          >
            📋 Copy Complete Answer
          </button>
        </div>
      )}
    </div>
  );
}

export default AnswerPanel;