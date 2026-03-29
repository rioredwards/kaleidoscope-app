import './style.css';
import './p5-canvas.js';

// ── STATE ──
let selectedEffect = null;
let uploadedImagePath = null;
let currentSourcePath = null;
let currentSourceType = null;
let currentSourceDataURI = null;
let activeSourceId = null;
let currentResultPath = null;
let sourceHistory = [];
let resultHistory = [];
/** Normalized 0–1 point on source image: kaleidoscope sampling center (client P5 only) */
let kaleidoscopeCenter = { x: 0.5, y: 0.5 };

function syncKaleidoscopeMarker() {
  const panel = document.getElementById('sourcePanel');
  const marker = document.getElementById('kaleidoscopeCenterMarker');
  const img = panel?.querySelector('.source-img');
  const cropping = document.getElementById('cropBtn')?.classList.contains('crop-active');
  if (!panel || !marker || !img) {
    panel?.classList.remove('source-panel--kaleidoscope');
    panel?.removeAttribute('title');
    return;
  }
  const k = selectedEffect?.id === 'kaleidoscope';
  panel.classList.toggle('source-panel--kaleidoscope', k && !cropping);
  if (!k || cropping) {
    marker.hidden = true;
    panel.title = '';
    return;
  }
  marker.hidden = false;
  marker.style.left = (kaleidoscopeCenter.x * 100) + '%';
  marker.style.top = (kaleidoscopeCenter.y * 100) + '%';
  panel.title = 'Click to set kaleidoscope sampling center';
}

    /** Filled after /api/effects loads — used by Try demo */
    const effectsById = {};

    // ── INIT ──
    fetch('/api/effects')
      .then(r => r.json())
      .then(data => {
        const grid = document.getElementById('effectGrid');
        data.effects.forEach(effect => {
          effectsById[effect.id] = effect;
          const btn = document.createElement('button');
          btn.className = 'effect-btn';
          btn.textContent = effect.name;
          btn.onclick = (e) => selectEffect(effect, e.currentTarget);
          grid.appendChild(btn);
        });
        loadPresets();
      });

    // ── UPLOAD ──
    const imageInput = document.getElementById('imageInput');
    document.getElementById('uploadBtn').onclick = () => imageInput.click();
    imageInput.onchange = (e) => {
      if (e.target.files[0]) handleImageUpload(e.target.files[0]);
    };

    // Drag-drop on the whole window (only for OS / external file drags — not native <img> drags)
    let dragCounter = 0;
    const dropOverlay = document.getElementById('dropOverlay');

    function isExternalFileDrag(e) {
      const t = e.dataTransfer?.types;
      if (!t) return false;
      const arr = Array.from(t);
      return arr.includes('Files') || arr.includes('application/x-moz-file');
    }

    document.body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (!isExternalFileDrag(e)) return;
      dragCounter++;
      dropOverlay.classList.add('active');
    });
    document.body.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!isExternalFileDrag(e)) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropOverlay.classList.remove('active');
      }
    });
    document.body.addEventListener('dragover', (e) => e.preventDefault());
    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('active');
      if (e.dataTransfer.files[0]) handleImageUpload(e.dataTransfer.files[0]);
    });

    function handleImageUpload(file) {
      if (!file || !file.type.startsWith('image/')) {
        showStatus('Please select an image file', 'error');
        return;
      }

      currentSourceType = 'upload';
      currentSourcePath = null;
      uploadedImagePath = 'uploaded';

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataURI = e.target.result;
        currentSourceDataURI = dataURI;
        updateSourcePreview(dataURI, 'upload');
        addToSourceHistory(dataURI, 'upload');
        if (window.resultP5) window.resultP5.loadSourceImage(dataURI);
      };
      reader.readAsDataURL(file);

      showStatus('Image uploaded', 'success');
    }

    // ── SOURCE PREVIEW ──
    function updateSourcePreview(src, type) {
      const panel = document.getElementById('sourcePanel');
      panel.innerHTML = `
        <span class="panel-label">Source</span>
        <div class="source-view">
          <div class="source-img-wrap">
            <img class="source-img" src="${src}" alt="Source" draggable="false">
            <div class="kaleidoscope-center-marker" id="kaleidoscopeCenterMarker" hidden></div>
          </div>
        </div>
      `;
      if (type === 'generated') {
        const badge = document.createElement('div');
        badge.className = 'source-badge';
        badge.textContent = 'From result';
        panel.appendChild(badge);
      }
      syncKaleidoscopeMarker();
    }

    // ── SOURCE HISTORY ──
    function addToSourceHistory(src, type) {
      if (sourceHistory.some(e => e.src === src)) {
        activeSourceId = sourceHistory.find(e => e.src === src).id;
        renderSourceHistory();
        return;
      }
      const id = Date.now() + Math.random();
      activeSourceId = id;
      sourceHistory.unshift({ id, src, type });
      renderSourceHistory();
    }

    function renderSourceHistory() {
      const strip = document.getElementById('sourceHistoryStrip');
      strip.innerHTML = '<span class="strip-label">Sources</span>';
      sourceHistory.forEach(entry => {
        const thumb = document.createElement('div');
        thumb.className = 'history-thumb' + (entry.id === activeSourceId ? ' active' : '');
        thumb.innerHTML = `<img src="${entry.src}">`;
        thumb.onclick = () => switchSource(entry);
        strip.appendChild(thumb);
      });
    }

    function switchSource(entry) {
      activeSourceId = entry.id;
      updateSourcePreview(entry.src, entry.type);
      if (entry.type === 'upload') {
        currentSourceType = 'upload';
        currentSourcePath = null;
        uploadedImagePath = 'uploaded';
        currentSourceDataURI = entry.src;
      } else {
        currentSourceType = 'generated';
        currentSourcePath = entry.src;
        uploadedImagePath = null;
        currentSourceDataURI = null;
      }
      renderSourceHistory();
      updateSavePresetBtn();
      if (window.resultP5) window.resultP5.loadSourceImage(entry.src);
    }

    // ── RESULT HISTORY ──
    function renderResultHistory() {
      const strip = document.getElementById('resultHistoryStrip');
      strip.innerHTML = '<span class="strip-label">Results</span>';
      resultHistory.forEach(entry => {
        const thumb = document.createElement('div');
        thumb.className = 'history-thumb' + (entry.imagePath === currentResultPath ? ' active' : '');
        thumb.innerHTML = `<img src="${entry.imagePath}">`;
        thumb.title = entry.title;
        thumb.onclick = () => useAsSource(entry.imagePath);
        strip.appendChild(thumb);
      });
    }

    // ── EFFECTS ──
    function populateEffect(effect, overrideParams) {
      selectedEffect = effect;

      if (effect.id === 'kaleidoscope' && overrideParams && overrideParams.centerX != null && overrideParams.centerY != null) {
        const cx = parseFloat(String(overrideParams.centerX).replace(/%$/, ''));
        const cy = parseFloat(String(overrideParams.centerY).replace(/%$/, ''));
        if (!Number.isNaN(cx)) kaleidoscopeCenter.x = Math.min(1, Math.max(0, cx));
        if (!Number.isNaN(cy)) kaleidoscopeCenter.y = Math.min(1, Math.max(0, cy));
      }

      document.querySelectorAll('.effect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === effect.name);
      });

      const popover = document.getElementById('paramPopover');
      popover.innerHTML = '';

      if (Object.keys(effect.params).length > 0) {
        Object.entries(effect.params).forEach(([key, paramDef]) => {
          if (effect.id === 'blend' && (key === 'blendMode' || key === 'opacity')) {
            return;
          }

          const group = document.createElement('div');
          group.className = 'param-group';

          const isSlider = typeof paramDef === 'object' && paramDef.min !== undefined;
          const isSelect = typeof paramDef === 'object' && paramDef.options;
          const defaultVal = isSlider ? paramDef.default : (typeof paramDef === 'object' ? paramDef.default : paramDef);
          const suffix = (isSlider && paramDef.suffix) || '';
          const currentVal = overrideParams && overrideParams[key] !== undefined ? overrideParams[key] : defaultVal;

          const label = document.createElement('label');
          const labelText = document.createElement('span');
          labelText.textContent = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
          label.appendChild(labelText);

          const reprocess = () => {
            const hasSource = uploadedImagePath || (currentSourceType === 'generated' && currentSourcePath);
            if (hasSource && selectedEffect) processImage();
          };

          if (isSelect) {
            const valueSpan = document.createElement('span');
            valueSpan.className = 'param-value';
            valueSpan.textContent = currentVal;
            label.appendChild(valueSpan);

            const select = document.createElement('select');
            select.dataset.param = key;
            select.style.cssText = 'width:100%;padding:5px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#fff;font-size:0.8em;';
            paramDef.options.forEach(opt => {
              const option = document.createElement('option');
              option.value = opt.value !== undefined ? opt.value : opt;
              option.textContent = opt.label !== undefined ? opt.label : opt;
              if (String(option.value) === String(currentVal)) option.selected = true;
              select.appendChild(option);
            });
            select.onchange = () => { valueSpan.textContent = select.value; reprocess(); };

            group.appendChild(label);
            group.appendChild(select);
          } else if (isSlider) {
            const valueSpan = document.createElement('span');
            valueSpan.className = 'param-value';
            valueSpan.textContent = currentVal + suffix;
            label.appendChild(valueSpan);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = paramDef.min;
            input.max = paramDef.max;
            input.step = paramDef.step;
            input.value = parseFloat(currentVal);
            input.dataset.param = key;
            input.dataset.suffix = suffix;
            input.oninput = () => {
              valueSpan.textContent = input.value + suffix;
              clearTimeout(input._paramDebounce);
              input._paramDebounce = setTimeout(reprocess, 200);
            };

            group.appendChild(label);
            group.appendChild(input);
          } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentVal;
            input.dataset.param = key;
            input.onchange = reprocess;

            group.appendChild(label);
            group.appendChild(input);
          }

          popover.appendChild(group);
        });
      }

      updateSavePresetBtn();
      syncKaleidoscopeMarker();
      if (effect.id === 'blend') {
        syncBlendBar(overrideParams);
      }
      syncContextualSubbars();
    }

    function syncContextualSubbars() {
      const blendBar = document.getElementById('blendLayerBar');
      const previewBar = document.getElementById('clientPreviewBar');
      const id = selectedEffect?.id;
      if (blendBar) blendBar.hidden = id !== 'blend';
      if (previewBar) previewBar.hidden = id !== 'sharpen';
    }

    function syncBlendBar(overrideParams) {
      const modeEl = document.getElementById('blendModeBar');
      const opEl = document.getElementById('blendOpacityBar');
      const opVal = document.getElementById('blendOpacityValue');
      if (!modeEl || !opEl) return;
      let mode = 'multiply';
      let op = 0.85;
      if (overrideParams) {
        if (overrideParams.blendMode != null) {
          mode = String(overrideParams.blendMode).replace(/-/g, '_');
        }
        if (overrideParams.opacity != null) {
          const o = parseFloat(String(overrideParams.opacity).replace(/%$/, ''));
          if (!Number.isNaN(o)) op = Math.min(1, Math.max(0, o));
        }
      }
      if (![...modeEl.options].some((o) => o.value === mode)) mode = 'multiply';
      modeEl.value = mode;
      opEl.value = String(op);
      if (opVal) opVal.textContent = String(Math.round(op * 100) / 100);
    }

    function reprocessBlendIfReady() {
      const hasSource = uploadedImagePath || (currentSourceType === 'generated' && currentSourcePath);
      if (hasSource && selectedEffect && selectedEffect.id === 'blend' && window.resultP5 && window.resultP5.hasBlendImage()) {
        processImage();
      }
    }

    function selectEffect(effect, btnEl) {
      const isSameEffect = selectedEffect && selectedEffect.id === effect.id;

      if (!isSameEffect) {
        if (effect.id === 'kaleidoscope' && (!selectedEffect || selectedEffect.id !== 'kaleidoscope')) {
          kaleidoscopeCenter = { x: 0.5, y: 0.5 };
        }
        populateEffect(effect);
      }

      const popover = document.getElementById('paramPopover');
      if (popover.children.length > 0 && btnEl) {
        positionPopover(btnEl);
        popover.classList.add('visible');
      } else {
        popover.classList.remove('visible');
      }

      const hasSource = uploadedImagePath || (currentSourceType === 'generated' && currentSourcePath);
      if (hasSource && selectedEffect) {
        if (selectedEffect.id === 'blend' && window.resultP5 && !window.resultP5.hasBlendImage()) {
          /* wait until user picks a blend layer */
        } else {
          processImage();
        }
      }
    }

    function positionPopover(btnEl) {
      const popover = document.getElementById('paramPopover');
      const rect = btnEl.getBoundingClientRect();
      const popWidth = 240;
      let left = rect.left;
      if (left + popWidth + 8 > window.innerWidth) {
        left = window.innerWidth - popWidth - 8;
      }
      popover.style.top = '52px';
      popover.style.left = left + 'px';
    }

    // Close popover on outside click or Escape
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('paramPopover');
      if (!popover.classList.contains('visible')) return;
      if (!popover.contains(e.target) && !e.target.closest('.effect-btn')) {
        popover.classList.remove('visible');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (cropActive) { cancelCrop(); return; }
        document.getElementById('paramPopover').classList.remove('visible');
      }
    });

    function updateSavePresetBtn() {
      document.getElementById('savePresetBtn').disabled = !selectedEffect;
    }

    function collectParamValues() {
      const params = {};
      document.querySelectorAll('#paramPopover [data-param]').forEach((el) => {
        const suffix = el.dataset.suffix || '';
        params[el.dataset.param] = el.value + suffix;
      });
      if (selectedEffect && selectedEffect.id === 'kaleidoscope') {
        params.centerX = String(kaleidoscopeCenter.x);
        params.centerY = String(kaleidoscopeCenter.y);
      }
      if (selectedEffect && selectedEffect.id === 'blend') {
        const modeEl = document.getElementById('blendModeBar');
        const opEl = document.getElementById('blendOpacityBar');
        if (modeEl) params.blendMode = modeEl.value;
        if (opEl) params.opacity = opEl.value;
      }
      return params;
    }

    function updateBlendStatus() {
      const el = document.getElementById('blendImageStatus');
      if (!el || !window.resultP5) return;
      el.textContent = window.resultP5.hasBlendImage() ? 'Ready' : 'None';
    }

    // ── PROCESS (client-side via p5.js) ──
    function processImage() {
      if (!window.resultP5 || !selectedEffect) return;
      if (selectedEffect.id === 'blend' && !window.resultP5.hasBlendImage()) {
        showStatus('Choose a blend image (Blend layer bar)', 'error');
        return;
      }
      const params = collectParamValues();
      showStatus('<span class="loading-spinner"></span>Processing…', 'loading');
      setTimeout(() => {
        window.resultP5.applyEffect(selectedEffect.id, params);
        document.getElementById('resultPlaceholder').style.display = 'none';
        document.getElementById('resultActions').style.display = 'flex';
        showStatus('', 'clear');
      }, 0);
    }

    let kaleidoscopeCenterDrag = null;
    let kaleidoscopeProcessDragTimer = null;

    function setKaleidoscopeCenterFromClient(img, clientX, clientY) {
      const rect = img.getBoundingClientRect();
      kaleidoscopeCenter = {
        x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      };
      syncKaleidoscopeMarker();
    }

    function scheduleProcessWhileDraggingKaleidoscope() {
      if (kaleidoscopeProcessDragTimer) return;
      kaleidoscopeProcessDragTimer = setTimeout(() => {
        kaleidoscopeProcessDragTimer = null;
        if (selectedEffect?.id === 'kaleidoscope') processImage();
      }, 90);
    }

    document.getElementById('sourcePanel').addEventListener('pointerdown', (e) => {
      if (document.getElementById('cropBtn').classList.contains('crop-active')) return;
      if (selectedEffect?.id !== 'kaleidoscope') return;
      const img = e.target.closest('.source-img');
      if (!img) return;
      e.preventDefault();
      kaleidoscopeCenterDrag = { img, pointerId: e.pointerId };
      try {
        img.setPointerCapture(e.pointerId);
      } catch (_) { /* ignore */ }
      setKaleidoscopeCenterFromClient(img, e.clientX, e.clientY);
      scheduleProcessWhileDraggingKaleidoscope();
    });

    document.addEventListener('pointermove', (e) => {
      if (!kaleidoscopeCenterDrag || e.pointerId !== kaleidoscopeCenterDrag.pointerId) return;
      setKaleidoscopeCenterFromClient(kaleidoscopeCenterDrag.img, e.clientX, e.clientY);
      scheduleProcessWhileDraggingKaleidoscope();
    });

    function endKaleidoscopeCenterDrag(e) {
      if (!kaleidoscopeCenterDrag || e.pointerId !== kaleidoscopeCenterDrag.pointerId) return;
      const { img, pointerId } = kaleidoscopeCenterDrag;
      kaleidoscopeCenterDrag = null;
      clearTimeout(kaleidoscopeProcessDragTimer);
      kaleidoscopeProcessDragTimer = null;
      try {
        img.releasePointerCapture(pointerId);
      } catch (_) { /* ignore */ }
      setKaleidoscopeCenterFromClient(img, e.clientX, e.clientY);
      if (selectedEffect?.id === 'kaleidoscope') processImage();
    }

    document.addEventListener('pointerup', endKaleidoscopeCenterDrag);
    document.addEventListener('pointercancel', endKaleidoscopeCenterDrag);

    async function saveResult() {
      if (!window.resultP5 || !window.resultP5.hasResult()) return;
      showStatus('<span class="loading-spinner"></span>Saving...', 'loading');
      try {
        const dataURL = window.resultP5.getResultAsDataURL();
        const res = await fetch('/api/save-canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: dataURL })
        });
        if (!res.ok) throw new Error('Save failed');
        const data = await res.json();
        const title = selectedEffect ? selectedEffect.name : 'Result';
        addResult(title, data.outputPath);
        showStatus('Saved', 'success');
      } catch (err) {
        showStatus(err.message, 'error');
      }
    }

    function downloadResult() {
      if (!window.resultP5 || !window.resultP5.hasResult()) return;
      const dataURL = window.resultP5.getResultAsDataURL();
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `kaleidoscope_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function addResult(title, imagePath) {
      currentResultPath = imagePath;
      resultHistory.unshift({ title, imagePath });
      renderResultHistory();
    }

    function useAsSource(imagePath) {
      updateSourcePreview(imagePath, 'generated');
      currentSourcePath = imagePath;
      currentSourceType = 'generated';
      uploadedImagePath = null;
      currentSourceDataURI = null;
      document.getElementById('imageInput').value = '';
      addToSourceHistory(imagePath, 'generated');
      renderResultHistory();
      updateSavePresetBtn();
      if (window.resultP5) window.resultP5.loadSourceImage(imagePath);
      showStatus('Using result as source', 'success');
    }

    // ── STATUS ──
    function showStatus(message, type) {
      const status = document.getElementById('status');
      if (type === 'clear' || (!message && type !== 'loading' && type !== 'success' && type !== 'error')) {
        status.innerHTML = '';
        status.className = 'status';
        return;
      }
      status.innerHTML = message;
      status.className = `status ${type}`;
    }

    // ── PRESETS ──
    async function loadPresets() {
      try {
        const response = await fetch('/api/presets');
        const data = await response.json();
        renderPresetChips(data.presets);
      } catch (error) {
        console.error('Error loading presets:', error);
      }
    }

    function renderPresetChips(presets) {
      const container = document.getElementById('presetChips');
      container.innerHTML = '';
      presets.forEach(preset => {
        const chip = document.createElement('button');
        chip.className = 'preset-chip';
        chip.innerHTML = `${preset.name} <button class="delete-btn" title="Delete preset">&times;</button>`;
        chip.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            if (confirm(`Delete preset "${preset.name}"?`)) {
              deletePreset(preset.name);
            }
          } else {
            applyPreset(preset);
          }
        });
        container.appendChild(chip);
      });
    }

    async function applyPreset(preset) {
      const response = await fetch('/api/effects');
      const data = await response.json();
      const effect = data.effects.find(e => e.id === preset.effectId);

      if (effect) {
        populateEffect(effect, preset.params);
        const hasSource = uploadedImagePath || (currentSourceType === 'generated' && currentSourcePath);
        if (hasSource) {
          if (effect.id === 'blend' && window.resultP5 && !window.resultP5.hasBlendImage()) {
            return;
          }
          processImage();
        }
      }
    }

    async function saveCurrentAsPreset() {
      if (!selectedEffect) return;

      const name = prompt('Preset name:');
      if (!name) return;

      const params = collectParamValues();

      try {
        const response = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, effectId: selectedEffect.id, params })
        });

        if (response.ok) {
          loadPresets();
          showStatus(`Preset "${name}" saved`, 'success');
        } else {
          showStatus('Failed to save preset', 'error');
        }
      } catch (error) {
        showStatus(error.message, 'error');
      }
    }

    async function deletePreset(name) {
      try {
        const response = await fetch(`/api/presets/${encodeURIComponent(name)}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          loadPresets();
          showStatus('Preset deleted', 'success');
        } else {
          showStatus('Failed to delete preset', 'error');
        }
      } catch (error) {
        showStatus(error.message, 'error');
      }
    }

    document.getElementById('savePresetBtn').onclick = saveCurrentAsPreset;

    const LS_SHARP = 'kaleidoscope.sharpPixels';
    const LS_MAX = 'kaleidoscope.maxPreviewPx';

    function applyClientPixelOptions() {
      if (!window.resultP5) return Promise.resolve();
      const sharpEl = document.getElementById('sharpPixels');
      const maxEl = document.getElementById('maxPreviewPx');
      if (!sharpEl || !maxEl) return Promise.resolve();
      return window.resultP5.setOptions({
        sharpPixels: sharpEl.checked,
        maxPreviewPx: parseInt(maxEl.value, 10),
      });
    }

    function initClientPixelControls() {
      const sharpEl = document.getElementById('sharpPixels');
      const maxEl = document.getElementById('maxPreviewPx');
      const savedSharp = localStorage.getItem(LS_SHARP);
      if (savedSharp !== null) sharpEl.checked = savedSharp === '1';
      const savedMax = localStorage.getItem(LS_MAX);
      if (savedMax !== null && ['600', '1600', '0'].includes(savedMax)) maxEl.value = savedMax;
      sharpEl.addEventListener('change', async () => {
        localStorage.setItem(LS_SHARP, sharpEl.checked ? '1' : '0');
        try {
          await applyClientPixelOptions();
        } catch (_) { /* reload failed */ }
        const hasSource = uploadedImagePath || (currentSourceType === 'generated' && currentSourcePath);
        if (hasSource && selectedEffect) processImage();
      });
      maxEl.addEventListener('change', async () => {
        localStorage.setItem(LS_MAX, maxEl.value);
        try {
          await applyClientPixelOptions();
        } catch (_) { /* reload failed */ }
        const hasSource = uploadedImagePath || (currentSourceType === 'generated' && currentSourcePath);
        if (hasSource && selectedEffect) processImage();
      });
      void applyClientPixelOptions();
    }

    initClientPixelControls();

    document.getElementById('blendImagePickBtn').onclick = () => document.getElementById('blendImageInput').click();
    document.getElementById('blendImageInput').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          await window.resultP5.loadBlendImage(ev.target.result);
          updateBlendStatus();
          if (selectedEffect && selectedEffect.id === 'blend') processImage();
        } catch (_) {
          showStatus('Could not load blend image', 'error');
        }
      };
      reader.readAsDataURL(f);
      e.target.value = '';
    };
    document.getElementById('blendUseResultBtn').onclick = async () => {
      if (!currentResultPath) {
        showStatus('Pick a result in the strip (or save one) first', 'error');
        return;
      }
      try {
        await window.resultP5.loadBlendImage(currentResultPath);
        updateBlendStatus();
        if (selectedEffect && selectedEffect.id === 'blend') processImage();
      } catch (_) {
        showStatus('Could not load result as blend layer', 'error');
      }
    };
    document.getElementById('blendClearBtn').onclick = () => {
      if (!window.resultP5) return;
      window.resultP5.clearBlendImage();
      updateBlendStatus();
      if (selectedEffect && selectedEffect.id === 'blend') {
        showStatus('Blend layer cleared', 'success');
      }
    };

    updateBlendStatus();

    document.getElementById('blendTryDemoBtn').onclick = async () => {
      if (!window.resultP5) {
        showStatus('Page still loading — try again in a second', 'error');
        return;
      }
      const blendEff = effectsById['blend'];
      const blendBtn = [...document.querySelectorAll('#effectGrid .effect-btn')].find((b) => b.textContent === 'Blend');
      if (!blendEff || !blendBtn) {
        showStatus('No Blend button: stop the server and run npm start again (see “How to use Blend”).', 'error');
        return;
      }

      function solidDataUrl(r, g, b) {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, 128, 128);
        return c.toDataURL('image/png');
      }

      const baseData = solidDataUrl(210, 50, 50);
      const topData = solidDataUrl(50, 100, 230);

      currentSourceType = 'upload';
      currentSourcePath = null;
      uploadedImagePath = 'uploaded';
      currentSourceDataURI = baseData;
      document.getElementById('imageInput').value = '';

      try {
        updateSourcePreview(baseData, 'upload');
        addToSourceHistory(baseData, 'upload');
        await window.resultP5.loadSourceImage(baseData);
        await window.resultP5.loadBlendImage(topData);
      } catch (_) {
        showStatus('Demo failed to load images', 'error');
        return;
      }

      updateBlendStatus();
      updateSavePresetBtn();

      selectEffect(blendEff, blendBtn);

      const modeEl = document.getElementById('blendModeBar');
      const opEl = document.getElementById('blendOpacityBar');
      const opVal = document.getElementById('blendOpacityValue');
      if (modeEl) modeEl.value = 'screen';
      if (opEl) {
        opEl.value = '0.9';
        if (opVal) opVal.textContent = '0.9';
      }
      processImage();
      showStatus('Demo: red base + blue blend layer, Screen mode — tweak Mode/Opacity here', 'success');
    };

    document.getElementById('blendModeBar').addEventListener('change', reprocessBlendIfReady);
    const blendOpBar = document.getElementById('blendOpacityBar');
    const blendOpVal = document.getElementById('blendOpacityValue');
    blendOpBar.addEventListener('input', () => {
      blendOpVal.textContent = String(Math.round(parseFloat(blendOpBar.value) * 100) / 100);
      clearTimeout(blendOpBar._debounce);
      blendOpBar._debounce = setTimeout(reprocessBlendIfReady, 120);
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveResult();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        downloadResult();
      }
    });

    // ── CROP ──
    let cropActive = false;
    let cropSel = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    let cropDrag = null;
    let cropEls = null;

    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
    function clamp01(v) { return clamp(v, 0, 1); }

    function toggleCropMode() {
      if (cropActive) { cancelCrop(); return; }
      if (!document.querySelector('#sourcePanel img')) {
        showStatus('Upload an image first', 'error');
        return;
      }
      enterCropMode();
    }

    function enterCropMode() {
      cropActive = true;
      document.getElementById('cropBtn').classList.add('crop-active');
      cropSel = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

      const panel = document.getElementById('sourcePanel');

      const overlay = document.createElement('div');
      overlay.className = 'crop-overlay';

      const sel = document.createElement('div');
      sel.className = 'crop-selection';
      ['nw', 'ne', 'sw', 'se'].forEach(pos => {
        const h = document.createElement('div');
        h.className = `crop-handle crop-handle-${pos}`;
        h.dataset.handle = pos;
        sel.appendChild(h);
      });
      overlay.appendChild(sel);

      const actions = document.createElement('div');
      actions.className = 'crop-actions-bar';
      actions.innerHTML =
        '<button class="result-action-btn save-btn" onclick="applyCrop()">Apply Crop</button>' +
        '<button class="result-action-btn" onclick="cancelCrop()">Cancel</button>';

      panel.appendChild(overlay);
      panel.appendChild(actions);
      cropEls = { overlay, sel, actions };
      syncCropSelection();
      syncKaleidoscopeMarker();

      overlay.addEventListener('mousedown', onCropDown);
      document.addEventListener('mousemove', onCropMove);
      document.addEventListener('mouseup', onCropUp);
    }

    function exitCropMode() {
      cropActive = false;
      document.getElementById('cropBtn').classList.remove('crop-active');
      if (cropEls) {
        cropEls.overlay.removeEventListener('mousedown', onCropDown);
        document.removeEventListener('mousemove', onCropMove);
        document.removeEventListener('mouseup', onCropUp);
        cropEls.overlay.remove();
        cropEls.actions.remove();
        cropEls = null;
      }
      cropDrag = null;
      syncKaleidoscopeMarker();
    }

    function getCropMapping() {
      const panel = document.getElementById('sourcePanel');
      const img = panel.querySelector('img');
      if (!img) return null;
      const pr = panel.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      return { ox: ir.left - pr.left, oy: ir.top - pr.top, sw: ir.width, sh: ir.height, ix: ir.left, iy: ir.top };
    }

    function syncCropSelection() {
      const m = getCropMapping();
      if (!m || !cropEls) return;
      const s = cropEls.sel;
      s.style.left = (m.ox + cropSel.x * m.sw) + 'px';
      s.style.top = (m.oy + cropSel.y * m.sh) + 'px';
      s.style.width = (cropSel.w * m.sw) + 'px';
      s.style.height = (cropSel.h * m.sh) + 'px';
    }

    function onCropDown(e) {
      e.preventDefault();
      const m = getCropMapping();
      if (!m) return;

      const handle = e.target.dataset?.handle;
      const onSel = !handle && e.target.closest('.crop-selection');

      if (handle) {
        const s = cropSel;
        let fixed;
        if (handle === 'nw') fixed = { x: s.x + s.w, y: s.y + s.h };
        else if (handle === 'ne') fixed = { x: s.x, y: s.y + s.h };
        else if (handle === 'sw') fixed = { x: s.x + s.w, y: s.y };
        else fixed = { x: s.x, y: s.y };
        cropDrag = { type: 'resize', fixed };
      } else if (onSel) {
        cropDrag = { type: 'move', startX: e.clientX, startY: e.clientY, startSel: { ...cropSel } };
      } else {
        const fx = clamp01((e.clientX - m.ix) / m.sw);
        const fy = clamp01((e.clientY - m.iy) / m.sh);
        cropSel = { x: fx, y: fy, w: 0, h: 0 };
        cropDrag = { type: 'draw', anchorX: fx, anchorY: fy };
        syncCropSelection();
      }
    }

    function onCropMove(e) {
      if (!cropDrag) return;
      const m = getCropMapping();
      if (!m) return;

      const fx = clamp01((e.clientX - m.ix) / m.sw);
      const fy = clamp01((e.clientY - m.iy) / m.sh);

      if (cropDrag.type === 'draw') {
        cropSel = {
          x: Math.min(cropDrag.anchorX, fx),
          y: Math.min(cropDrag.anchorY, fy),
          w: Math.max(Math.abs(fx - cropDrag.anchorX), 0.01),
          h: Math.max(Math.abs(fy - cropDrag.anchorY), 0.01),
        };
      } else if (cropDrag.type === 'move') {
        const dx = (e.clientX - cropDrag.startX) / m.sw;
        const dy = (e.clientY - cropDrag.startY) / m.sh;
        const s = cropDrag.startSel;
        cropSel.x = clamp(s.x + dx, 0, 1 - s.w);
        cropSel.y = clamp(s.y + dy, 0, 1 - s.h);
      } else if (cropDrag.type === 'resize') {
        const f = cropDrag.fixed;
        cropSel = {
          x: Math.min(f.x, fx),
          y: Math.min(f.y, fy),
          w: Math.max(Math.abs(fx - f.x), 0.01),
          h: Math.max(Math.abs(fy - f.y), 0.01),
        };
      }
      syncCropSelection();
    }

    function onCropUp() { cropDrag = null; }

    function applyCrop() {
      const img = document.querySelector('#sourcePanel img');
      if (!img || cropSel.w < 0.02 || cropSel.h < 0.02) { cancelCrop(); return; }

      const sx = Math.round(cropSel.x * img.naturalWidth);
      const sy = Math.round(cropSel.y * img.naturalHeight);
      const sw = Math.round(cropSel.w * img.naturalWidth);
      const sh = Math.round(cropSel.h * img.naturalHeight);

      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      const ctx = c.getContext('2d');
      const sharp = document.getElementById('sharpPixels')?.checked;
      ctx.imageSmoothingEnabled = !sharp;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const dataURI = c.toDataURL('image/png');

      exitCropMode();

      currentSourceType = 'upload';
      currentSourcePath = null;
      uploadedImagePath = 'uploaded';
      currentSourceDataURI = dataURI;
      updateSourcePreview(dataURI, 'upload');
      addToSourceHistory(dataURI, 'upload');
      if (window.resultP5) window.resultP5.loadSourceImage(dataURI);
      if (selectedEffect) processImage();
      showStatus('Image cropped', 'success');
    }

function cancelCrop() { exitCropMode(); }

window.toggleCropMode = toggleCropMode;
window.saveResult = saveResult;
window.downloadResult = downloadResult;
window.applyCrop = applyCrop;
window.cancelCrop = cancelCrop;
