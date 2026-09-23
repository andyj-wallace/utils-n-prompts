# Solo System Design -- Prompt Playbook

This playbook breaks down the process of designing and building a system
solo into focused prompts.\
Each step has a reusable prompt template you can copy-paste directly
into ChatGPT (or any LLM).

------------------------------------------------------------------------

## **Step 1 -- Define the Core Problem**

**Prompt Template:**

    Help me define the core problem my system will solve in one or two sentences. 
    Ask me clarifying questions about the pain point, the primary user, 
    and what the absolute minimum useful version would look like.

------------------------------------------------------------------------

## **Step 2 -- Scope Ruthlessly (MVP Thinking)**

**Prompt Template:**

    Take my problem statement and strip it down to the smallest possible MVP. 
    List which features are essential, which are optional, 
    and which are distractions I should cut for now.

------------------------------------------------------------------------

## **Step 3 -- Model the System**

**Prompt Template:**

    Based on my MVP, help me design the data model (entities, relationships) 
    and the main system flows. Show me diagrams or bullet-pointed flows 
    for how data moves from user to backend to database.

------------------------------------------------------------------------

## **Step 4 -- Pick the Baseline Stack**

**Prompt Template:**

    Given the MVP requirements and that I’m building solo, 
    recommend a boring but solid tech stack (frontend, backend, database, hosting). 
    Justify each choice in terms of speed to build, maintainability, and learning curve.

------------------------------------------------------------------------

## **Step 5 -- Lay the Foundations**

**Prompt Template:**

    Give me a checklist for setting up the project properly from day one 
    (Git, file structure, CI/CD basics, documentation). 
    Keep it lightweight but professional.

------------------------------------------------------------------------

## **Step 6 -- Iterative Build Strategy**

**Prompt Template:**

    Help me plan the build order. Which feature should I build first 
    to get the happy path working end-to-end, and what should follow? 
    Outline the milestones in sequence.

------------------------------------------------------------------------

## **Step 7 -- Think Ahead Without Overbuilding**

**Prompt Template:**

    Based on my system, show me what potential bottlenecks I should keep an eye on. 
    Suggest simple guardrails to avoid painting myself into a corner 
    without over-engineering.

------------------------------------------------------------------------

## **Final Step -- Brutal Summary**

**Prompt Template:**

    Summarize the plan in a single execution roadmap: 
    problem → MVP → data model → stack → setup → build order → future guardrails.

------------------------------------------------------------------------

### ⚡ How to Use This Playbook

1.  Copy the prompt for the step you're working on.\
2.  Paste it into ChatGPT.\
3.  Answer clarifying questions and lock in your decision before moving
    to the next step.

This ensures clarity, prevents scope creep, and gives you a reusable
execution framework.
