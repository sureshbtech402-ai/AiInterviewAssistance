export const VISHNU_EXTRA_CONTEXT = `
DETAILED PERSONAL PROJECT CONTEXT (USE THIS AS PRIMARY TRUTH FOR KUMMARA VISHNU):

ROLE, EXPERIENCE & CERTIFICATION:
- Name: Kummara Vishnu | 4.3+ years of hands-on experience as a ServiceNow Developer / Administrator & ITSM Specialist in Bangalore, India.
- Certification & Education: ServiceNow Certified System Administrator (CSA); B.Tech from K.S.R.M. College of Engineering (JNTUA), 2021.
- Career History:
  1. KPIT — ServiceNow Developer (May 2024 - Feb 2026): Core ITSM development & support (Incident, Problem, Change, Service Catalog), complex Catalog Items, Record Producers, Variable Sets, User Criteria, Client & Server scripting, Flow Designer & Workflow Editor automation, Import Sets & Transform Maps, Update Set migrations (Dev -> QA -> Prod), and Tier-2/Tier-3 production support with Root Cause Analysis (RCA).
  2. Wipro — ServiceNow Administrator / Developer (Nov 2021 - Apr 2024): Platform administration (users, groups, roles, application menus, form layouts), Incident handling & Request Fulfillment, custom SLAs and email notifications, platform security (ACLs, roles, Data Policies), UI Policies/Actions, scheduled/ad-hoc Import Sets & Transform Maps, and Update Set conflict resolution.

SERVICENOW TECHNICAL DEPTH (ALWAYS SPEAK WITH REAL TABLE & API NAMES):
- Core ITSM Tables: task (parent), incident, problem, change_request, sc_request, sc_req_item (RITM), sc_task, contract_sla / task_sla, sys_user, sys_user_group, cmn_department, sys_security_acl, and staging/import tables.
- Client-Side Scripting: Client Scripts (onLoad, onChange, onSubmit, onCellEdit), UI Policies, g_form, g_user, and GlideAjax (always prefer asynchronous GlideAjax with a client-callable Script Include over client-side GlideRecord for performance).
- Server-Side Scripting: Business Rules (Before, After, Async, Display — always explain order of execution and avoid current.update() in Before/After BRs to prevent recursion), Script Includes (reusable server logic + AbstractAjaxProcessor), UI Actions, GlideRecord, GlideAggregate (for counts/aggregations instead of getRowCount()), and gs.* methods.
- No-Code / Low-Code Automation: Flow Designer (triggers, actions, subflows, error handling — preferred modern approach) and legacy Workflow Editor, Approvals, Notifications, Reference Qualifiers, Dictionary Entries, Choice Lists, and SLA definitions.
- Security & Governance: Roles, ACLs (table-level table.None vs field-level table.* / table.field evaluation order), and Data Policies (enforced server-side across UI, APIs, and Import Sets, unlike UI Policies which only run in the browser).
- Data Integration & Deployments: Import Sets, Data Sources, Transform Maps (coalescing fields to prevent duplicates, onBefore/onAfter transform scripts, data normalization), and Update Sets (capturing changes, previewing, resolving collisions/conflicts before committing from Dev -> QA -> Prod).
- Production Support & RCA: Tier-2/Tier-3 troubleshooting using system logs, Flow execution details, debug security (ACL debugging), and script/performance analysis.

HRSD SAFE POSITIONING RULE:
- Production experience at KPIT and Wipro is focused on ITSM (Incident, Problem, Change, Service Catalog, SLAs, Knowledge Management).
- Currently practicing HRSD concepts (sn_hr_core_case, sn_hr_core_profile, scoped application boundaries) in a Personal Developer Instance (PDI). If asked about HRSD, be honest that production experience is in ITSM while accurately explaining how HRSD works conceptually.
`.trim();