import { enableProdMode, getBackend, ready, setBackend } from "@tensorflow/tfjs";
import { load as loadModel } from "nsfwjs/core";
import { MobileNetV2Model } from "nsfwjs/models/mobilenet_v2";

async function withCpuFallback(run) {
  try {
    return await run();
  } catch (error) {
    if (getBackend() !== "webgl" || !(await setBackend("cpu"))) throw error;
    return run();
  }
}

export async function load() {
  enableProdMode();
  await ready();
  const model = await withCpuFallback(() => loadModel("MobileNetV2", {
    modelDefinitions: [MobileNetV2Model],
  }));
  return { classify: image => withCpuFallback(() => model.classify(image)) };
}
