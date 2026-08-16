# OpenRouter free coding fallback research

Research date: 2026-08-16.

Official OpenRouter pages reviewed:

- https://openrouter.ai/collections/free-models
- https://openrouter.ai/collections/programming
- https://openrouter.ai/models
- https://openrouter.ai/openrouter/free

The official free-model collection currently describes `poolside/laguna-s-2.1:free` as a coding-agent model for software engineering and agentic coding, with published Terminal-Bench 2.1 and DeepSWE scores in the collection. The same page also lists `cohere/north-mini-code:free`, `openai/gpt-oss-20b:free`, and `google/gemma-4-26b-a4b-it:free` as free options. OpenRouter's free router is dynamic and can choose among available free models, so a fixed coding slug is preferable for predictable Craft V4 routing.

Decision: use `poolside/laguna-s-2.1:free` as Craft V4's primary OpenRouter fallback, then `cohere/north-mini-code:free`, `openai/gpt-oss-20b:free`, and `google/gemma-4-26b-a4b-it:free` as free fallbacks. Availability and rate limits can change, so runtime fallback handling remains enabled.
