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
    .split(/\\r?\\n/)
    .map((line) =>
      line.replace(/^[-•*]\\s*/, "").trim()
    )
    .filter(Boolean);
}

function TextSection({ content }) {
  const lines = normalizeContent(content);

  if (lines.length === 0) {
    return (
      <p className="resume-summary-empty">
        Details are not available in the uploaded resume.
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

function ResponsibilitiesSection({ content }) {
  const items = normalizeContent(content);

  if (items.length === 0) {
    return (
      <p className="resume-summary-empty">
        Roles and responsibilities are not available in the uploaded resume.
      </p>
    );
  }

  return (
    <ul className="resume-summary-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          {item}
        </li>
      ))}
    </ul>
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
          <h2>AI-Prepared Interview Content</h2>
          <p>
            Review your introduction, project explanation, and responsibilities
            before starting the interview.
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

      <div className="resume-summary-divider" />

      <div className="resume-summary-section">
        <div className="resume-summary-heading">
          <span className="resume-summary-icon">📄</span>
          <div>
            <span>Section 02</span>
            <h3>Project Explanation</h3>
          </div>
        </div>
        <TextSection content={resumeProfile.projectExplanation} />
      </div>

      <div className="resume-summary-divider" />

      <div className="resume-summary-section">
        <div className="resume-summary-heading">
          <span className="resume-summary-icon">🔧</span>
          <div>
            <span>Section 03</span>
            <h3>Roles &amp; Responsibilities</h3>
          </div>
        </div>
        <ResponsibilitiesSection content={resumeProfile.rolesExplanation} />
      </div>
    </section>
  );
}

export default ResumeSummaryCard;
