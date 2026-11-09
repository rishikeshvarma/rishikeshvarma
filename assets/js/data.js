/* =====================================================================
   Portfolio content. Edit here: the page renders projects, builds and
   skills from these lists.
   ===================================================================== */
window.SITE = {
  rotator: [
    "agents that remember.",
    "LLMs that run locally.",
    "evals that catch the bugs.",
    "firewalls for AI agents.",
    "voices that speak Telugu.",
  ],

  projects: [
    {
      id: "mcp-shield",
      title: "MCP-Shield",
      kicker: "Final-year project · 4-member team · in progress",
      tagline:
        "A semantic firewall for AI agents. It sits between MCP hosts like Claude Desktop or Cursor and their tool servers, and stops prompt-injected tool traffic before it reaches the agent.",
      metrics: [
        { v: "<1 ms", l: "structural policy gate" },
        { v: "86M", l: "mDeBERTa-v3 classifier on ONNX" },
        { v: "<50 ms", l: "p95 latency target (GPU)" },
        { v: "52.8% → <10%", l: "attack-success target" },
      ],
      note: "Design phase: latency and attack-success figures are targets, not results.",
      tech: ["Python", "MCP", "JSON-RPC 2.0", "ONNX Runtime", "mDeBERTa-v3", "llama.cpp", "Qwen3-8B", "FastAPI", "SQLite"],
      bullets: [
        "A local inline proxy (PyPI package mcp-shield-llm) that inspects both directions of JSON-RPC 2.0 traffic for indirect prompt injection, tool-description poisoning and command injection.",
        "A 3-tier hot path: structural policy gate under 1 ms, a cache and signature layer at 1–5 ms, then a fine-tuned 86M mDeBERTa-v3 encoder on ONNX Runtime, chosen over a generative model whose per-call review takes seconds.",
        "One engine per user: thin per-server front-ends share a single engine holding the model, cache, taint store and SQLite event log, so the model loads once per machine; mcp-shield doctor picks the ONNX execution provider per OS.",
        "Cross-server taint tracking with winnowed fingerprints that guarantee detection of any reused 32-character run, SHA-256 capability pinning with first-contact quarantine, and Spotlighting markers on forwarded tool text.",
        "An optional explainer (Qwen3-8B, Q4_K_M) on a pinned llama.cpp server with JSON-schema-constrained output.",
        "Goal: cut attack success from a 52.8% baseline to under 10% on held-out AgentDojo and MCPSecBench suites while keeping at least 95% task utility, benchmarked against Prompt Guard 2.",
      ],
      links: [{ label: "Code on GitHub", url: "https://github.com/rishikeshvarma/MCP-Shield" }],
    },
    {
      id: "appcompiler",
      title: "AppCompiler",
      kicker: "Self-healing LLM compiler + eval harness",
      tagline:
        "Compiles a plain-English request into a UI layout, REST endpoints and a PostgreSQL schema, then proves the three agree with an eval harness and a CI regression gate.",
      metrics: [
        { v: "4-stage", l: "intent → design → schema → repair" },
        { v: "52", l: "regression tests in CI" },
        { v: "4", l: "bugs its own harness caught" },
        { v: "Audit", l: "immutable logs per run" },
      ],
      tech: ["Python", "Gemini API", "FastAPI", "Pydantic", "Pytest", "GitHub Actions"],
      bullets: [
        "A 4-stage LLM pipeline (Intent, Design, Schema, Validate/Repair) that turns a plain-English request into UI layout JSON, REST endpoint specs and a PostgreSQL schema with immutable audit logs.",
        "An eval harness with deterministic UI–API–DB consistency checks, an LLM-as-judge limited to what code cannot decide, step-level traces (latency, tokens, error class) and a schema-versioned dataset.",
        "A baseline regression gate in GitHub Actions (52 tests). The harness exposed 4 bugs in the compiler, including a validator that silently skipped its main check by reading the wrong JSON path; each one is now locked in with a regression test.",
      ],
      links: [
        { label: "Code on GitHub", url: "https://github.com/rishikeshvarma/APP_Compiler" },
        { label: "Live demo", url: "https://app-compiler-six.vercel.app" },
      ],
    },
    {
      id: "dume",
      title: "DUM-E",
      kicker: "Local personal AI agent · DUM-E Labs · in progress",
      tagline:
        "A privacy-first personal AI agent that runs entirely on my own GPU, with tool calling, web search, and a memory that knows the difference between facts about me and facts from the internet.",
      metrics: [
        { v: "27B", l: "Qwen model on a 16 GB GPU" },
        { v: "225K", l: "token context window" },
        { v: "4-way", l: "intent router" },
        { v: "0", l: "cloud calls needed" },
      ],
      tech: ["Python", "llama.cpp", "Qwen3.8 27B (GSQ-RCO)", "Kubernetes", "SQLite", "Markdown vault", "Git"],
      bullets: [
        "Runs fully on local hardware (RTX 5060 Ti, 16 GB VRAM) with tool calling, web search and persistent memory; the core engine is verified end to end, including recovery after a power-cut reboot.",
        "Serves Qwen3.8 27B through llama.cpp with GSQ-RCO quantization and a 225K-token context window, and runs two agents as Kubernetes pods sized to fit one consumer GPU.",
        "A dual memory layer (SQLite + a Markdown knowledge vault) and a 4-way intent router (Personal / Search / Mixed / Meta) that chooses between memory and live web search, so public web data never gets stored as personal facts.",
        "Diagnosed a multi-turn memory failure caused by letting the LLM decide when to write memory; rolled back to the last verified build with Git and redesigned writes around deterministic, gated triggers.",
        "Built with AI coding agents and reviewed critically, catching generated code that hard-coded answers for specific test inputs instead of general logic.",
      ],
      links: [{ label: "DUM-E Labs", url: "https://dummie-labs.github.io/.github/" }],
    },
    {
      id: "phishninja",
      title: "PhishNinja",
      kicker: "Agentic AI security · patent application published",
      tagline:
        "A multi-agent phishing defence that inspects individual chat messages in real time and explains every verdict it makes.",
      metrics: [
        { v: "99.7%", l: "precision over 1,500 trials" },
        { v: "640 ms", l: "explanation budget" },
        { v: "384-d", l: "embeddings in pgvector" },
        { v: "Patent", l: "application published" },
      ],
      tech: ["Python", "Supabase", "pgvector", "Groq", "Llama 3.1 8B", "n8n", "Raspberry Pi"],
      bullets: [
        "A custom multi-agent system with an intent-classifier routing core that isolates live DOM mutations, so each message is analysed on its own instead of being diluted in a whole page.",
        "384-dimensional all-MiniLM-L6-v2 embeddings in Supabase pgvector (PostgreSQL) for semantic threat matching.",
        "Groq LPU inference (Llama 3.1 8B Instant) for real-time explainable-AI justifications within a 640 ms budget, keeping edge queues under 1% of cloud API rate limits.",
        "An out-of-band alerting ring that fires webhooks to a Raspberry Pi cluster running n8n for mobile alerts; 99.7% precision across 1,500 validation trials.",
      ],
      links: [
        { label: "Code on GitHub", url: "https://github.com/rishikeshvarma/PhishNinja-V2" },
        { label: "Live demo", url: "https://phishninja-v2.vercel.app" },
      ],
    },
    {
      id: "fastspeech",
      title: "FastSpeech 2 · English + Telugu",
      kicker: "Speech · text-to-speech",
      tagline:
        "Two FastSpeech 2 text-to-speech models, one for Indian-accented English and one for Telugu, with a technical report on data selection, loss curves and the variance adaptor.",
      metrics: [
        { v: "2", l: "TTS models trained" },
        { v: "Svarah", l: "Indian-accented English data" },
        { v: "IndicTTS", l: "Telugu data" },
        { v: "Report", l: "technical write-up included" },
      ],
      tech: ["Python", "PyTorch", "FastSpeech 2", "Hugging Face Datasets"],
      bullets: [
        "Adapted the ming024/FastSpeech2 PyTorch implementation of FastSpeech 2 (Ren et al., 2021) and trained two separate models.",
        "English: Indian-accented speech from the Svarah dataset. Telugu: the IndicTTS Telugu dataset.",
        "The technical report covers data selection, loss-curve analysis, per-sentence observations and a variance-adaptor analysis.",
      ],
      links: [{ label: "Code on GitHub", url: "https://github.com/rishikeshvarma/fastspeech-2-TTS-Eng-Tel" }],
    },
  ],

  builds: [
    { name: "Sanjivani", lang: "Python", url: "https://github.com/rishikeshvarma/Sanjivani",
      text: "Bring dead side projects back to life, or bury them with honour, with three AI teammates in your team chat." },
    { name: "ContextIQ", lang: "Python", url: "https://github.com/rishikeshvarma/ContextIQ",
      text: "FastAPI backend that pulls a team's Discord into Supabase and uses Gemini to extract tasks, decisions and deadlines." },
    { name: "pocket-ledger", lang: "Python", url: "https://github.com/rishikeshvarma/pocket-ledger",
      text: "A tiny command-line expense tracker: one command per expense, one JSON file, no accounts." },
    { name: "Vichaar", lang: "TypeScript", url: "https://github.com/rishikeshvarma/Vichaar",
      text: "A fast student portal for KMIT: attendance and academics in React + Vite." },
    { name: "Smart Document Summarizer", lang: "Python", url: "https://github.com/rishikeshvarma/Document_summarizer",
      text: "Summarises PDFs, Word files and shared links with T5, BART and FLAN-T5." },
    { name: "Creative Ad Copilot", lang: "TypeScript", url: "https://github.com/rishikeshvarma/CopAD",
      text: "A full-stack ad-copy assistant built with React, Vite, Express and TypeScript." },
    { name: "AgentX starter kit", lang: "JavaScript", url: "https://github.com/rishikeshvarma/ReAgent-X",
      text: "Template for memory-powered AI chatbots, with personality and memory set from one config file." },
    { name: "chai-bot", lang: "JavaScript", url: "https://github.com/rishikeshvarma/chai-bot",
      text: "A Discord bot for our hostel server: chai reminders and quotes." },
  ],

  skills: {
    "Languages": ["Python", "Java", "SQL", "JavaScript", "TypeScript"],
    "Agents & LLMs": ["Tool calling", "MCP", "A2A", "Intent routing", "Agent memory", "RAG", "Prompt engineering", "Context management", "Claude API", "Gemini API", "Groq"],
    "ML & serving": ["PyTorch", "Transformers", "llama.cpp", "vLLM", "Ollama", "ONNX Runtime", "Quantization", "Embeddings", "FastSpeech 2"],
    "Evals & testing": ["Eval harnesses", "LLM-as-judge", "Tracing", "Regression tests", "Pytest", "Pydantic"],
    "Backend & DevOps": ["FastAPI", "PostgreSQL", "pgvector", "SQLite", "Supabase", "Docker", "Kubernetes", "GitHub Actions"],
    "Tools": ["Git", "Linux", "Claude Code", "Antigravity", "n8n"],
  },
};
