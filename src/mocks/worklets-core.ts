export const runAsync = (fn: Function) => fn;
export const runOnJS = (fn: Function) => fn;
export const createWorkletRuntime = () => ({});
export default { runAsync, runOnJS, createWorkletRuntime };
