/* Inference stays off the UI thread. The caller terminates this worker after 60 seconds. */
let engine;
async function model(){
 if(!engine)engine=(async()=>{
 importScripts('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.min.js');
 ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
 const response=await fetch('https://huggingface.co/edgetools/u2netp/resolve/25dee37ab19c5b6ad64ba6578eba63f1ae07720c/u2netp.onnx',{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('Cutout model unavailable.');const bytes=await response.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!=='309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8')throw Error('Cutout model integrity check failed.');
 return ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 })();return engine;
}
self.onmessage=async event=>{const {id,values}=event.data;try{const net=await model(),outputs=await net.run({[net.inputNames[0]]:new ort.Tensor('float32',new Float32Array(values),[1,3,320,320])});const mask=outputs[net.outputNames[0]].data.slice();for(const tensor of Object.values(outputs))tensor.dispose();self.postMessage({id,mask:mask.buffer},[mask.buffer]);}catch(error){self.postMessage({id,error:error.message});engine=null;}};
