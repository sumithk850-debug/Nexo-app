# OpenRouter Free Models (Verified Aug 13, 2026)

Based on live search and browsing of `openrouter.ai/models?q=free`:

## High-Performance / Agentic Free Models
- **nvidia/nemotron-3-ultra-550b-a55b:free** (550B MoE, 55B active, 1M context) - Best for reasoning/orchestration.
- **poolside/laguna-s-2.1:free** (118B total, 8B active, 262K context) - Strong coding agent model.
- **nvidia/nemotron-3-super-120b-a12b:free** (120B MoE, 12B active, 1M context) - High throughput, multi-agent.
- **cohere/north-mini-code:free** (30B MoE, 3B active, 256K context) - Optimized for coding and terminal tasks.
- **google/gemma-4-26b-a4b-it:free** (25.2B MoE, 3.8B active, 262K context) - Google DeepMind model, multimodal.

## Lightweight / Fast Free Models
- **liquid/lfm-2.5-2.6b:free** (2.6B, fast everyday assistant).
- **nvidia/nemotron-3.5-lightning:free** (Fast reasoning).
- **nvidia/nemotron-3-nano-30b-a3b:free** (30B MoE, compute efficient).
- **openai/gpt-oss-20b:free** (OpenAI open-source model).

## Strategy for Nexo App
- **Nexio 1.1:** `liquid/lfm-2.5-2.6b:free` (Primary), `nvidia/nemotron-3.5-lightning:free` (Fallback).
- **Spadec 3.5:** `google/gemma-4-26b-a4b-it:free` (Primary), `openai/gpt-oss-20b:free` (Fallback).
- **Galex 4.0:** `nvidia/nemotron-3-super-120b-a12b:free` (Primary), `nvidia/nemotron-3-ultra-550b-a55b:free` (Fallback).
- **Brainex 10.8:** `nvidia/nemotron-3-ultra-550b-a55b:free` (Primary), `nvidia/nemotron-3-super-120b-a12b:free` (Fallback).
- **Craft V3 (Fallback):** `poolside/laguna-s-2.1:free` (Primary Fallback), `cohere/north-mini-code:free` (Secondary Fallback).
