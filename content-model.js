(function exposeContentModel(globalScope) {
  const MAX_SCENES = 5;

  function text(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeContent(value) {
    const content = value && typeof value === "object" ? value : {};
    return {
      title: text(content.title),
      english: text(content.english),
      chineseTitle: text(content.chineseTitle),
      chinese: text(content.chinese),
    };
  }

  function normalizeWord(word) {
    return word.toLocaleLowerCase("en-US");
  }

  function normalizeStoredDraft(value) {
    const draft = value && typeof value === "object" ? value : {};
    const original = draft.original && typeof draft.original === "object"
      ? normalizeContent(draft.original)
      : normalizeContent({
        title: draft.title,
        english: draft.english,
        chineseTitle: draft.chineseTitle,
        chinese: draft.chinese,
      });

    return {
      ...draft,
      title: text(draft.title),
      original,
      scenes: Array.isArray(draft.scenes)
        ? draft.scenes.slice(0, MAX_SCENES).map(normalizeContent)
          .filter((scene) => scene.title.trim() && scene.english.trim())
        : [],
      vocabulary: draft.vocabulary && typeof draft.vocabulary === "object" && !Array.isArray(draft.vocabulary)
        ? draft.vocabulary
        : {},
    };
  }

  function parseImport(raw) {
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("JSON 格式无效，请检查引号、逗号和括号是否完整。");
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("导入内容必须是一个 JSON 对象。");
    }
    if (typeof value.articleTitle !== "string" || !value.articleTitle.trim()) {
      throw new Error("articleTitle 必须是非空文本。");
    }
    if (!value.original || typeof value.original !== "object" || Array.isArray(value.original)) {
      throw new Error("original 必须是一个对象。");
    }
    if (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > MAX_SCENES) {
      throw new Error("scenes 必须包含 1～5 篇场景文章。");
    }

    const validateContent = (content, label) => {
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        throw new Error(`${label}必须是一个对象。`);
      }
      if (typeof content.title !== "string" || !content.title.trim()) {
        throw new Error(`${label}的 title 必须是非空文本。`);
      }
      if (typeof content.english !== "string" || !content.english.trim()) {
        throw new Error(`${label}的 english 必须是非空文本。`);
      }
      for (const field of ["chineseTitle", "chinese"]) {
        if (content[field] !== undefined && typeof content[field] !== "string") {
          throw new Error(`${label}的 ${field} 必须是文本或留空。`);
        }
      }
      return normalizeContent(content);
    };

    return {
      articleTitle: value.articleTitle.trim(),
      original: validateContent(value.original, "original "),
      scenes: value.scenes.map((scene, index) => validateContent(scene, `场景 ${index + 1} `)),
    };
  }

  const api = { MAX_SCENES, normalizeStoredDraft, normalizeWord, parseImport };
  globalScope.ContentModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
