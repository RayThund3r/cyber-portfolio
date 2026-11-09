// src/lib/stubs/webllm-missing.ts
//
// Stand-in used ONLY when the optional package "@mlc-ai/web-llm" is not installed (see next.config.ts).
// It stops the build from warning about an unresolved import. The in-browser AI mode then reports itself as
// unavailable and the chat keeps working with its built-in answers. To enable the AI mode:  npm install @mlc-ai/web-llm
export const prebuiltAppConfig = { model_list: [] as { model_id: string }[] };
export async function CreateMLCEngine(): Promise<never> {
  throw new Error('The in-browser AI package is not installed. Run: npm install @mlc-ai/web-llm');
}
export default { prebuiltAppConfig, CreateMLCEngine };
