export function buildResumePrompt(resumeText) {
  return `
You are a senior technical recruiter and interview coach.
Analyze the resume and create a factual interview profile.

STRICT RULES
- Use only information supported by the resume.
- Do not invent companies, projects, technologies, experience, responsibilities, achievements, or metrics.
- When a value is unavailable, use an empty string or empty array.
- Return only valid JSON. Do not use markdown or code fences.

RESUME
${resumeText}

RETURN THIS EXACT JSON STRUCTURE
{
  "candidateName": "",
  "experience": "",
  "currentCompany": "",
  "primaryRole": "",
  "resumeSummary": "",
  "selfIntroduction": "",
  "projectExplanation": "",
  "rolesExplanation": "",
  "skills": [],
  "primarySkills": [],
  "projects": [
    {
      "name": "",
      "domain": "",
      "summary": "",
      "responsibilities": []
    }
  ],
  "responsibilities": [],
  "currentProjectName": "",
  "currentProjectDomain": "",
  "currentProjectSummary": "",
  "currentProjectResponsibilities": []
}

WRITING REQUIREMENTS

selfIntroduction:
- Write 100 to 130 words.
- Write exactly as the candidate should speak in an interview.
- Use simple, confident, professional Indian English.
- Cover name, experience, current company/role, core skills, current project, key responsibilities, and a short professional closing.
- Use one natural paragraph. No bullets and no headings.

projectExplanation:
- Write 120 to 180 words in first person, as the candidate should explain the current or most recent project.
- Explain the project purpose/domain, major modules or flow, technologies, the candidate's contribution, and how services interact, but only when supported by the resume.
- Keep it natural and interview-ready.

rolesExplanation:
- Write 100 to 160 words in first person.
- Summarize the candidate's actual day-to-day responsibilities from the resume.
- Make it easy to speak aloud and do not invent responsibilities.

resumeSummary:
- Write a concise factual summary in 6 to 8 sentences.

skills and primarySkills:
- Include only technical skills found in the resume.

projects:
- Return every identifiable project separately.

currentProject fields:
- Populate them from the current or most recent project.

Return only the JSON object.
`.trim();
}
