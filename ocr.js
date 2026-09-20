(() => {
  "use strict";

  const TESSERACT_VERSION = "5.1.1";
  const OCR_ASSETS = Object.freeze({
    library: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`,
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`,
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
    langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int"
  });
  const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
  const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const byId = (id) => document.getElementById(id);
  const ui = Object.fromEntries([
    "openOcrButton", "ocrBackdrop", "ocrPanel", "ocrClose", "ocrFile", "ocrFileName", "ocrStatus",
    "ocrProgress", "ocrWorkspace", "ocrImageLink", "ocrImage", "ocrResultArea", "ocrText", "ocrStart",
    "ocrFill", "ocrFillChoices", "ocrConfirmFill", "ocrCancelFill", "ocrCancel", "englishText"
  ].map((id) => [id, byId(id)]));

  let imageUrl = "";
  let selectedFile = null;
  let worker = null;
  let taskId = 0;
  let running = false;
  let recognizedText = "";
  let returnFocus = null;
  let libraryPromise = null;

  function setStatus(message, kind = "") {
    ui.ocrStatus.textContent = message;
    ui.ocrStatus.className = `import-status${kind ? ` is-${kind}` : ""}`;
  }

  function stopWorker() {
    const oldWorker = worker;
    worker = null;
    if (oldWorker) Promise.resolve(oldWorker.terminate()).catch(() => {});
  }

  function invalidateTask() {
    taskId += 1;
    running = false;
    stopWorker();
    ui.ocrProgress.hidden = true;
    ui.ocrStart.disabled = !selectedFile;
  }

  function releaseImage() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = "";
    selectedFile = null;
    ui.ocrImage.removeAttribute("src");
    ui.ocrImageLink.removeAttribute("href");
  }

  function resetResult() {
    recognizedText = "";
    ui.ocrText.value = "";
    ui.ocrResultArea.hidden = true;
    ui.ocrFill.hidden = true;
    ui.ocrFillChoices.hidden = true;
  }

  function openPanel(event) {
    returnFocus = event?.currentTarget || ui.openOcrButton;
    ui.ocrPanel.hidden = false;
    ui.ocrBackdrop.hidden = false;
    document.body.classList.add("panel-open");
    ui.ocrFile.focus();
  }

  function closePanel() {
    invalidateTask();
    releaseImage();
    resetResult();
    ui.ocrFile.value = "";
    ui.ocrFileName.textContent = "支持 PNG、JPEG、WebP，最大 15 MB";
    setStatus("");
    ui.ocrWorkspace.hidden = true;
    ui.ocrPanel.hidden = true;
    ui.ocrBackdrop.hidden = true;
    document.body.classList.remove("panel-open");
    returnFocus?.focus();
  }

  function canDecode(url) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => probe.naturalWidth && probe.naturalHeight ? resolve() : reject(new Error());
      probe.onerror = reject;
      probe.src = url;
    });
  }

  async function chooseImage() {
    const file = ui.ocrFile.files?.[0];
    if (!file) return;
    invalidateTask();
    releaseImage();
    resetResult();
    ui.ocrWorkspace.hidden = true;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setStatus("不支持这种图片格式。请选择 PNG、JPEG 或 WebP 图片。", "error");
      ui.ocrFile.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setStatus("图片超过 15 MB。请压缩或裁剪后重新选择。", "error");
      ui.ocrFile.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      await canDecode(url);
    } catch {
      URL.revokeObjectURL(url);
      setStatus("图片无法加载或已损坏，请重新选择一张可正常打开的图片。", "error");
      ui.ocrFile.value = "";
      return;
    }
    imageUrl = url;
    selectedFile = file;
    ui.ocrImage.src = url;
    ui.ocrImageLink.href = url;
    ui.ocrFileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    ui.ocrWorkspace.hidden = false;
    ui.ocrStart.disabled = false;
    setStatus("图片已就绪。点击“开始识别”；首次使用需要下载识别资源。");
  }

  function loadTesseract() {
    if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
    if (libraryPromise) return libraryPromise;
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = OCR_ASSETS.library;
      script.crossOrigin = "anonymous";
      script.onload = () => globalThis.Tesseract?.createWorker ? resolve(globalThis.Tesseract) : reject(new Error("OCR 程序加载不完整"));
      script.onerror = () => reject(new Error("OCR 程序下载失败"));
      document.head.append(script);
    }).catch((error) => {
      libraryPromise = null;
      throw error;
    });
    return libraryPromise;
  }

  function progressMessage(status) {
    const labels = { "loading tesseract core": "正在下载识别核心", "initializing tesseract": "正在初始化识别器", "loading language traineddata": "正在下载英文模型", "initializing api": "正在准备英文模型", "recognizing text": "正在识别英文" };
    return labels[status] || "正在准备识别";
  }

  async function recognize() {
    if (!selectedFile || running) return;
    if (ui.ocrText.value !== recognizedText && ui.ocrText.value.trim() && !window.confirm("重新识别会替换你手动修改的预览文字，确定继续吗？")) return;
    const currentTask = ++taskId;
    running = true;
    resetResult();
    ui.ocrStart.disabled = true;
    ui.ocrProgress.hidden = false;
    ui.ocrProgress.value = 0;
    setStatus("正在加载识别资源，请保持网络连接。");
    let localWorker;
    try {
      const Tesseract = await loadTesseract();
      if (currentTask !== taskId) return;
      localWorker = await Tesseract.createWorker("eng", 1, {
        workerPath: OCR_ASSETS.workerPath,
        corePath: OCR_ASSETS.corePath,
        langPath: OCR_ASSETS.langPath,
        logger(message) {
          if (currentTask !== taskId || !running) return;
          const percentage = Math.round((message.progress || 0) * 100);
          ui.ocrProgress.value = percentage;
          setStatus(`${progressMessage(message.status)}${percentage ? ` · ${percentage}%` : ""}`);
        }
      });
      if (currentTask !== taskId) { await localWorker.terminate(); return; }
      worker = localWorker;
      const result = await localWorker.recognize(selectedFile);
      if (currentTask !== taskId) return;
      const text = String(result?.data?.text || "").trim();
      if (!text) {
        setStatus("没有识别到英文文字。请重新选择更清晰、方向正确的图片后重试。", "error");
        return;
      }
      recognizedText = text;
      ui.ocrText.value = text;
      ui.ocrResultArea.hidden = false;
      ui.ocrFill.hidden = false;
      setStatus("识别完成。请先对照图片检查并修改结果。", "success");
      ui.ocrText.focus();
    } catch (error) {
      if (currentTask === taskId) setStatus(`识别失败：${error?.message || "无法启动识别器"}。请检查网络后重试。`, "error");
    } finally {
      if (worker === localWorker) worker = null;
      if (localWorker) await Promise.resolve(localWorker.terminate()).catch(() => {});
      if (currentTask === taskId) {
        running = false;
        ui.ocrProgress.hidden = true;
        ui.ocrStart.disabled = !selectedFile;
        ui.ocrStart.textContent = recognizedText ? "重新识别" : "开始识别";
      }
    }
  }

  function writeText(mode) {
    const text = ui.ocrText.value.trim();
    if (!text) {
      setStatus("识别结果为空，不能覆盖原文。请重新识别或补充文字。", "error");
      return;
    }
    ui.englishText.value = mode === "append" && ui.englishText.value.trim()
      ? `${ui.englishText.value.replace(/\s+$/, "")}\n\n${text}`
      : text;
    ui.englishText.dispatchEvent(new Event("input", { bubbles: true }));
    closePanel();
    ui.englishText.focus();
  }

  function requestFill() {
    if (!ui.ocrText.value.trim()) { setStatus("识别结果为空，不能覆盖原文。", "error"); return; }
    if (!ui.englishText.value.trim()) { writeText("replace"); return; }
    ui.ocrFillChoices.hidden = false;
    ui.ocrFillChoices.scrollIntoView({ block: "nearest" });
  }

  ui.openOcrButton.addEventListener("click", openPanel);
  ui.ocrFile.addEventListener("change", chooseImage);
  ui.ocrStart.addEventListener("click", recognize);
  ui.ocrFill.addEventListener("click", requestFill);
  ui.ocrConfirmFill.addEventListener("click", () => {
    const mode = document.querySelector('input[name="ocrFillMode"]:checked')?.value;
    if (!mode) { setStatus("请选择“替换原文”或“追加到末尾”。", "error"); return; }
    writeText(mode);
  });
  ui.ocrCancelFill.addEventListener("click", () => { ui.ocrFillChoices.hidden = true; });
  [ui.ocrClose, ui.ocrCancel, ui.ocrBackdrop].forEach((element) => element.addEventListener("click", closePanel));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !ui.ocrPanel.hidden) closePanel(); });

  globalThis.EnglishReaderOcr = { OCR_ASSETS, MAX_IMAGE_BYTES };
})();
