
function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function containsPattern(question, patterns = []) {
  return patterns.some((pattern) => question.includes(pattern));
}

export function classifyQuestion(question = "") {
  const q = normalizeQuestion(question);

  if (!q) {
    return "CONCEPT";
  }

  const selfIntroPatterns = [
    "tell me about yourself",
    "tell us about yourself",
    "introduce yourself",
    "can you introduce yourself",
    "could you introduce yourself",
    "please introduce yourself",
    "give me your introduction",
    "give us your introduction",
    "your introduction",
    "self introduction",
    "self-introduction",
    "brief introduction",
    "walk me through your resume",
    "walk me through the resume",
    "walk me through your cv",
    "walk me through your background",
    "tell me about your background",
  ];

  if (containsPattern(q, selfIntroPatterns)) {
    return "SELF_INTRO";
  }

  const codingPatterns = [
    "syntax",
    "syntax for",
    "syntax of",
    "code",
    "write code",
    "write the code",
    "write a code",
    "give me code",
    "give me the code",
    "give me syntax",
    "show me code",
    "show me the code",
    "show me syntax",
    "code snippet",
    "code for",
    "code this",
    "coding",
    "coding question",
    "coding problem",
    "write a program",
    "write program",
    "program for",
    "write a function",
    "write a method",
    "create a method",
    "create a function",
    "can you code",
    "could you code",
    "solve this problem",
    "solve the problem",
    "solve this using",
    "algorithm for",

    // ------------------------------
    // Programming languages
    // ------------------------------

    "java code",
    "java syntax",
    "java program",
    "java method",
    "java function",
    "python code",
    "python syntax",
    "python program",
    "javascript code",
    "javascript syntax",
    "javascript program",
    "js code",
    "typescript code",
    "c++ code",
    "c# code",

    // ------------------------------
    // Java / programming problems
    // ------------------------------

    "reverse string",
    "reverse a string",
    "reverse linked list",
    "find duplicates",
    "find duplicate",
    "remove duplicates",
    "remove duplicate",
    "check palindrome",
    "palindrome",
    "anagram",
    "fibonacci",
    "factorial",
    "binary search",
    "linear search",
    "sort an array",
    "sort the array",
    "merge two arrays",
    "merge arrays",
    "find the maximum",
    "find the minimum",
    "count characters",
    "count frequency",
    "frequency of characters",
    "find missing number",
    "two sum",
    "hashmap code",
    "hash map code",
    "array code",
    "string code",
    "arraylist code",
    "linkedlist code",

    // ------------------------------
    // Selenium / UI automation
    // ------------------------------

    "selenium code",
    "selenium syntax",
    "selenium script",
    "webdriver code",
    "webdriver syntax",
    "web driver code",
    "xpath",
    "xpath syntax",
    "css selector",
    "css selector syntax",
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

    // ------------------------------
    // TestNG / JUnit / automation
    // ------------------------------

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
    "parameterization",
    "parallel testing",
    "parallel execution",

    // ------------------------------
    // SQL / Database
    // ------------------------------

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

    // ------------------------------
    // REST / API
    // ------------------------------

    "rest api code",
    "rest api syntax",
    "api code",
    "api syntax",
    "write an api",
    "create an api",
    "create rest api",
    "rest controller code",
    "spring controller code",
    "spring boot code",
    "spring boot syntax",
    "endpoint code",
    "endpoint syntax",
    "request mapping code",
    "getmapping",
    "postmapping",
    "putmapping",
    "deletemapping",

    // ------------------------------
    // Git / Shell / Scripts
    // ------------------------------

    "git command",
    "git commands",
    "git syntax",
    "command for",
    "command to",
    "shell script",
    "shell command",
    "bash script",
    "bash command",
    "script for",
    "write a script",
  ];

  if (containsPattern(q, codingPatterns)) {
    return "CODING";
  }

  // ==================================================
  // ARCHITECTURE / SYSTEM DESIGN
  // ==================================================

  const architecturePatterns = [
    "explain your project",
    "explain your current project",
    "explain the project",
    "project explanation",
    "how does your project work",
    "how does your current project work",
    "how does the project work",
    "explain the complete project flow",
    "complete project flow",
    "end to end project flow",
    "project flow",
    "api flow",
    "api request flow",
    "explain the request flow",
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
    "explain the architecture",
    "explain your architecture",
    "explain the project architecture",
    "explain your project architecture",
    "architecture of your project",
    "architecture of the application",
    "request flow",
    "request-response flow",
    "request response flow",
    "application flow",
    "project flow",
    "end to end flow",
    "end-to-end flow",
    "how request flows",
    "how the request flows",
    "how does the request flow",
    "how does a request flow",
    "how the application works",
    "how does the application work",
    "how does your application work",
    "microservice architecture",
    "microservices architecture",
    "microservice flow",
    "microservices flow",
    "service communication",
    "how services communicate",
    "service-to-service communication",
    "sequence diagram",
    "draw the architecture",
    "draw architecture",
    "deployment architecture",
    "deployment flow",
    "data flow",
    "component design",
    "architecture design",
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

  if (containsPattern(q, architecturePatterns)) {
    return "ARCHITECTURE";
  }

  // ==================================================
  // SCENARIO / PRACTICAL
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
    "production issue",
    "production problem",
    "production bug",
    "production incident",
    "production failure",
    "production outage",
    "critical issue",
    "critical bug",
    "critical production",
    "client issue",
    "client problem",
    "customer issue",
    "customer problem",
    "production support",
    "support issue",
    "team conflict",
    "conflict with a team member",
    "conflict with team member",
    "disagreement with",
    "tight deadline",
    "challenging situation",
    "challenging issue",
    "difficult situation",
    "difficult issue",
    "code review",
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
    "what if the",
    "what if your",
    "suppose the",
    "suppose your",
    "imagine the",
    "imagine your",
  ];

  if (containsPattern(q, scenarioPatterns)) {
    return "SCENARIO";
  }

  // ==================================================
  // DEFAULT
  // ==================================================

  return "CONCEPT";
}