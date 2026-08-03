function normalizeContent(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

function TextSection({ content }) {
  const lines = normalizeContent(content);

  if (lines.length === 0) {
    return (
      <p className="resume-summary-empty">
        Self introduction is not available.
      </p>
    );
  }

  return (
    <div className="resume-summary-text-group">
      {lines.map((line, index) => (
        <p
          key={`${line}-${index}`}
          className="resume-summary-paragraph"
        >
          {line}
        </p>
      ))}
    </div>
  );
}

function ResumeSummaryCard({ resumeProfile }) {
  if (!resumeProfile) return null;

  return (
    <section className="resume-summary-card">
      <div className="resume-summary-card-header">
        <div>
          <span className="resume-summary-eyebrow">
            Resume Interview Profile
          </span>

          <h2>Interview Ready Self Introduction</h2>

          <p>
            Review your AI-generated self introduction before starting your interview.
          </p>
        </div>

        <span className="resume-summary-ready-badge">
          ✓ Profile Ready
        </span>
      </div>

      <div className="resume-summary-section">
        <div className="resume-summary-heading">
          <span className="resume-summary-icon">🎯</span>

          <div>
            <span>Section 01</span>
            <h3>Self Introduction</h3>
          </div>
        </div>

        <TextSection content={resumeProfile.selfIntroduction} />
      </div>
    </section>
  );
}

export default ResumeSummaryCard;