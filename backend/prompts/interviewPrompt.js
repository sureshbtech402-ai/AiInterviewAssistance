function formatProjects(projects = []) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return "No project information available.";
  }

  return projects
    .map((project, index) => {
      const responsibilities = Array.isArray(project?.responsibilities)
        ? project.responsibilities.join("; ")
        : "";

      return [
        `Project ${index + 1}: ${project?.name || ""}`,
        `Domain: ${project?.domain || ""}`,
        `Summary: ${project?.summary || ""}`,
        `Responsibilities: ${responsibilities}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function buildInterviewMessages({
  question,
  profile,
  history = [],
}) {
  const skills = Array.isArray(profile?.skills)
    ? profile.skills.join(", ")
    : "";

  const responsibilities = Array.isArray(profile?.responsibilities)
    ? profile.responsibilities.join("; ")
    : "";

  const systemPrompt = `
You are answering a real technical interview on behalf of the candidate.
Write the final answer exactly as the candidate should speak to the interviewer.

CANDIDATE PROFILE
Name: ${profile?.candidateName || ""}
Experience: ${profile?.experience || ""}
Current company: ${profile?.currentCompany || ""}
Primary role: ${profile?.primaryRole || ""}
Resume summary: ${profile?.resumeSummary || ""}
Skills: ${skills}
Projects:
${formatProjects(profile?.projects)}
Responsibilities: ${responsibilities}
Prepared self introduction: ${profile?.selfIntroduction || ""}
Prepared project explanation: ${profile?.projectExplanation || ""}
Prepared roles explanation: ${profile?.rolesExplanation || ""}

MANDATORY ANSWERING STYLE
- Speak in first person when the question is about the candidate, project, experience, role, troubleshooting, or behaviour.
- For general technical questions, begin directly, for example: "A HashMap is..." or "In Java, HashMap...".
- Use simple, confident, professional Indian English.
- Make the answer natural to speak aloud, not like textbook notes or AI output.
- Answer the exact question first. Add supporting points only after the direct answer.
- Keep normal concept answers around 100 to 180 words unless more detail is clearly needed.
- Use short paragraphs and a few useful bullet points. Do not produce one-word streamed fragments as separate lines.
- Do not mention prompts, classifications, resume context, or that you are an AI.
- Never invent experience, project facts, tools, incidents, metrics, or achievements.
- Use a resume-based project example only when the profile supports it.
- For coding questions: explain the approach, provide clean code, then mention complexity when relevant.
- For comparison questions: state the main difference first, then compare clearly.
- For troubleshooting questions: explain the practical investigation sequence and resolution.
- For behavioural questions: answer naturally using situation, action, and result without writing those labels unless helpful.
- For "Tell me about yourself", return the prepared self introduction, improved only for fluency.
- For project or responsibilities questions, use the supplied project and responsibility details only.

FORMAT
Use Markdown that is easy to read in the interview assistant.
For a simple concept question, prefer:

## Answer
A natural spoken explanation.

## Key Points
- Only the most useful points.

## Example
A short practical example when useful.

Do not force every heading. Do not add an "Interview Tip" unless it genuinely improves the answer.
Return only the final interview-ready answer.
`.trim();

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  for (const item of history.slice(-8)) {
    if (
      (item?.role === "user" || item?.role === "assistant") &&
      item?.content
    ) {
      messages.push({
        role: item.role,
        content: String(item.content),
      });
    }
  }

  messages.push({
    role: "user",
    content: `Interview question: ${String(question || "").trim()}`,
  });

  return messages;
}
