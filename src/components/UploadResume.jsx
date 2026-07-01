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
  return (
    <div className="config-card">

      <div className="config-title">
        Interview Configuration
      </div>

      <div className="config-row">

        {/* Resume */}

        <div className="config-item">

          <label>Resume</label>

          <label
            htmlFor="resume"
            className="upload-btn"
          >
            📄 {resumeName ? "Change Resume" : "Upload Resume"}
          </label>

          <input
            id="resume"
            type="file"
            accept=".pdf"
            hidden
            onChange={handleResumeUpload}
          />

          {resumeName && (
            <div className="resume-file">
              ✓ {resumeName}
            </div>
          )}

        </div>

        {/* Company */}

        <div className="config-item">

          <label>Company</label>

          <select
            value={company}
            onChange={(e)=>setCompany(e.target.value)}
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

          {company==="Others" && (

            <input
              type="text"
              placeholder="Enter Company Name"
              value={customCompany}
              onChange={(e)=>setCustomCompany(e.target.value)}
              style={{marginTop:"10px"}}
            />

          )}

        </div>

        {/* Interview Level */}

        <div className="config-item">

          <label>Interview Level</label>

          <select
            value={interviewLevel}
            onChange={(e)=>setInterviewLevel(e.target.value)}
          >
            <option>Fresher</option>
            <option>Junior</option>
            <option>Mid Level</option>
            <option>Senior</option>
            <option>Lead</option>
            <option>Architect</option>
          </select>

        </div>

        {/* Interview Type */}

        <div className="config-item">

          <label>Interview Type</label>

          <select
            value={interviewType}
            onChange={(e)=>setInterviewType(e.target.value)}
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

      {skills.length>0 && (

        <div className="skills-section">

          <div className="skills-title">
            Resume Skills
          </div>

          <div className="skills">

            {skills.map((skill)=>(

              <span
                key={skill}
                className="skill"
              >
                {skill}
              </span>

            ))}

          </div>

        </div>

      )}

    </div>
  );
}

export default UploadResume;