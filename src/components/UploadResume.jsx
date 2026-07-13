import "../styles/uploadResume.css";

function UploadResume({
  resumeName,
  handleResumeUpload,
  skills,
  interviewLevel,
  setInterviewLevel,
  company,
  setCompany,
  customCompany,
  setCustomCompany,
  interviewType,
  setInterviewType,
}) {
  const hasResume = Boolean(resumeName);

  return (
    <section className="interview-setup">
      <div className="setup-hero">
        <div className="setup-hero-content">
          <div className="setup-badge">
            <span className="setup-badge-dot"></span>
            AI Interview Preparation
          </div>

          <h1 className="setup-heading">
            Let&apos;s ace your next interview
            <span className="setup-heading-icon"> 🚀</span>
          </h1>

          <p className="setup-description">
            Upload your resume, choose your interview preferences and start a
            personalised AI-powered interview session.
          </p>

          <div className="setup-features">
            <div className="setup-feature">
              <span className="setup-feature-icon">🎤</span>
              Live speech recognition
            </div>

            <div className="setup-feature">
              <span className="setup-feature-icon">🤖</span>
              AI interview answers
            </div>

            <div className="setup-feature">
              <span className="setup-feature-icon">📄</span>
              Resume-based responses
            </div>
          </div>
        </div>

        <div className="setup-robot-card">
          <div className="robot-glow"></div>

          <div className="robot-icon">🤖</div>

          <h3>AI Interview Assistant</h3>

          <p>
            Your profile will be analysed and used to provide personalised
            interview-ready answers.
          </p>

          <div className="assistant-status">
            <span className="assistant-status-dot"></span>
            Ready to assist
          </div>
        </div>
      </div>

      <div className="config-card">
        <div className="config-card-header">
          <div>
            <span className="config-eyebrow">INTERVIEW SETUP</span>
            <h2 className="config-title">Interview Configuration</h2>
            <p className="config-subtitle">
              Configure your profile before starting the interview.
            </p>
          </div>

          <div className="config-step">
            <span className="config-step-number">1</span>
            Profile Setup
          </div>
        </div>

        <div className="config-grid">
          <div className="config-item resume-config-item">
            <label className="config-label">Resume</label>

            <label
              htmlFor="resume"
              className={`resume-upload-box ${
                hasResume ? "resume-uploaded" : ""
              }`}
            >
              <div className="resume-upload-icon">
                {hasResume ? "✅" : "📄"}
              </div>

              <div className="resume-upload-content">
                <span className="resume-upload-title">
                  {hasResume ? "Resume Uploaded" : "Upload Resume"}
                </span>

                <span className="resume-upload-description">
                  {hasResume
                    ? "Click here to replace your resume"
                    : "PDF format only"}
                </span>
              </div>

              <div className="resume-upload-action">
                {hasResume ? "Change" : "Browse"}
              </div>
            </label>

            <input
              id="resume"
              type="file"
              accept=".pdf"
              hidden
              onChange={handleResumeUpload}
            />

            {hasResume && (
              <div className="resume-file">
                <span className="resume-file-icon">📎</span>

                <span className="resume-file-name">{resumeName}</span>

                <span className="resume-file-status">Ready</span>
              </div>
            )}
          </div>

          <div className="config-item">
            <label className="config-label" htmlFor="company">
              Target Company
            </label>

            <div className="select-wrapper">
              <span className="select-icon">🏢</span>

              <select
                id="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              >
                <option>Google</option>
                <option>Amazon</option>
                <option>Microsoft</option>
                <option>Oracle</option>
                <option>Accenture</option>
                <option>TCS</option>
                <option>Infosys</option>
                <option>Cognizant</option>
                <option>Capgemini</option>
                <option>Wipro</option>
                <option>Others</option>
              </select>
            </div>

            {company === "Others" && (
              <input
                className="custom-company-input"
                type="text"
                placeholder="Enter company name"
                value={customCompany}
                onChange={(event) => setCustomCompany(event.target.value)}
              />
            )}
          </div>

          <div className="config-item">
            <label className="config-label" htmlFor="interviewLevel">
              Interview Level
            </label>

            <div className="select-wrapper">
              <span className="select-icon">📈</span>

              <select
                id="interviewLevel"
                value={interviewLevel}
                onChange={(event) => setInterviewLevel(event.target.value)}
              >
                <option>Fresher</option>
                <option>Junior</option>
                <option>Mid Level</option>
                <option>Senior</option>
                <option>Lead</option>
                <option>Architect</option>
              </select>
            </div>
          </div>

          <div className="config-item">
            <label className="config-label" htmlFor="interviewType">
              Interview Type
            </label>

            <div className="select-wrapper">
              <span className="select-icon">🎯</span>

              <select
                id="interviewType"
                value={interviewType}
                onChange={(event) => setInterviewType(event.target.value)}
              >
                <option>Technical</option>
                <option>Coding</option>
                <option>System Design</option>
                <option>Behavioral</option>
                <option>HR</option>
                <option>Managerial</option>
              </select>
            </div>
          </div>
        </div>

        {skills.length > 0 && (
          <div className="skills-section">
            <div className="skills-header">
              <div>
                <div className="skills-title">Resume Skills</div>
                <div className="skills-subtitle">
                  Technologies detected from your resume
                </div>
              </div>

              <div className="skills-count">
                {skills.length} Skills
              </div>
            </div>

            <div className="skills-scroll-wrapper">
              <div className="skills">
                {skills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="skill"
                    title={skill}
                  >
                    <span className="skill-dot"></span>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default UploadResume;