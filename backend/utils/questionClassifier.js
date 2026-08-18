function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(question, patterns = []) {
  return patterns.some((pattern) => question.includes(pattern));
}

export function classifyQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return "CONCEPT";
  }

  // ==================================================
  // 1. SELF INTRODUCTION
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
  // 2. CODING / SYNTAX / QUERY / COMMAND
  // ==================================================

  const codingPatterns = [
    // General coding
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
    "write the method",
    "write a function",
    "write the function",
    "create a method",
    "create the method",
    "create a function",
    "create the function",
    "can you code",
    "could you code",
    "coding question",
    "coding problem",
    "solve this problem",
    "solve the problem",
    "solve this using",
    "implement this in",
    "implement the code",
    "implementation code",
    "give me the syntax",
    "show me the syntax",
    "write syntax",
    "give syntax",

    // Common coding problems
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

    // Java
    "java code",
    "java syntax",
    "java program",
    "java method",
    "java function",
    "hashmap code",
    "hash map code",
    "arraylist code",
    "linkedlist code",

    // Selenium / UI
    "selenium code",
    "selenium syntax",
    "selenium script",
    "webdriver code",
    "webdriver syntax",
    "web driver code",
    "xpath syntax",
    "xpath code",
    "css selector syntax",
    "locator syntax",
    "findelement syntax",
    "find elements code",
    "webelement code",
    "handle windows code",
    "switch window code",
    "switch tabs code",
    "iframe code",
    "frame handling code",
    "alert handling code",
    "dropdown code",
    "actions class code",
    "mouse hover code",
    "drag and drop code",
    "screenshot code",
    "explicit wait code",
    "implicit wait code",
    "fluent wait code",
    "wait syntax",
    "broken link code",
    "broken links code",
    "broken server code",

    // Test frameworks
    "testng code",
    "testng syntax",
    "testng annotation code",
    "testng annotations code",
    "junit code",
    "junit syntax",
    "junit annotation code",
    "junit annotations code",
    "beforemethod code",
    "aftermethod code",
    "beforeclass code",
    "afterclass code",
    "dataprovider code",
    "parallel testing code",
    "parallel execution code",

    // API
    "rest assured code",
    "rest assured syntax",
    "rest api code",
    "rest api syntax",
    "api code",
    "api syntax",
    "api request code",
    "api automation code",
    "api test code",
    "get request code",
    "post request code",
    "put request code",
    "delete request code",
    "write a get request",
    "write a post request",
    "write a put request",
    "write a delete request",

    // BDD
    "cucumber code",
    "cucumber syntax",
    "feature file syntax",
    "step definition code",
    "step definitions code",
    "given when then code",
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
    "inner join query",
    "left join query",
    "right join query",
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
  // 3. PROJECT / ROLE / RESPONSIBILITIES
  // ==================================================

  const projectPatterns = [
    "explain your project",
    "explain the project",
    "explain your current project",
    "tell me about your project",
    "tell me about the project",
    "tell me about your current project",
    "what is your project",
    "what is the project you are working on",
    "what project are you working on",
    "current project",
    "project explanation",
    "describe your project",
    "describe the project",
    "walk me through your project",
    "walk me through the project",

    "roles and responsibilities",
    "role and responsibilities",
    "your responsibilities",
    "your responsibility",
    "what are your responsibilities",
    "what is your responsibility",
    "what is your role in the project",
    "what is your role in this project",
    "what do you do in your project",
    "what do you do in the project",
    "what exactly do you do",
    "what exactly are you doing",
    "what is your work in the project",
    "what is your contribution",
    "your contribution in the project",

    "daily work",
    "daily basis",
    "day to day work",
    "day-to-day work",
    "daily activities",
    "what do you do on a daily basis",
    "what do you do daily",
    "what is your day to day work",
    "what is your daily work",
    "what are your daily activities",

    "what do you work on",
    "what are you working on",
    "what do you mainly work on",
    "what is your main work",
    "what is your main responsibility",
    "what are you mainly responsible for",
    "what functionality are you working on",
    "what features do you work on",
  ];

  if (containsAny(q, projectPatterns)) {
    return "PROJECT";
  }

  // ==================================================
  // 4. ARCHITECTURE / FLOW / DESIGN
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

    "system architecture",
    "application architecture",
    "software architecture",
    "project architecture",
    "framework architecture",
    "architecture of your project",
    "architecture of the application",
    "explain the architecture",
    "explain your architecture",
    "how is your application designed",
    "how is the application designed",

    "automation framework",
    "test automation framework",
    "framework design",
    "selenium framework",
    "selenium architecture",
    "bdd framework",
    "cucumber framework",
    "framework flow",
    "explain your framework",

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
    "complete flow",
    "complete application flow",

    "service communication",
    "how services communicate",
    "service to service communication",
    "service-to-service communication",
    "microservice communication",
    "how microservices communicate",

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
  // 5. SCENARIO / TROUBLESHOOTING
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
    "suppose",
    "what if",
    "imagine",

    "production issue",
    "production problem",
    "production bug",
    "production incident",
    "production failure",
    "production outage",
    "critical issue",
    "critical bug",
    "production support",

    "client issue",
    "client problem",
    "customer issue",
    "customer problem",
    "team conflict",
    "conflict with team member",
    "disagreement with",

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
    "troubleshoot the issue",
    "debug this issue",
    "debug the issue",
    "debug a",
    "how do you troubleshoot",
    "how do you debug",
  ];

  if (containsAny(q, scenarioPatterns)) {
    return "SCENARIO";
  }

  // ==================================================
  // 6. DEFAULT
  // ==================================================

  return "CONCEPT";
}