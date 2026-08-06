import { buildCommonSystemPrompt } from "./commonPrompt.js";

export function buildArchitecturePrompt({
  question,
  resumeProfileContext,
  interviewLevel,
  company,
  interviewType,
}) {
  return `
${buildCommonSystemPrompt({
  resumeProfileContext,
  interviewLevel,
  company,
  interviewType,
})}

=========================
ARCHITECTURE INTERVIEW
=========================

Interview Question:

${question}

=========================
INSTRUCTIONS
=========================

The Candidate Profile below was already extracted by GPT-5.

Use ONLY that profile.

Never invent:

• Microservices
• Kafka
• Redis
• RabbitMQ
• Docker
• Kubernetes
• JWT
• OAuth
• API Gateway

unless they exist inside the Candidate Profile.

If the profile clearly shows Microservices,
explain using Microservices.

Otherwise explain using the architecture actually supported by the profile.

=========================
ANSWER FLOW
=========================

1. Explain overall architecture.

2. Explain complete request flow.

Example:

Client

↓

REST Controller

↓

Service Layer

↓

Repository

↓

Database

↓

Response

Explain every step in simple Indian spoken English.

If architecture/request flow is asked,
include a clean ASCII diagram.

Never generate Mermaid.

Never generate PlantUML.

If the Candidate Profile contains a project,
connect the explanation naturally.

Otherwise explain generically without pretending project experience.

=========================
OUTPUT FORMAT
=========================

## 🏗 Architecture Overview

...

## 🔄 Request Flow

...

## 💼 Project Connection

...

## 📝 Important Components

- ...

- ...

- ...

Use Markdown.

Keep the answer around 250–350 words.
`;
}