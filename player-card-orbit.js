// The preview and recorder share one canvas and a five-second cycle.
(() => {
  const duration = 5000;
  function drawOrbit(ctx, card, phase, tint) {
    const {width, height} = ctx.canvas;
    const angle = phase * Math.PI * 2;
    const h = Math.min(height * 0.85, width * 0.89 * card.height / card.width);
    const w = h * card.width / card.height;
    ctx.fillStyle = '#07111d';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2 + 5 * Math.cos(angle));
    ctx.transform(0.98 + 0.02 * Math.cos(angle), 0.025 * Math.sin(angle), -0.018 * Math.cos(angle), 1, 0, 0);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(card, 0, 0, w, h);
    // The foil sits inside the beveled frame and outside the artwork.
    function bevel(inset) {
      const cut = w * 0.052;
      const r = w - inset, b = h - inset;
      ctx.moveTo(inset + cut, inset); ctx.lineTo(r - cut, inset);
      ctx.lineTo(r, inset + cut); ctx.lineTo(r, b - cut);
      ctx.lineTo(r - cut, b); ctx.lineTo(inset + cut, b);
      ctx.lineTo(inset, b - cut); ctx.lineTo(inset, inset + cut); ctx.closePath();
    }
    ctx.beginPath(); bevel(w * 0.009); bevel(w * 0.031); ctx.clip('evenodd');
    const pos = w * (0.5 + 0.85 * Math.sin(angle));
    const shine = ctx.createLinearGradient(pos-w*0.17, h*0.45, pos+w*0.17, h*0.55);
    shine.addColorStop(0,'transparent'); shine.addColorStop(0.5,tint); shine.addColorStop(1,'transparent');
    ctx.fillStyle = shine; ctx.fillRect(0,0,w,h); ctx.restore();
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = drawOrbit; return; }
  const byId = id => document.getElementById(id);
  const dialog = byId('orbitDialog'), canvas = byId('orbitCanvas'), open = byId('openOrbit');
  if (new URLSearchParams(location.search).has('review')) { open.hidden = true; return; }
  const ctx = canvas.getContext('2d'), toggle = byId('toggleOrbit'), save = byId('saveOrbit'), status = byId('orbitStatus');
  const canRecord = typeof MediaRecorder !== 'undefined' && typeof canvas.captureStream === 'function';
  let card, tint, tag, frame, playing, start, elapsed, recorder, generation = 0;
  function render(time) {
    if (!dialog.open) return;
    if (playing) elapsed = time - start;
    drawOrbit(ctx, card, (elapsed % duration) / duration, tint);
    if (recorder?.state === 'recording' && elapsed >= duration) recorder.stop();
    if (playing) frame = requestAnimationFrame(render);
  }
  function play(value) {
    cancelAnimationFrame(frame); playing = value; start = performance.now() - elapsed;
    toggle.textContent = playing ? 'Pause' : 'Play'; render(performance.now());
  }
  open.onclick = async () => {
    const token = ++generation;
    if (!await window.ECMStudioV2.generate() || token !== generation) return;
    card = document.createElement('canvas');
    const src = byId('cardCanvas'); card.width = src.width; card.height = src.height;
    card.getContext('2d').drawImage(src,0,0);
    tag = window.ecmCardStudio.getSelected().tag.replace(/[^a-z0-9_-]/gi,'-');
    tint = {gold:'#ffdf8988',crimson:'#ff9ca688',ice:'#d7efff88'}[byId('card').dataset.finish] || '#d7efff88';
    elapsed = 0; dialog.showModal(); save.disabled = !canRecord; toggle.disabled = false;
    status.textContent = canRecord ? '' : 'This browser supports preview only.';
    play(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  toggle.onclick = () => play(!playing);
  byId('closeOrbit').onclick = () => dialog.close();
  dialog.onclose = () => {
    ++generation; playing = false; cancelAnimationFrame(frame);
    if (recorder?.state === 'recording') recorder.stop();
  };
  window.addEventListener('ecm:card-selected', () => { ++generation; if(dialog.open) dialog.close(); });
  save.onclick = () => {
    const token = generation, chunks = []; let stream, failed = false;
    try {
      elapsed = 0; play(true);
      stream = canvas.captureStream(30);
      const mimeType = ['video/mp4','video/webm;codecs=vp9','video/webm'].find(t => MediaRecorder.isTypeSupported(t));
      const capture = new MediaRecorder(stream, mimeType ? {mimeType,videoBitsPerSecond:5000000} : undefined);
      recorder = capture;
      capture.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      capture.onerror = () => { failed = true; if (generation===token) status.textContent='Recording failed. Try again.'; };
      capture.onstop = () => {
        stream.getTracks().forEach(track=>track.stop()); if (recorder===capture) recorder=null;
        if (generation!==token) return;
        save.disabled=false; toggle.disabled=false;
        if (failed || !chunks.length) { status.textContent='Recording failed. Try again.'; return; }
        const blob=new Blob(chunks,{type:capture.mimeType}), url=URL.createObjectURL(blob), a=document.createElement('a');
        a.href=url; a.download=tag+'-Hover-Orbit.'+(blob.type.includes('mp4')?'mp4':'webm'); a.click();
        setTimeout(()=>URL.revokeObjectURL(url),60000); status.textContent='Clip ready to download.';
      };
      capture.start(); start=performance.now(); toggle.disabled=true; save.disabled=true; status.textContent='Recording five seconds. Keep this tab visible.';
    } catch (error) { stream?.getTracks().forEach(track=>track.stop()); status.textContent='Recording unavailable: '+error.message; }
  };
})();
