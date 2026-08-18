<template>
  <div class="tiptap-wrap">
    <div class="tiptap-toolbar no-print">
      <button type="button" class="tt-btn" :class="{ active: editor?.isActive('bold') }"
        title="加粗" @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
      <button type="button" class="tt-btn" :class="{ active: editor?.isActive('underline') }"
        title="下划线" @click="editor.chain().focus().toggleUnderline().run()"><u>U</u></button>
      <span class="tt-divider"></span>
      <button type="button" class="tt-btn" :class="{ active: editor?.isActive('heading', { level: 2 }) }"
        title="大标题" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button type="button" class="tt-btn" :class="{ active: editor?.isActive('heading', { level: 3 }) }"
        title="小标题" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
      <button type="button" class="tt-btn" :class="{ active: editor?.isActive('paragraph') }"
        title="正文" @click="editor.chain().focus().setParagraph().run()">P</button>
      <span class="tt-divider"></span>
      <button type="button" class="tt-btn" :class="{ active: editor?.isActive('bulletList') }"
        title="项目符号列表" @click="editor.chain().focus().toggleBulletList().run()">• 列表</button>
    </div>
    <EditorContent :editor="editor" class="tiptap-content" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, watch } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

const props = defineProps({ modelValue: { type: String, default: "" } });
const emit = defineEmits(["update:modelValue"]);

const editor = useEditor({
  content: props.modelValue,
  extensions: [StarterKit, Underline],
  onUpdate: ({ editor }) => emit("update:modelValue", editor.getHTML())
});

// 外部改了 modelValue（比如"插入成员周报"）时才回填，避免用户打字时被自身触发的
// update:modelValue 又同步回来打断输入 / 打乱光标
watch(() => props.modelValue, (value) => {
  if (!editor.value) return;
  if (value === editor.value.getHTML()) return;
  editor.value.commands.setContent(value || "", false);
});

function insertHtmlAtCursor(html) {
  editor.value?.chain().focus("end").insertContent(html).run();
}
defineExpose({ insertHtmlAtCursor });

onBeforeUnmount(() => editor.value?.destroy());
</script>

<style scoped>
.tiptap-wrap { border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; background: #fff; }
.tiptap-toolbar {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px;
  border-bottom: 1px solid var(--border-color, #e2e8f0); background: #f8fafc;
  border-radius: 8px 8px 0 0;
  /* 吸顶：编辑框内容较长、页面往下滚动时，工具栏保持可见，不用滚回顶部才能改格式 */
  position: sticky;
  top: 66px;
  z-index: 995;
}
.tt-btn { min-width: 30px; height: 28px; padding: 0 8px; font-size: 13px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; }
.tt-btn:hover { background: #e2e8f0; }
.tt-btn.active { background: #dbeafe; border-color: #93c5fd; }
.tt-divider { width: 1px; height: 18px; background: var(--border-color, #e2e8f0); margin: 0 4px; }
.tiptap-content { padding: 16px; min-height: 360px; border-radius: 0 0 8px 8px; }
.tiptap-content :deep(.ProseMirror) { outline: none; min-height: 340px; line-height: 1.7; }
.tiptap-content :deep(h2) { font-size: 20px; margin: 14px 0 8px; }
.tiptap-content :deep(h3) { font-size: 16px; margin: 12px 0 6px; }
</style>