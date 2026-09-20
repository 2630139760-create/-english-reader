# 英语语境阅读器

纯浏览器、本地存储的英语阅读与词汇复习工具。文章、原文/场景、词汇收藏、文章语境资料、复习进度与备份都只保存在当前设备，不连接 API、服务器或云数据库。

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

“复制给 GPT”生成的提示词内含同一字段定义和完整示例，并附带当前标题、完整原文、收藏词汇的真实来源句、场景数量、难度、长度与补充要求。

## 本地运行与测试

直接打开 `index.html`，或使用任意静态文件服务器。运行测试：

```bash
node tests/app.test.js
```
