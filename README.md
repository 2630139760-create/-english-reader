# 英语语境阅读器

纯浏览器、本地存储的英语阅读与词汇复习工具。文章、原文/场景、词汇收藏、文章语境资料、复习进度与备份都只保存在当前设备，不连接 API、服务器或云数据库。

## 从图片识别英文

编辑页的“从图片识别英文”支持单张 PNG、JPEG 或 WebP 图片（最大 15 MB）。图片会先显示在识别面板中，识别完成后必须对照图片检查并编辑文字，再明确填入英文原文；取消、关闭或仅完成识别都不会更改文章。原文非空时还需选择替换或追加。

OCR 在浏览器内通过固定版本的 [Tesseract.js 5.1.1](https://github.com/naptha/tesseract.js/tree/v5.1.1) 执行，图片不会上传到识别服务。为兼容 GitHub Pages 的仓库子路径，页面按 HTTPS 绝对地址从 jsDelivr 加载固定版本的 Tesseract.js、Worker、`tesseract.js-core` 5.1.1 和 `@tesseract.js-data/eng` 1.0.0 英文模型。首次识别及浏览器缓存失效后需要联网下载这些资源；本项目目前不承诺离线识别。

## 场景与词汇批量导入

在编辑页展开“从 ChatGPT 导入场景与词汇资料”，粘贴 JSON 后先点“验证并预览”。预览会显示目标学习单元、场景数、可补充词汇、未匹配项、待确认项和已有资料冲突。默认选择“更新当前学习单元”，避免产生重复文章；也可明确选择新建。

- `vocabulary` **可以缺省**，因此旧内容 JSON 仍可导入。
- 一旦提供 `vocabulary`，它必须是数组，且每一项及两个例句都要完整通过类型校验；验证失败不会写入任何数据。
- 默认只补充目标文章已经收藏、且 `type` 与去除首尾空白/忽略大小写后的 `term` 都匹配的词汇。不会合并词形变化、近义词或不同短语；未匹配项只在预览中列出，不会自动收藏。
- 空白资料会被补齐。已有非空资料的冲突会列在预览中，只有勾选覆盖选项才更新。
- 释义、词性/类型、用法、来源句、例句和待确认状态按文章关联保存；同一词汇在不同文章中的语境资料互不覆盖。全局词卡会标明来源文章。
- 重复导入会更新同一文章关联，不重复创建词汇、文章关系或例句。

### 完整可用示例

```json
{
  "articleTitle": "Airport English",
  "original": {
    "title": "At the Airport",
    "english": "I check in at the desk.",
    "chineseTitle": "在机场",
    "chinese": "我在柜台办理登机手续。"
  },
  "scenes": [
    {
      "title": "A New Trip",
      "english": "We check in early.",
      "chineseTitle": "新的旅程",
      "chinese": "我们提早办理登机手续。"
    }
  ],
  "vocabulary": [
    {
      "term": "check in",
      "type": "phrase",
      "meaning": "办理登机手续",
      "partOfSpeech": "动词短语",
      "phonetic": "",
      "usageNote": "常与 at 搭配说明办理手续的地点。",
      "sourceSentence": "I check in at the desk.",
      "examples": [
        {
          "english": "We check in before noon.",
          "chinese": "我们在中午前办理登机手续。"
        },
        {
          "english": "Please check in at the front desk.",
          "chinese": "请在前台办理登记。"
        }
      ],
      "needsConfirmation": false,
      "confirmationNote": ""
    }
  ]
}
```

“复制给 GPT”提供两个工作步骤：

1. **生成翻译与场景**：提示词自动附带当前标题、逐字保留的完整原文、本篇全部收藏词汇及其真实来源、场景数量、难度和长度，并要求返回上面的完整学习内容格式。
2. **补充词汇资料**：默认勾选缺少中文释义、用法注释或两个完整双语例句的收藏项，也可重新勾选已有资料的项目。提示词只要求返回当前所选词汇，不生成文章或场景。

两个提示词都包含准确字段、完整结构示例和统一的单个 `json` Markdown 代码块输出规则，“额外要求”始终选填。

### 独立词汇补充格式

词汇补充导入与完整学习内容、数据备份明确区分，顶层固定使用 `task` 和 `schemaVersion`：

```json
{
  "task": "vocabularySupplement",
  "schemaVersion": 1,
  "articleTitle": "Airport English",
  "vocabulary": [
    {
      "term": "check in",
      "type": "phrase",
      "meaning": "办理登机手续",
      "partOfSpeech": "动词短语",
      "phonetic": "",
      "usageNote": "常与 at 搭配说明地点。",
      "sourceSentence": "I check in at the desk.",
      "examples": [
        { "english": "We check in early.", "chinese": "我们提早办理登机手续。" },
        { "english": "Please check in here.", "chinese": "请在这里办理登记。" }
      ],
      "needsConfirmation": false,
      "confirmationNote": ""
    }
  ]
}
```

导入目标始终是用户当前选择的学习单元；`articleTitle` 只用于预览核对，不用于按重名标题静默改选文章。匹配忽略大小写和首尾空白，但不会合并不同词形或短语。未匹配项不会新增收藏；默认仅补空值，非空冲突必须勾选覆盖。词汇补充不会替换原文、翻译、场景、阅读位置、复习状态或其他文章的语境资料。

## 本地运行与测试

直接打开 `index.html`，或使用任意静态文件服务器。运行测试：

```bash
node tests/app.test.js
```
