import "../styles/answerPanel.css";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function AnswerPanel({ answerData, loading }) {
  const answerText = typeof answerData === "string" ? answerData : "";
  const hasAnswer = answerText.trim().length > 0;

  const copyAnswer = () => {
    navigator.clipboard.writeText(answerText || "");
  };

  return (
    <div className="answer-panel">
      <div className="answer-header">
        <div>
          <h2 className="answer-title">🤖 AI Interview Answer</h2>
          <p className="answer-subtitle">
            Live streaming answer with interview-ready wording
          </p>
        </div>

        {loading && hasAnswer && (
          <div className="streaming-badge">⚡ Streaming</div>
        )}
      </div>

      <div className="answer-body">
        {loading && !hasAnswer ? (
          <div className="loading-container">
            <div className="loader"></div>
            <div className="loading-text">Thinking...</div>
          </div>
        ) : !hasAnswer ? (
          <div className="empty-container">
            <div className="empty-icon">💡</div>
            <h3>No Answer Yet</h3>
            <p>
              Click <b>Generate AI Answer</b> to receive an interview response.
            </p>
          </div>
        ) : (
          <div className="stream-card">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="markdown-h1">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="markdown-h2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="markdown-h3">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="markdown-p">{children}</p>
                ),
                li: ({ children }) => (
                  <li className="markdown-li">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="markdown-strong">{children}</strong>
                ),
                code({ inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeText = String(children).replace(/\n$/, "");

                  if (!inline && match) {
                    return (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          borderRadius: "16px",
                          fontSize: "17px",
                          padding: "24px",
                          margin: "20px 0",
                          lineHeight: "1.7",
                        }}
                        {...props}
                      >
                        {codeText}
                      </SyntaxHighlighter>
                    );
                  }

                  return (
                    <code className="inline-code" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {answerText}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {hasAnswer && (
        <div className="copy-footer">
          <button className="copy-btn" onClick={copyAnswer}>
            📋 Copy Answer
          </button>
        </div>
      )}
    </div>
  );
}

export default AnswerPanel;
