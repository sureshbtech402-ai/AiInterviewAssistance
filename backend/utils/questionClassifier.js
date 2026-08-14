function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function containsAny(question, patterns = []) {
  return patterns.some((pattern) =>
    question.includes(pattern)
  );
}

export function classifyQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return "CONCEPT";
  }

  // ==================================================
  // SELF INTRODUCTION
  // ==================================================

  const selfIntroPatterns = [
    "tell me about yourself",
    "tell us about yourself",
    "introduce yourself",
    "can you introduce yourself",
    "could you introduce yourself",
    "please introduce yourself",
    "give me your introduction",
    "your introduction",
    "self introduction",
    "self-introduction",
    "about yourself",
    "walk me through your resume",
    "walk me through your cv",
    "walk me through your background",
    "tell me about your background",
  ];

  if (containsAny(q, selfIntroPatterns)) {
    return "SELF_INTRO";
  }

  // ==================================================
  // CODING / SYNTAX / QUERIES / COMMANDS
  // ==================================================

  const codingPatterns = [
    // General coding
    "syntax",
    "write code",
    "write the code",
    "give me code",
    "give me the code",
    "show me code",
    "show me the code",
    "code snippet",
    "write a program",
    "write program",
    "write a method",
    "write a function",
    "create a method",
    "create a function",
    "implement this",
    "implement the",
    "implementation of",
    "can you code",
    "could you code",
    "coding question",
    "coding problem",
    "solve this problem",
    "solve the problem",

    // Java / Core Java
    "java code",
    "java syntax",
    "java program",
    "java method",
    "java function",
    "hashmap code",
    "hash map code",
    "arraylist code",
    "linkedlist code",
    "reverse string",
    "reverse a string",
    "reverse linked list",
    "find duplicate",
    "find duplicates",
    "duplicate characters",
    "duplicates in string",
    "remove duplicate",
    "remove duplicates",
    "palindrome",
    "anagram",
    "fibonacci",
    "factorial",
    "binary search",
    "linear search",
    "sort an array",
    "sort the array",
    "merge arrays",
    "find maximum",
    "find minimum",
    "count characters",
    "count frequency",
    "frequency of characters",
    "find missing number",
    "two sum",

    // Selenium
    "selenium code",
    "selenium syntax",
    "selenium script",
    "webdriver code",
    "webdriver syntax",
    "web driver code",
    "xpath",
    "xpath syntax",
    "css selector",
    "locator syntax",
    "findelement",
    "find elements",
    "webelement",
    "window handling",
    "windows handling",
    "handle windows",
    "handle browser windows",
    "switch window",
    "switch to window",
    "switch tabs",
    "handle tabs",
    "iframe code",
    "frame handling",
    "alert handling",
    "dropdown code",
    "select class",
    "actions class",
    "mouse hover",
    "drag and drop",
    "screenshot code",
    "explicit wait",
    "implicit wait",
    "fluent wait",
    "wait syntax",
    "broken link code",
    "broken links code",
    "broken server code",

    // TestNG / JUnit
    "testng code",
    "testng syntax",
    "testng annotation",
    "testng annotations",
    "junit code",
    "junit syntax",
    "junit annotation",
    "junit annotations",
    "beforemethod",
    "aftermethod",
    "beforeclass",
    "afterclass",
    "dataprovider",
    "parallel testing",
    "parallel execution",

    // REST Assured / API
    "rest assured code",
    "rest assured syntax",
    "rest api code",
    "rest api syntax",
    "api code",
    "api syntax",
    "api request code",
    "api automation code",
    "api test code",
    "get request",
    "post request",
    "put request",
    "delete request",

    // Cucumber / BDD
    "cucumber code",
    "cucumber syntax",
    "feature file",
    "feature file syntax",
    "gherkin syntax",
    "step definition",
    "step definitions",
    "given when then",
    "bdd code",
    "bdd syntax",

    // SQL
    "sql query",
    "sql syntax",
    "write sql",
    "write a query",
    "write query",
    "give me query",
    "database query",
    "select query",
    "insert query",
    "update query",
    "delete query",
    "join query",
    "inner join",
    "left join",
    "right join",
    "group by query",
    "having query",
    "subquery",
    "find duplicates in sql",
    "second highest salary",
    "nth highest salary",

    // Git / Shell
    "git command",
    "git commands",
    "git syntax",
    "shell script",
    "shell command",
    "bash script",
    "bash command",
    "write a script",
  ];

  if (containsAny(q, codingPatterns)) {
    return "CODING";
  }

  // ==================================================
  // ARCHITECTURE / FRAMEWORK / PROJECT DESIGN
  // ==================================================

  const architecturePatterns = [
    "system design",
    "system-design",
    "high level design",
    "high-level design",
    "low level design",
    "low-level design",
    "hld",
    "lld",

    // Architecture
    "system architecture",
    "application architecture",
    "software architecture",
    "project architecture",
    "framework architecture",
    "automation framework architecture",
    "architecture of your project",
    "architecture of the application",
    "explain the architecture",
    "explain your architecture",

    // Project
    "explain your project",
    "explain the project",
    "explain your current project",
    "project explanation",
    "how does your project work",
    "how does the project work",
    "project flow",
    "complete project flow",
    "end to end project flow",
    "end-to-end project flow",

    // Automation framework
    "automation framework",
    "test automation framework",
    "framework design",
    "selenium framework",
    "selenium architecture",
    "bdd framework",
    "cucumber framework",

    // Flow
    "request flow",
    "request-response flow",
    "request response flow",
    "application flow",
    "api flow",
    "api request flow",
    "data flow",
    "deployment flow",
    "end to end flow",
    "end-to-end flow",

    // Services / API
    "service communication",
    "how services communicate",
    "service-to-service communication",

    // Design
    "sequence diagram",
    "component design",
    "architecture design",
    "deployment architecture",
    "design a system",
    "design an application",
    "design an api",
    "design a scalable system",
    "design a scalable application",
    "how would you design",
    "how will you design",
    "how do you design",
    "how would you architect",
    "how will you architect",
    "how do you architect",
  ];

  if (containsAny(q, architecturePatterns)) {
    return "ARCHITECTURE";
  }

  // ==================================================
  // SCENARIO / TROUBLESHOOTING
  // ==================================================

  const scenarioPatterns = [
    "tell me about a time",
    "tell me about an incident",
    "tell me about a situation",
    "have you ever",
    "did you ever face",
    "how did you handle",
    "how have you handled",
    "what did you do when",
    "what would you do",
    "what will you do",
    "how would you handle",
    "how will you handle",
    "how would you approach",
    "how will you approach",
    "what is your approach",
    "what would be your approach",

    // Production
    "production issue",
    "production problem",
    "production bug",
    "production incident",
    "production failure",
    "production outage",
    "critical issue",
    "critical bug",
    "production support",

    // Client / team
    "client issue",
    "client problem",
    "customer issue",
    "customer problem",
    "team conflict",
    "conflict with team member",
    "disagreement with",

    // Troubleshooting
    "bug you fixed",
    "issue you faced",
    "problem you faced",
    "incident you handled",
    "failure you handled",
    "how did you fix",
    "how did you resolve",
    "how would you troubleshoot",
    "how will you troubleshoot",
    "troubleshoot this",
    "debug this issue",
    "debug a",

    // Hypothetical
    "what if the",
    "what if your",
    "suppose the",
    "suppose your",
    "imagine the",
    "imagine your",
  ];

  if (containsAny(q, scenarioPatterns)) {
    return "SCENARIO";
  }

  // ==================================================
  // DEFAULT
  // ==================================================

  return "CONCEPT";
}